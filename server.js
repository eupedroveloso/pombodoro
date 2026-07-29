import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { readFileSync, existsSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { OAuth2Client } from 'google-auth-library'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Segredos moram no .env.local (fora do git); em produção vêm do ambiente.
try {
  process.loadEnvFile(join(__dirname, '.env.local'))
} catch {}

const DATA_FILE = join(__dirname, 'data.json')
const PORT = process.env.PORT || 3000

const prisma = new PrismaClient()

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const googleAuth = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null
if (!GOOGLE_CLIENT_ID) console.warn('[pombodoro] GOOGLE_CLIENT_ID vazio — login com Google desligado (só convidados)')

const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex')
if (!process.env.SESSION_SECRET) console.warn('[pombodoro] SESSION_SECRET ausente — sessões caem a cada restart')

// Bump a cada mudança de física/protocolo: clientes com versão diferente
// recarregam sozinhos — acaba o pombo fantasma de aba desatualizada.
const VERSAO_APP = 20

/* ─────────────────────────── regras da praça ─────────────────────────── */

const FOCO_PADRAO = 30 * 60
const PAUSA_PADRAO = 6 * 60
const BASE_MIGALHAS = 10
const BONUS_POR_AMIGO = 5
const MAX_AMIGOS_BONUS = 3
const MAX_SPRINTS_DIA = 8
const TOLERANCIA_QUEDA_SEC = 120 // reconectou em até 2min? o sprint continua valendo
const SOME_DA_PRACA_SEC = 600 // offline há 10min: sai do desenho, mantém as migalhas
const ALCANCE_SOCO = 38 // px lógicos (pombo agora tem 36 de largura)
const EMPURRAO_SOCO = 20

function chaveDoDia(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().slice(0, 10)
}

/* ─────────────────────────── estado + persistência ─────────────────────────── */

/** O timer é estado da sala: qualquer pombo presente pode controlar. */
function novoTimer(focusSec = FOCO_PADRAO, breakSec = PAUSA_PADRAO) {
  return { fase: 'foco', restante: focusSec, rodando: false, focusSec, breakSec }
}

/* ── sprint solo ──
   Cada jogador pode trocar o relógio da sala por um relógio PESSOAL, com a
   mesma autoridade no servidor e o mesmo padrão de tráfego: o cliente
   extrapola sobre o relógio do servidor e só recebe emissão nas viradas
   (evento 'estadoSolo', direcionado só ao socket do dono). Pontua 10
   migalhas por sprint completo, SEM bônus de bando — o bônus é o incentivo
   do modo grupo. Vive só em memória (não persiste no banco): quem cair por
   mais de 2min perde o sprint de qualquer jeito. */
function novoSolo(focusSec, breakSec) {
  return { ativo: true, fase: 'foco', restante: focusSec, rodando: false, focusSec, breakSec, focoValido: false }
}

/** Rádio: fila coletiva de YouTube. O servidor é a autoridade de posição. */
function novoRadio() {
  // tropecos: reclamações de erro da faixa atual (ver decidirPulo).
  return { fila: [], indice: 0, tocando: false, inicioEm: 0, offsetSec: 0, tropecos: null }
}

/** Em que segundo da faixa atual a sala está. */
function posRadio(r) {
  return r.offsetSec + (r.tocando ? (Date.now() - r.inicioEm) / 1000 : 0)
}

function tocarFaixa(r, i, tocar = true) {
  r.indice = i
  r.offsetSec = 0
  r.inicioEm = Date.now()
  r.tocando = tocar && Boolean(r.fila[i])
}

/* ── quem pode pular uma música ──
   O player do YouTube devolve um CÓDIGO junto do erro, e eles não são todos
   iguais:
     100 · vídeo removido ou privado
     101 e 150 · o dono proibiu tocar fora do YouTube
   Esses três não têm conserto: pula na hora, e o mural explica o motivo.
     2 · parâmetro inválido      5 · erro do player HTML5
   Esses dois costumam ser problema de UM navegador — extensão, bloqueador,
   rede tossindo. Antes, o primeiro cliente a tropeçar derrubava a música da
   sala inteira; era a causa das faixas "puladas sozinhas". Agora só pula
   quando TODO MUNDO que está ouvindo tropeça na mesma faixa. Quem tropeçou
   sozinho tenta de novo por conta própria (ver o onError no app.js). */
const ERRO_SEM_CONSERTO = new Set([100, 101, 150])

function decidirPulo(sala, r, atual, socket, codigo) {
  if (ERRO_SEM_CONSERTO.has(codigo)) {
    anunciar(
      sala,
      codigo === 100
        ? `"${atual.titulo}" saiu do ar — pulando ⏭`
        : `"${atual.titulo}" não deixa tocar fora do YouTube — pulando ⏭`
    )
    return true
  }
  // Erro possivelmente passageiro: junta as reclamações desta faixa.
  if (r.tropecos?.videoId !== atual.videoId) r.tropecos = { videoId: atual.videoId, quem: new Set() }
  r.tropecos.quem.add(socket.id)
  const ouvintes = [...sala.jogadores.values()].filter((j) => j.online).length
  if (r.tropecos.quem.size < Math.max(1, ouvintes)) return false // ainda tem gente ouvindo bem
  anunciar(sala, `"${atual.titulo}" não tocou pra ninguém — pulando ⏭`)
  return true
}

function avancarRadio(r) {
  r.tropecos = null // faixa nova, reclamações zeradas
  if (r.indice < r.fila.length - 1) tocarFaixa(r, r.indice + 1)
  else {
    // Fim da fila: para e aponta pra "depois do fim" — a próxima música
    // adicionada assume dali.
    r.indice = r.fila.length
    r.offsetSec = 0
    r.tocando = false
  }
}

function extrairVideoId(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/)
  if (m) return m[1]
  const solto = url.trim().match(/^([\w-]{11})$/) // colou só o ID
  return solto ? solto[1] : null
}

/* ── importação de playlist ──
   Sem chave de API: o feed RSS público dá até ~15 vídeos de forma estável;
   quando ele não basta, raspamos o ytInitialData da página da playlist
   (frágil por natureza — qualquer falha degrada pro resultado do feed).
   Cada vídeo ainda passa pela MESMA validação oEmbed do caminho de vídeo
   único antes de entrar na fila. */

const LIMITE_IMPORTACAO = 25 // músicas por colada de playlist; o excedente é ignorado com aviso
const PAUSA_ENTRE_OEMBEDS_MS = 150 // pra não metralhar o YouTube
const UA_NAVEGADOR =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const importacoes = new Set() // socket.id com importação em andamento (evita colada dupla)

/* A REGRA DO LINK, e ela é só uma: manda o que o link APONTA.
   Link de vídeo (tem v=/youtu.be/shorts) → entra só aquele vídeo, mesmo que
   venha com &list= pendurado. Link de playlist pura (playlist?list=ID, sem
   vídeo nenhum) → entra a playlist.
   Antes era o contrário: qualquer list= sequestrava o link e importava a
   playlist inteira. Quem copia o endereço de uma música ouvindo playlist
   recebe watch?v=X&list=Y do YouTube — e levava 25 músicas sem pedir. */
function extrairPlaylistId(url) {
  if (extrairVideoId(url)) return null // o vídeo do link ganha, sempre
  const m = String(url).match(/[?&]list=([\w-]+)/)
  return m ? m[1] : null
}

function decodificarXml(t) {
  return String(t)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

async function buscarTexto(url) {
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    // User-Agent de navegador + consent já dado: sem isso o YouTube pode
    // devolver a página de consentimento em vez do conteúdo.
    headers: { 'user-agent': UA_NAVEGADOR, 'accept-language': 'en', cookie: 'CONSENT=YES+cb; SOCS=CAI' },
  })
  if (!resp.ok) throw new Error(`http ${resp.status}`)
  return resp.text()
}

/** Caminho principal: feed RSS público da playlist (XML estável, até ~15 vídeos). */
async function idsDoFeed(listId) {
  const xml = await buscarTexto(`https://www.youtube.com/feeds/videos.xml?playlist_id=${listId}`)
  const ids = []
  for (const m of xml.matchAll(/<yt:videoId>([\w-]{11})<\/yt:videoId>/g)) ids.push(m[1])
  // O primeiro <title> do feed é o nome da playlist (os das entradas vêm depois).
  const titulo = decodificarXml(xml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '')
  return { ids, titulo }
}

/** Recorta o objeto JSON embutido que começa logo após `nome` no HTML,
    varrendo chaves balanceadas com consciência de strings. */
function extrairJsonEmbutido(html, nome) {
  const i = html.indexOf(nome)
  if (i < 0) throw new Error(`${nome} não encontrado`)
  const ini = html.indexOf('{', i)
  if (ini < 0) throw new Error('abertura do JSON não encontrada')
  let prof = 0
  let emStr = false
  let esc = false
  for (let j = ini; j < html.length; j++) {
    const c = html[j]
    if (esc) { esc = false; continue }
    if (emStr) {
      if (c === '\\') esc = true
      else if (c === '"') emStr = false
      continue
    }
    if (c === '"') emStr = true
    else if (c === '{') prof++
    else if (c === '}' && --prof === 0) return JSON.parse(html.slice(ini, j + 1))
  }
  throw new Error('JSON truncado')
}

/** Fallback/extensão: raspa o ytInitialData da página da playlist (até ~50).
    Busca recursiva pelos nós de vídeo em vez de caminho fixo — a estrutura
    externa muda com frequência, os nós folha nem tanto. Duas gerações de
    marcação: playlistVideoRenderer (antiga) e lockupViewModel (2024+). */
async function idsDaPagina(listId) {
  const html = await buscarTexto(`https://www.youtube.com/playlist?list=${listId}`)
  const dados = extrairJsonEmbutido(html, 'ytInitialData')
  const ids = []
  const vistos = new Set()
  const anotar = (id) => {
    if (/^[\w-]{11}$/.test(id) && !vistos.has(id)) {
      vistos.add(id)
      ids.push(id)
    }
  }
  ;(function varrer(no) {
    if (!no || typeof no !== 'object' || ids.length >= 50) return
    if (no.playlistVideoRenderer?.videoId) return anotar(no.playlistVideoRenderer.videoId)
    const lockup = no.lockupViewModel
    if (lockup?.contentId && lockup.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') return anotar(lockup.contentId)
    for (const v of Object.values(no)) varrer(v)
  })(dados)
  return ids
}

/** Importa uma playlist pra fila da sala, vídeo a vídeo, em série.
    Roda solta (sem await no handler) — o resumo volta pelo evento
    'radioImport' só pra quem colou; a fila cresce ao vivo pra sala toda. */
async function importarPlaylist(sala, jogador, socket, listId) {
  importacoes.add(socket.id)
  const r = sala.radio
  try {
    let ids = []
    let tituloPlaylist = ''
    try {
      const feed = await idsDoFeed(listId)
      ids = feed.ids
      tituloPlaylist = feed.titulo
    } catch {} // feed fora do ar ou playlist sem feed: ainda tem o scrape
    // O feed para em ~15. Se falhou, ou encheu e ainda cabe mais, a página
    // da playlist pode render a lista maior.
    if (ids.length === 0 || (ids.length >= 15 && ids.length < LIMITE_IMPORTACAO)) {
      try {
        const daPagina = await idsDaPagina(listId)
        if (daPagina.length > ids.length) ids = daPagina
      } catch {} // scrape quebrou (estrutura mudou, consent…): degrada pro feed
    }
    if (!ids.length) {
      return socket.emit('radioImport', { erro: 'Não consegui ler essa playlist — confere se ela existe e é pública 📻' })
    }

    const cortadas = Math.max(0, ids.length - LIMITE_IMPORTACAO)
    ids = ids.slice(0, LIMITE_IMPORTACAO)

    let adicionadas = 0
    let semEmbed = 0
    let repetidas = 0
    let filaCheia = 0
    for (const id of ids) {
      // Pombo caiu no meio: cancela o resto — o que já entrou, fica.
      if (!socket.connected) return
      if (r.fila.some((f) => f.videoId === id)) {
        repetidas++
        continue
      }
      if (r.fila.length >= 50) {
        filaCheia++
        continue
      }
      // MESMA validação do vídeo único: oEmbed confirma que existe e toca
      // fora do YouTube, e ainda traz título e miniatura de graça.
      try {
        const resp = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
          { signal: AbortSignal.timeout(6000) }
        )
        if (!resp.ok) throw new Error(`oembed ${resp.status}`)
        const dados = await resp.json()
        const estavaOcioso = !r.fila[r.indice]
        r.fila.push({ videoId: id, titulo: dados.title, de: jogador.nome, deId: jogador.id, imagem: dados.thumbnail_url })
        adicionadas++
        if (estavaOcioso) tocarFaixa(r, r.fila.length - 1)
        io.to(sala.codigo).emit('estado', estado(sala)) // a fila cresce ao vivo
      } catch {
        semEmbed++
      }
      await new Promise((res) => setTimeout(res, PAUSA_ENTRE_OEMBEDS_MS))
    }
    if (adicionadas) {
      anunciar(
        sala,
        `${jogador.nome} importou ${adicionadas} música${adicionadas > 1 ? 's' : ''} da playlist${tituloPlaylist ? ` "${tituloPlaylist}"` : ''} 📻`
      )
      io.to(sala.codigo).emit('estado', estado(sala))
    }
    socket.emit('radioImport', { adicionadas, semEmbed, repetidas, filaCheia, cortadas })
  } finally {
    importacoes.delete(socket.id)
  }
}

const salas = new Map()

function novaSala(codigo) {
  return { codigo, timer: novoTimer(), radio: novoRadio(), jogadores: new Map(), mural: [], manchas: [] }
}

/* Salas carregam do banco sob demanda, uma vez, e daí vivem em memória.
   O Map de promessas segura o caso de dois pombos pousarem na mesma praça
   fria ao mesmo tempo — só a primeira chamada toca o banco. */
const salasCarregando = new Map()

function pegarSala(codigo) {
  if (salas.has(codigo)) return Promise.resolve(salas.get(codigo))
  if (salasCarregando.has(codigo)) return salasCarregando.get(codigo)
  const promessa = carregarSala(codigo)
    .catch((e) => {
      console.error(`[pombodoro] falhei ao carregar a sala ${codigo} do banco:`, e.message)
      return novaSala(codigo)
    })
    .then((sala) => {
      if (!salas.has(codigo)) salas.set(codigo, sala)
      salasCarregando.delete(codigo)
      return salas.get(codigo)
    })
  salasCarregando.set(codigo, promessa)
  return promessa
}

async function carregarSala(codigo) {
  const sala = novaSala(codigo)
  const dados = await prisma.sala.findUnique({
    where: { codigo },
    include: { participacoes: { include: { user: true } } },
  })
  if (!dados) return sala
  sala.timer = novoTimer(dados.focusSec, dados.breakSec)
  for (const p of dados.participacoes) {
    sala.jogadores.set(p.userId, {
      id: p.userId,
      nome: p.user.nome,
      crista: p.user.crista,
      corpo: p.user.corpo,
      acessorio: p.user.acessorio || 0,
      migalhas: p.migalhas,
      sprints: p.sprints,
      sprintsHoje: p.dia === chaveDoDia() ? p.sprintsHoje : 0,
      dia: chaveDoDia(),
      online: false,
      offlineDesde: 0, // veio do banco frio: não aparece no desenho até pousar
      socketId: null,
      focoValido: false,
      saiu: false,
      tarefas: Array.isArray(p.tarefas) ? p.tarefas : [],
      tarefaAtual: p.tarefaAtual || null,
    })
  }
  return sala
}

function anunciar(sala, texto) {
  sala.mural.push({ tipo: 'sistema', texto, ts: Date.now() })
}

/* ─────────────────────────── mural de tarefas ─────────────────────────── */
/* O mural é PESSOAL — cada jogador só vê e mexe nas suas tarefas, e ele
   viaja num evento próprio ('minhasTarefas'), direcionado só ao socket do
   dono. Nunca entra no estado() da sala.
   ÚNICA exceção: o TEXTO da tarefa escolhida pro sprint em andamento. Esse
   vai em jogadoresVisiveis() pra praça mostrar, em cima da cabeça de quem
   está no foco, o que a pessoa foi fazer — é o combinado do bando. O resto
   do mural (as outras tarefas, as concluídas, o histórico) continua só do
   dono. */

const MAX_TAREFAS = 60
const gerarIdTarefa = () => `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const tarefaSerializada = (t) => ({ id: t.id, texto: t.texto, status: t.status, criadaEm: t.criadaEm })

/** Texto da tarefa que o jogador escolheu pro sprint — o único pedaço do
    mural que a sala inteira enxerga (ver o bloco acima). Cortado curto: vai
    caber numa plaquinha em cima da cabeça do pombo, não num parágrafo. */
const TAREFA_NA_PRACA_MAX = 48

function tarefaDoSprint(j) {
  if (!j.tarefaAtual) return null
  const t = (j.tarefas || []).find((x) => x.id === j.tarefaAtual)
  if (!t || t.status === 'concluida') return null
  return String(t.texto).slice(0, TAREFA_NA_PRACA_MAX)
}

function enviarTarefas(jogador) {
  if (!jogador.socketId) return
  io.to(jogador.socketId).emit('minhasTarefas', {
    tarefas: (jogador.tarefas || []).map(tarefaSerializada),
    atual: jogador.tarefaAtual || null,
  })
}

/** Libera a tarefa selecionada pro ciclo (sem excluir): volta pro mural como
    'em_andamento'. `avisar` pergunta ao dono se ela foi concluída — só faz
    sentido quando o ciclo de foco termina de verdade, não num reset manual. */
function liberarTarefaAtual(jogador, avisar) {
  if (!jogador.tarefaAtual) return
  const t = (jogador.tarefas || []).find((x) => x.id === jogador.tarefaAtual)
  jogador.tarefaAtual = null
  if (!t || t.status === 'concluida') return
  t.status = 'em_andamento'
  if (avisar && jogador.socketId) {
    io.to(jogador.socketId).emit('confirmarTarefa', { id: t.id, texto: t.texto })
  }
}

/* Migração única: se ainda existe um data.json da era pré-banco, sobe tudo
   pro Postgres (sem sobrescrever o que já está lá) e renomeia o arquivo. */
async function importarDataJson() {
  if (!existsSync(DATA_FILE)) return
  try {
    const bruto = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
    for (const [codigo, dados] of Object.entries(bruto)) {
      await prisma.sala.upsert({
        where: { codigo },
        update: {},
        create: { codigo, focusSec: dados.focusSec || FOCO_PADRAO, breakSec: dados.breakSec || PAUSA_PADRAO },
      })
      for (const [id, j] of Object.entries(dados.jogadores || {})) {
        await prisma.user.upsert({
          where: { id },
          update: {},
          create: { id, nome: j.nome || 'Pombo', crista: j.crista || 0, corpo: j.corpo || 0, acessorio: j.acessorio || 0 },
        })
        await prisma.participacao.upsert({
          where: { userId_salaCodigo: { userId: id, salaCodigo: codigo } },
          update: {},
          create: {
            userId: id,
            salaCodigo: codigo,
            migalhas: j.migalhas || 0,
            sprints: j.sprints || 0,
            sprintsHoje: j.sprintsHoje || 0,
            dia: j.dia || '',
            tarefas: j.tarefas || [],
            tarefaAtual: j.tarefaAtual || null,
          },
        })
      }
    }
    renameSync(DATA_FILE, `${DATA_FILE}.importado`)
    console.log('[pombodoro] data.json importado pro banco (arquivo renomeado pra data.json.importado)')
  } catch (e) {
    console.error('[pombodoro] não consegui importar o data.json:', e.message)
  }
}

/* O jogo continua rodando 100% em memória; o banco é o retrato durável.
   O debounce de 1.5s junta rajadas de mudança num flush só, e o flag
   `salvando` impede dois flushes concorrentes de se atropelarem. */
let salvarPendente = null
let salvando = false
let salvarDeNovo = false

function salvar() {
  if (salvarPendente) return
  salvarPendente = setTimeout(() => {
    salvarPendente = null
    persistir()
  }, 1500)
}

async function persistir() {
  if (salvando) {
    salvarDeNovo = true
    return
  }
  salvando = true
  try {
    for (const [codigo, sala] of salas) {
      await prisma.sala.upsert({
        where: { codigo },
        update: { focusSec: sala.timer.focusSec, breakSec: sala.timer.breakSec },
        create: { codigo, focusSec: sala.timer.focusSec, breakSec: sala.timer.breakSec },
      })
      for (const [id, j] of sala.jogadores) {
        // O visual e o nome são da conta (User); o progresso é da praça (Participacao).
        const pombo = { nome: j.nome, crista: j.crista, corpo: j.corpo, acessorio: j.acessorio || 0 }
        await prisma.user.upsert({ where: { id }, update: pombo, create: { id, ...pombo } })
        const progresso = {
          migalhas: j.migalhas,
          sprints: j.sprints,
          sprintsHoje: j.sprintsHoje,
          dia: j.dia,
          tarefas: j.tarefas || [],
          tarefaAtual: j.tarefaAtual || null,
        }
        await prisma.participacao.upsert({
          where: { userId_salaCodigo: { userId: id, salaCodigo: codigo } },
          update: progresso,
          create: { userId: id, salaCodigo: codigo, ...progresso },
        })
      }
    }
  } catch (e) {
    console.error('[pombodoro] falhei ao salvar no banco:', e.message)
  } finally {
    salvando = false
    if (salvarDeNovo) {
      salvarDeNovo = false
      salvar()
    }
  }
}

/* ─────────────────────────── serialização pro cliente ─────────────────────────── */

function jogadoresVisiveis(sala) {
  const agora = Date.now()
  return [...sala.jogadores.values()]
    // Quem saiu pela porta some na hora; quem caiu fica de fantasma um tempo.
    .filter((j) => !j.saiu && (j.online || agora - j.offlineDesde < SOME_DA_PRACA_SEC * 1000))
    .map((j) => ({
      id: j.id,
      nome: j.nome,
      crista: j.crista,
      corpo: j.corpo,
      acessorio: j.acessorio || 0,
      x: j.posX, // quem entra agora vê os outros onde eles pararam
      dir: j.posDir,
      migalhas: j.migalhas,
      sprints: j.sprints,
      sprintsHoje: j.sprintsHoje,
      online: j.online,
      focoValido: j.focoValido,
      // Modo solo: os OUTROS clientes precisam saber se este pombo está
      // sentado no próprio sprint (ou passeando na própria pausa) pra
      // desenhá-lo certo — só o flag viaja, nunca o relógio dele.
      soloAtivo: Boolean(j.solo?.ativo),
      soloFoco: Boolean(j.solo?.ativo && j.solo.fase === 'foco' && j.solo.rodando),
      // O que este pombo foi fazer neste sprint (só o texto da tarefa
      // selecionada; o mural dele continua privado).
      tarefa: tarefaDoSprint(j),
    }))
    .sort((a, b) => b.migalhas - a.migalhas || a.nome.localeCompare(b.nome))
}

function estado(sala) {
  const t = sala.timer
  return {
    codigo: sala.codigo,
    versao: VERSAO_APP,
    // O cliente conta os segundos sozinho a partir daqui — sem tráfego por segundo.
    agoraServidor: Date.now(),
    fase: t.fase,
    restante: t.restante,
    rodando: t.rodando,
    focusSec: t.focusSec,
    breakSec: t.breakSec,
    jogadores: jogadoresVisiveis(sala),
    mural: sala.mural.slice(-60),
    // Sangue some depois de ~20 segundos.
    manchas: sala.manchas.filter((m) => Date.now() - m.ts < 20000),
    radio: {
      fila: sala.radio.fila.map((f) => ({ videoId: f.videoId, titulo: f.titulo, de: f.de, imagem: f.imagem })),
      indice: sala.radio.indice,
      tocando: sala.radio.tocando,
      posSec: posRadio(sala.radio),
    },
  }
}

const emFoco = (sala) => sala.timer.fase === 'foco' && sala.timer.rodando

/** Foco que VALE pra este jogador: o solo, se ativo; senão, o da sala.
    Decide se o pombo dele senta e se os controles de passeio travam.
    ATENÇÃO: o mural NÃO usa isto — mural trancado é regra da SALA, não do
    indivíduo (a conversa é coletiva; um sprint pessoal não abre exceção). */
const emFocoPessoal = (sala, j) => (j.solo?.ativo ? j.solo.fase === 'foco' && j.solo.rodando : emFoco(sala))

/** Retrato do sprint solo pro dono — mesmo padrão do estado() da sala:
    vai o relógio do servidor junto e o cliente conta sozinho. */
function estadoSoloDe(j) {
  const s = j.solo
  if (!s?.ativo) return { ativo: false, agoraServidor: Date.now() }
  return {
    ativo: true,
    agoraServidor: Date.now(),
    fase: s.fase,
    restante: s.restante,
    rodando: s.rodando,
    focusSec: s.focusSec,
    breakSec: s.breakSec,
  }
}

function enviarSolo(j) {
  if (j.socketId) io.to(j.socketId).emit('estadoSolo', estadoSoloDe(j))
}

/* ─────────────────────────── sessão ─────────────────────────── */
/* Cookie httpOnly com "id.validade.assinatura" — HMAC caseiro, sem
   dependência de sessão no banco: verificar é só reassinar e comparar. */

const COOKIE_SESSAO = 'pombodoro_sessao'
const SESSAO_DIAS = 90

function assinarSessao(userId) {
  const exp = Date.now() + SESSAO_DIAS * 864e5
  const mac = createHmac('sha256', SESSION_SECRET).update(`${userId}.${exp}`).digest('base64url')
  return `${Buffer.from(userId).toString('base64url')}.${exp}.${mac}`
}

function lerSessao(token) {
  if (!token) return null
  const [idB64, expStr, mac] = token.split('.')
  if (!idB64 || !expStr || !mac) return null
  let userId
  try {
    userId = Buffer.from(idB64, 'base64url').toString()
  } catch {
    return null
  }
  const exp = Number(expStr)
  if (!userId || !Number.isFinite(exp) || exp < Date.now()) return null
  const esperado = createHmac('sha256', SESSION_SECRET).update(`${userId}.${exp}`).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(esperado)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return userId
}

function sessaoDoCookie(headerCookie) {
  const m = String(headerCookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE_SESSAO}=([^;]+)`))
  return lerSessao(m ? decodeURIComponent(m[1]) : null)
}

const usuarioPublico = (u) => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  foto: u.foto,
  crista: u.crista,
  corpo: u.corpo,
  acessorio: u.acessorio,
  google: Boolean(u.googleId),
})

/* ─────────────────────────── servidor ─────────────────────────── */

const app = express()
const http = createServer(app)
const io = new Server(http)

app.use(express.json())
app.use(
  express.static(join(__dirname, 'public'), {
    // Sempre revalidar: o navegador não pode servir física velha do cache.
    etag: true,
    maxAge: 0,
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
  })
)
app.get('/r/:codigo', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')))

/* ── login ── */

app.get('/auth/config', (_req, res) => res.json({ googleClientId: GOOGLE_CLIENT_ID || null }))

app.post('/auth/google', async (req, res) => {
  if (!googleAuth) return res.status(503).json({ erro: 'Login com Google não configurado neste servidor' })
  try {
    const ticket = await googleAuth.verifyIdToken({
      idToken: String(req.body?.credential || ''),
      audience: GOOGLE_CLIENT_ID,
    })
    const p = ticket.getPayload()
    const user = await prisma.user.upsert({
      where: { googleId: p.sub },
      // Nome e visual do pombo NÃO voltam pro padrão do Google a cada login —
      // o que o jogador customizou na portaria é dele.
      update: { email: p.email || null, foto: p.picture || null },
      create: {
        id: `g-${p.sub}`,
        googleId: p.sub,
        email: p.email || null,
        foto: p.picture || null,
        nome: String(p.given_name || p.name || 'Pombo').trim().slice(0, 16) || 'Pombo',
      },
    })
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_SESSAO}=${encodeURIComponent(assinarSessao(user.id))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSAO_DIAS * 86400}`
    )
    res.json({ user: usuarioPublico(user) })
  } catch (e) {
    console.error('[pombodoro] login google falhou:', e.message)
    res.status(401).json({ erro: 'Não consegui validar seu login do Google' })
  }
})

app.get('/auth/eu', async (req, res) => {
  const userId = sessaoDoCookie(req.headers.cookie)
  if (!userId) return res.status(401).json({ erro: 'sem sessão' })
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(401).json({ erro: 'sem sessão' })
    res.json({ user: usuarioPublico(user) })
  } catch (e) {
    console.error('[pombodoro] /auth/eu falhou:', e.message)
    res.status(500).json({ erro: 'banco fora do ar' })
  }
})

app.post('/auth/sair', (_req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_SESSAO}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  res.json({ ok: true })
})

// A identidade do socket nasce do cookie, uma vez, no handshake. Logado,
// o id do payload é ignorado — ninguém encarna o pombo dos outros.
io.use((socket, next) => {
  socket.data.userId = sessaoDoCookie(socket.handshake.headers.cookie)
  next()
})

io.on('connection', (socket) => {
  let sala = null
  let jogador = null

  socket.on('entrar', async (payload = {}) => {
    const codigo = String(payload.codigo || '').toUpperCase().slice(0, 8)
    // Logado: a identidade é a da conta (cookie). Convidado: o id do navegador.
    const id = socket.data.userId || String(payload.id || '').slice(0, 40)
    if (!codigo || !id) return

    sala = await pegarSala(codigo)
    if (!socket.connected) return // caiu enquanto a sala carregava do banco
    socket.join(codigo)

    const existente = sala.jogadores.get(id)
    const nome = String(payload.nome || 'Pombo').trim().slice(0, 16) || 'Pombo'

    if (existente) {
      jogador = existente
      jogador.nome = nome
      jogador.crista = payload.crista ?? jogador.crista
      jogador.corpo = payload.corpo ?? jogador.corpo
      jogador.acessorio = payload.acessorio ?? jogador.acessorio ?? 0
      const voltouRapido = !jogador.saiu && Date.now() - jogador.offlineDesde < TOLERANCIA_QUEDA_SEC * 1000
      if (!voltouRapido) jogador.focoValido = false
      if (jogador.saiu) anunciar(sala, `${nome} voltou pra praça`)
      jogador.saiu = false
    } else {
      jogador = {
        id,
        nome,
        crista: payload.crista ?? 0,
        corpo: payload.corpo ?? 0,
        acessorio: payload.acessorio ?? 0,
        migalhas: 0,
        sprints: 0,
        sprintsHoje: 0,
        dia: chaveDoDia(),
        online: true,
        offlineDesde: 0,
        socketId: socket.id,
        focoValido: false, // entrou com o sprint rolando? esse não conta
        saiu: false,
        tarefas: [],
        tarefaAtual: null,
        solo: null, // sprint pessoal (só memória; ver novoSolo)
      }
      sala.jogadores.set(id, jogador)
      anunciar(sala, `${nome} pousou na praça`)
    }

    jogador.online = true
    jogador.socketId = socket.id
    if (jogador.dia !== chaveDoDia()) {
      jogador.dia = chaveDoDia()
      jogador.sprintsHoje = 0
    }

    salvar()
    io.to(codigo).emit('estado', estado(sala))
    enviarTarefas(jogador)
    enviarSolo(jogador) // o sprint pessoal sobrevive à reconexão — devolve o retrato
  })

  /* ── controles do cronômetro ── */

  socket.on('timer', (payload = {}) => {
    if (!sala || !jogador) return
    const t = sala.timer
    const acao = String(payload.acao || '')

    if (acao === 'play' && !t.rodando) {
      t.rodando = true
      // Sprint começando do zero: quem está presente entra valendo.
      if (t.fase === 'foco' && t.restante === t.focusSec) abrirSprint(sala)
      anunciar(sala, `${jogador.nome} deu o play ▶`)
    } else if (acao === 'pause' && t.rodando) {
      t.rodando = false
      anunciar(sala, `${jogador.nome} pausou o relógio ⏸`)
    } else if (acao === 'reset') {
      t.fase = 'foco'
      t.restante = t.focusSec
      t.rodando = false
      for (const j of sala.jogadores.values()) {
        j.focoValido = false
        liberarTarefaAtual(j, false) // ciclo abortado, não terminado — sem perguntar
      }
      anunciar(sala, `${jogador.nome} zerou o relógio ↺`)
    } else {
      return
    }
    salvar()
    io.to(sala.codigo).emit('estado', estado(sala))
    if (acao === 'reset') for (const j of sala.jogadores.values()) enviarTarefas(j)
  })

  socket.on('config', (payload = {}) => {
    if (!sala || !jogador) return
    const t = sala.timer
    const foco = Number(payload.focusMin)
    const pausa = Number(payload.breakMin)
    if (Number.isFinite(foco)) t.focusSec = Math.round(Math.max(1, Math.min(120, foco)) * 60)
    if (Number.isFinite(pausa)) t.breakSec = Math.round(Math.max(1, Math.min(30, pausa)) * 60)
    // Mudou a duração: o sprint em andamento não vale mais.
    t.fase = 'foco'
    t.restante = t.focusSec
    t.rodando = false
    for (const j of sala.jogadores.values()) {
      j.focoValido = false
      liberarTarefaAtual(j, false)
    }
    anunciar(sala, `${jogador.nome} ajustou: ${Math.round(t.focusSec / 60)}min foco · ${Math.round(t.breakSec / 60)}min pausa`)
    salvar()
    io.to(sala.codigo).emit('estado', estado(sala))
    for (const j of sala.jogadores.values()) enviarTarefas(j)
  })

  /* ── sprint solo ──
     Espelho pessoal dos controles da sala: play/pause/reset/config, mais
     ativar/desativar pra trocar de modo. Cada ação responde só ao dono
     (estadoSolo) e rebroadcasta o estado da sala porque soloAtivo/soloFoco
     mudam o desenho do pombo pra todo mundo. */
  socket.on('solo', (payload = {}) => {
    if (!sala || !jogador) return
    const acao = String(payload.acao || '')

    if (acao === 'ativar') {
      if (!jogador.solo?.ativo) {
        // Durações herdadas do solo anterior (se houve) ou da sala.
        const focusSec = Math.min(60 * 60, jogador.solo?.focusSec ?? sala.timer.focusSec)
        const breakSec = Math.min(30 * 60, jogador.solo?.breakSec ?? sala.timer.breakSec)
        jogador.solo = novoSolo(focusSec, breakSec)
        // Trocar pro solo é sair do sprint da sala: o foco coletivo em
        // andamento deixa de contar pra este pombo (sem dupla pontuação).
        jogador.focoValido = false
      }
    } else if (acao === 'desativar') {
      if (jogador.solo?.ativo) {
        jogador.solo.ativo = false
        jogador.solo.rodando = false
        jogador.solo.focoValido = false
        // Voltou pra sala com sprint rolando? Pontua só no próximo — mesma
        // regra de quem entra no meio (focoValido segue false até abrirSprint).
      }
    } else {
      const s = jogador.solo
      if (!s?.ativo) return
      if (acao === 'play' && !s.rodando) {
        s.rodando = true
        // Sprint pessoal começando do zero: vale.
        if (s.fase === 'foco' && s.restante === s.focusSec) s.focoValido = true
      } else if (acao === 'pause' && s.rodando) {
        s.rodando = false
      } else if (acao === 'reset') {
        s.fase = 'foco'
        s.restante = s.focusSec
        s.rodando = false
        s.focoValido = false // abandono = 0
        liberarTarefaAtual(jogador, false)
        enviarTarefas(jogador)
      } else if (acao === 'config') {
        // Mesmos limites dos sliders da sala: foco 1–60min, pausa 1–30min.
        const foco = Number(payload.focusMin)
        const pausa = Number(payload.breakMin)
        if (Number.isFinite(foco)) s.focusSec = Math.round(Math.max(1, Math.min(60, foco)) * 60)
        if (Number.isFinite(pausa)) s.breakSec = Math.round(Math.max(1, Math.min(30, pausa)) * 60)
        // Mudou a duração: o sprint pessoal em andamento não vale mais.
        s.fase = 'foco'
        s.restante = s.focusSec
        s.rodando = false
        s.focoValido = false
        liberarTarefaAtual(jogador, false)
        enviarTarefas(jogador)
      } else {
        return
      }
    }

    enviarSolo(jogador)
    io.to(sala.codigo).emit('estado', estado(sala)) // o pombo sentou/levantou pros outros
  })

  /* ── presença e conversa ── */

  socket.on('mural', (payload = {}) => {
    if (!sala || !jogador) return
    const texto = String(payload.texto || '').trim().slice(0, 200)
    if (!texto) return
    // A regra que define o produto: durante o foco rodando, o mural fecha.
    if (emFoco(sala)) {
      socket.emit('recusado', 'O mural abre na pausa. Volta pro monitor. 🐦')
      return
    }
    sala.mural.push({ tipo: 'fala', de: jogador.nome, deId: jogador.id, cor: jogador.crista, texto, ts: Date.now() })
    io.to(sala.codigo).emit('estado', estado(sala))
  })

  socket.on('recado', (payload = {}) => {
    if (!sala || !jogador) return
    const texto = String(payload.texto || '').trim().slice(0, 120)
    if (!texto) return
    sala.mural.push({ tipo: 'recado', de: jogador.nome, cor: jogador.crista, texto, ts: Date.now() })
    io.to(sala.codigo).emit('estado', estado(sala))
  })

  /* ── mural de tarefas ── */

  socket.on('tarefa', (payload = {}) => {
    if (!sala || !jogador) return
    if (!jogador.tarefas) jogador.tarefas = []
    const acao = String(payload.acao || '')
    const id = String(payload.id || '')
    const tarefaAntes = tarefaDoSprint(jogador) // pra saber se a plaquinha da praça muda

    if (acao === 'criar' || acao === 'duplicar') {
      let texto = String(payload.texto || '').trim().slice(0, 140)
      if (acao === 'duplicar') {
        const origem = jogador.tarefas.find((t) => t.id === id)
        if (!origem) return
        texto = origem.texto
      }
      if (!texto) return
      if (jogador.tarefas.length >= MAX_TAREFAS) {
        return socket.emit('recusado', `Seu mural já tem ${MAX_TAREFAS} tarefas — dá um trato antes de criar mais 📋`)
      }
      jogador.tarefas.push({ id: gerarIdTarefa(), texto, status: 'pendente', criadaEm: Date.now() })
    } else if (acao === 'editar') {
      const texto = String(payload.texto || '').trim().slice(0, 140)
      const t = jogador.tarefas.find((x) => x.id === id)
      if (!t || !texto) return
      t.texto = texto
    } else if (acao === 'excluir') {
      jogador.tarefas = jogador.tarefas.filter((t) => t.id !== id)
      if (jogador.tarefaAtual === id) jogador.tarefaAtual = null
    } else if (acao === 'selecionar') {
      const t = jogador.tarefas.find((x) => x.id === id)
      if (!t || t.status === 'concluida') return
      if (jogador.tarefaAtual && jogador.tarefaAtual !== id) {
        // Trocou de ideia antes do ciclo fechar: a antiga volta a 'pendente'.
        const antiga = jogador.tarefas.find((x) => x.id === jogador.tarefaAtual)
        if (antiga && antiga.status === 'em_andamento') antiga.status = 'pendente'
      }
      jogador.tarefaAtual = id
      t.status = 'em_andamento'
    } else if (acao === 'soltar') {
      // Diferente do fim de ciclo: aqui foi o próprio dono que desistiu de
      // rastrear, então volta pra 'pendente' — não 'em_andamento'.
      const t = jogador.tarefas.find((x) => x.id === jogador.tarefaAtual)
      if (t && t.status === 'em_andamento') t.status = 'pendente'
      jogador.tarefaAtual = null
    } else if (acao === 'concluir') {
      const t = jogador.tarefas.find((x) => x.id === id)
      if (!t) return
      t.status = 'concluida'
      if (jogador.tarefaAtual === id) jogador.tarefaAtual = null
    } else if (acao === 'reabrir') {
      const t = jogador.tarefas.find((x) => x.id === id)
      if (t) t.status = 'pendente'
    } else {
      return
    }

    salvar()
    enviarTarefas(jogador)
    // A plaquinha em cima da cabeça é estado da SALA. Reemite só quando o
    // texto que os outros enxergam muda de verdade — mexer no mural (criar,
    // editar outra, reabrir) não faz a praça inteira receber pacote.
    if (tarefaDoSprint(jogador) !== tarefaAntes) io.to(sala.codigo).emit('estado', estado(sala))
  })

  socket.on('emote', (payload = {}) => {
    if (!sala || !jogador) return
    const emoji = String(payload.emoji || '').slice(0, 4)
    if (!emoji) return
    io.to(sala.codigo).emit('emote', { id: jogador.id, emoji })
  })

  socket.on('mover', (payload = {}) => {
    if (!sala || !jogador) return
    // Trabalhando não se anda nem se soca — mas "trabalhando" é pessoal:
    // quem está na pausa do próprio sprint solo passeia mesmo com a sala em foco.
    if (emFocoPessoal(sala, jogador)) return

    const acao = ['anda', 'bica', 'bica2', 'pula', 'soco', 'coco', 'danca', 'dorme', 'fuma', 'fuma-fim', 'cafe', 'cafe-fim'].includes(
      payload.acao
    )
      ? payload.acao
      : 'anda'
    const x = Number(payload.x)
    // Limites do mundo NOVO do cenario.js: 1280 de largura, teto de voo em
    // -364 (com folga) — o clamp aqui é só anti-lixo, a física é do cliente.
    if (Number.isFinite(x)) jogador.posX = Math.max(0, Math.min(1280, x))
    jogador.posDir = payload.dir === 1 ? 1 : -1
    const alt = Number(payload.alt)
    jogador.posAlt = Number.isFinite(alt) ? Math.max(-400, Math.min(0, alt)) : 0

    if (acao === 'coco') {
      if (!Number.isFinite(jogador.posX)) return
      // Quem está na vertical do pombo E abaixo dele (cocô não cai pra cima).
      // Janela larga de propósito — pegar os outros deve ser fácil, não uma
      // mira cirúrgica.
      const vitimas = []
      for (const outro of sala.jogadores.values()) {
        if (outro === jogador || outro.saiu || !Number.isFinite(outro.posX)) continue
        if (Math.abs(outro.posX - jogador.posX) > 26) continue
        if ((outro.posAlt || 0) < (jogador.posAlt || 0)) continue
        vitimas.push(outro.id)
      }
      io.to(sala.codigo).emit('coco', {
        id: jogador.id,
        x: jogador.posX,
        dir: jogador.posDir,
        alt: jogador.posAlt || 0,
        vitimas,
      })
      // Com o cocô contínuo (segurar espaço), anuncia no máximo 1x a cada 6s
      // pra rajada não afogar o mural. O evento visual sai sempre.
      if (vitimas.length && Date.now() - (jogador.anuncioCocoEm || 0) > 6000) {
        jogador.anuncioCocoEm = Date.now()
        const nomes = vitimas.map((id) => sala.jogadores.get(id)?.nome).filter(Boolean).join(', ')
        anunciar(sala, `${jogador.nome} fez cocô em ${nomes} 💩`)
        io.to(sala.codigo).emit('estado', estado(sala))
      }
      return
    }

    if (acao === 'soco') {
      if (!Number.isFinite(jogador.posX)) return
      // O servidor decide quem apanha — senão cada cliente veria uma briga diferente.
      const vitimas = []
      for (const outro of sala.jogadores.values()) {
        if (outro === jogador || outro.saiu || !Number.isFinite(outro.posX)) continue
        const dx = outro.posX - jogador.posX
        if (Math.abs(dx) > ALCANCE_SOCO) continue
        outro.posX = Math.max(0, Math.min(1280, outro.posX + (dx >= 0 ? 1 : -1) * EMPURRAO_SOCO))
        vitimas.push({ id: outro.id, x: outro.posX })
      }
      io.to(sala.codigo).emit('soco', { id: jogador.id, x: jogador.posX, dir: jogador.posDir, vitimas })
      return
    }

    // Caminho quente (~8x/s por pombo andando): retransmite sem montar estado.
    socket.to(sala.codigo).emit('pos', { id: jogador.id, x: jogador.posX, dir: jogador.posDir, alt: jogador.posAlt, acao })
  })

  /* ── rádio da praça ── */

  socket.on('radio', async (payload = {}) => {
    if (!sala || !jogador) return
    const r = sala.radio
    const acao = String(payload.acao || '')
    const atual = r.fila[r.indice]

    if (acao === 'add') {
      const url = String(payload.url || '')
      const listId = extrairPlaylistId(url)
      if (listId) {
        // Mixes automáticos (RD…/UL…) não são playlists de verdade: não têm
        // feed nem página de playlist — melhor recusar com explicação.
        if (/^(RD|UL)/.test(listId)) {
          return socket.emit(
            'recusado',
            'Esse link é um mix automático do YouTube, não uma playlist de verdade — tira o "&list=…" pra adicionar só o vídeo 📻'
          )
        }
        if (!/^[A-Za-z0-9_-]{10,42}$/.test(listId)) {
          return socket.emit('recusado', 'Esse ID de playlist não parece válido 🤔')
        }
        if (importacoes.has(socket.id)) {
          return socket.emit('recusado', 'Calma — ainda estou importando a playlist anterior ⏳')
        }
        if (r.fila.length >= 50) return socket.emit('recusado', 'A fila está lotada (50 músicas)')
        importarPlaylist(sala, jogador, socket, listId) // roda solta; o resumo volta por 'radioImport'
        return
      }
      const id = extrairVideoId(url)
      if (!id) return socket.emit('recusado', 'Não entendi esse link do YouTube 🤔')
      if (r.fila.length >= 50) return socket.emit('recusado', 'A fila está lotada (50 músicas)')
      // Repetida já entrava sem reclamar (só a importação de playlist barrava),
      // e a fila ficava com a mesma música duas vezes — quando ela não tocava,
      // o aviso de "pulando" saía duplicado. Aproveita o título de quem já
      // está na fila e nem gasta a consulta ao YouTube.
      const jaNaFila = r.fila.find((f) => f.videoId === id)
      if (jaNaFila) return socket.emit('recusado', `"${jaNaFila.titulo}" já está na fila 📻`)
      // Valida ANTES de aceitar: vídeo morto/embed bloqueado nem entra.
      // O oEmbed também traz a miniatura de graça, sem precisar de chave de API
      // (duração não vem por aqui — a Data API exigiria uma chave que não temos).
      let titulo, imagem
      try {
        const resp = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
          { signal: AbortSignal.timeout(6000) }
        )
        if (!resp.ok) throw new Error(`oembed ${resp.status}`)
        const dados = await resp.json()
        titulo = dados.title
        imagem = dados.thumbnail_url
      } catch {
        return socket.emit('recusado', 'Esse vídeo não rolou — pode não existir ou não tocar fora do YouTube')
      }
      const estavaOcioso = !r.fila[r.indice]
      r.fila.push({ videoId: id, titulo, de: jogador.nome, deId: jogador.id, imagem })
      anunciar(sala, `${jogador.nome} adicionou "${titulo}" na fila 📻`)
      if (estavaOcioso) tocarFaixa(r, r.fila.length - 1)
    } else if (acao === 'play') {
      if (!r.fila[r.indice] && r.fila.length) tocarFaixa(r, 0)
      else if (r.fila[r.indice]) {
        r.inicioEm = Date.now()
        r.tocando = true
      }
    } else if (acao === 'pause') {
      if (r.tocando) {
        r.offsetSec = posRadio(r)
        r.tocando = false
      }
    } else if (acao === 'next') {
      avancarRadio(r)
    } else if (acao === 'prev') {
      tocarFaixa(r, Math.max(0, r.indice - 1))
    } else if (acao === 'ir') {
      const i = Number(payload.indice)
      if (r.fila[i]) tocarFaixa(r, i)
    } else if (acao === 'mover') {
      // Reordenação por arrasto: o servidor aplica — a fila é da sala,
      // não do navegador de quem arrastou.
      const de = Number(payload.de)
      const para = Number(payload.para)
      if (!r.fila[de] || !r.fila[para] || de === para) return
      const [faixa] = r.fila.splice(de, 1)
      r.fila.splice(para, 0, faixa)
      // O índice aponta pra faixa atual, onde quer que ela pare.
      if (r.indice === de) r.indice = para
      else if (de < r.indice && para >= r.indice) r.indice -= 1
      else if (de > r.indice && para <= r.indice) r.indice += 1
    } else if (acao === 'remover') {
      const i = Number(payload.indice)
      if (!r.fila[i]) return
      r.fila.splice(i, 1)
      if (i < r.indice) r.indice -= 1
      else if (i === r.indice) {
        r.offsetSec = 0
        r.inicioEm = Date.now()
        if (!r.fila[r.indice]) r.tocando = false
      }
    } else if (acao === 'terminou' || acao === 'erro') {
      // 'terminou': vários clientes reportam a mesma faixa; só o primeiro
      // avança — pros demais o videoId já não bate e o evento morre aqui.
      if (!atual || atual.videoId !== payload.videoId) return
      if (acao === 'erro' && !decidirPulo(sala, r, atual, socket, Number(payload.codigo) || 0)) return
      avancarRadio(r)
    } else {
      return
    }
    io.to(sala.codigo).emit('estado', estado(sala))
  })

  /* Saída pela porta: diferente de cair a conexão. Não tem tolerância de
     reconexão — o sprint em andamento é abandonado e o pombo some do desenho
     na hora. As migalhas ficam guardadas pra quando ele voltar. */
  socket.on('sair', () => {
    if (!sala || !jogador) return
    if (jogador.socketId === socket.id) {
      jogador.online = false
      jogador.offlineDesde = Date.now()
      jogador.socketId = null
    }
    jogador.saiu = true
    jogador.focoValido = false
    if (jogador.solo?.ativo) {
      // Saiu pela porta no meio do sprint solo: abandono, igual ao da sala.
      jogador.solo.rodando = false
      jogador.solo.focoValido = false
      jogador.solo.fase = 'foco'
      jogador.solo.restante = jogador.solo.focusSec
    }
    liberarTarefaAtual(jogador, false) // saiu no meio do ciclo — sem cobrar confirmação
    // Saída dramática: explode onde estava e a mancha fica na praça.
    const ondeX = Number.isFinite(jogador.posX) ? jogador.posX : 300
    sala.manchas.push({ x: ondeX, ts: Date.now() })
    if (sala.manchas.length > 20) sala.manchas.shift()
    io.to(sala.codigo).emit('explodiu', { id: jogador.id, x: ondeX })
    anunciar(sala, `${jogador.nome} explodiu 💥`)
    socket.leave(sala.codigo)
    io.to(sala.codigo).emit('estado', estado(sala))
    salvar()
    sala = null
    jogador = null
  })

  // Sorteador: escolhe um pombo presente. Bom pra decidir quem fala
  // primeiro na daily, quem paga o café, quem revisa o PR.
  socket.on('sortear', () => {
    if (!sala || !jogador) return
    const presentes = [...sala.jogadores.values()].filter((j) => j.online && !j.saiu)
    if (!presentes.length) return
    const alvo = presentes[Math.floor(Math.random() * presentes.length)]
    anunciar(sala, `🎲 ${jogador.nome} girou o sorteio: deu ${alvo.nome}!`)
    io.to(sala.codigo).emit('sorteado', { nome: alvo.nome, por: jogador.nome })
    io.to(sala.codigo).emit('estado', estado(sala))
  })

  socket.on('disconnect', () => {
    if (!sala || !jogador) return
    if (jogador.socketId === socket.id) {
      jogador.online = false
      jogador.offlineDesde = Date.now()
    }
    io.to(sala.codigo).emit('estado', estado(sala))
  })
})

/* ─────────────────────────── batida do relógio ─────────────────────────── */

setInterval(() => {
  const agora = Date.now()

  for (const sala of salas.values()) {
    for (const j of sala.jogadores.values()) {
      if (!j.online && agora - j.offlineDesde > TOLERANCIA_QUEDA_SEC * 1000) {
        j.focoValido = false
        // Anti-trapaça vale pro solo também: caiu >2min, o sprint pessoal
        // pausa e é invalidado — quando voltar, dá play num sprint novo.
        if (j.solo?.ativo && j.solo.rodando) {
          j.solo.rodando = false
          j.solo.focoValido = false
        }
      }

      // Relógio pessoal: bate no mesmo segundo da sala, mas cada um no seu.
      const s = j.solo
      if (!s?.ativo || !s.rodando || j.saiu) continue
      s.restante -= 1
      if (s.restante > 0) continue
      if (s.fase === 'foco') {
        fecharSprintSolo(sala, j)
        s.fase = 'pausa'
        s.restante = s.breakSec
      } else {
        s.fase = 'foco'
        s.restante = s.focusSec
        s.focoValido = j.online // a pausa virou foco sozinha: o dono presente entra valendo
      }
      enviarSolo(j) // emissão só na virada, e só pro dono
      io.to(sala.codigo).emit('estado', estado(sala)) // o pombo sentou/levantou
    }

    const t = sala.timer
    if (!t.rodando) continue
    if (![...sala.jogadores.values()].some((j) => j.online)) continue // praça vazia congela

    t.restante -= 1
    if (t.restante > 0) continue

    if (t.fase === 'foco') {
      fecharSprint(sala)
      t.fase = 'pausa'
      t.restante = t.breakSec
    } else {
      t.fase = 'foco'
      t.restante = t.focusSec
      abrirSprint(sala)
    }
    io.to(sala.codigo).emit('estado', estado(sala))
  }
}, 1000)

function abrirSprint(sala) {
  for (const j of sala.jogadores.values()) {
    // Quem está no próprio sprint solo não participa do sprint da sala.
    j.focoValido = j.online && !j.solo?.ativo
  }
}

/** Crédito de um sprint fechado — comum aos dois modos. A única diferença
    é o `bando`: sempre 0 no solo, porque o bônus é o incentivo do grupo. */
function creditar(j, bando, solo = false) {
  if (j.dia !== chaveDoDia()) {
    j.dia = chaveDoDia()
    j.sprintsHoje = 0
  }
  const ganho = BASE_MIGALHAS + BONUS_POR_AMIGO * bando
  j.migalhas += ganho
  j.sprints += 1
  j.sprintsHoje += 1
  if (j.socketId) {
    io.to(j.socketId).emit('creditado', {
      ganho,
      base: BASE_MIGALHAS,
      bando,
      solo,
      total: j.migalhas,
      restamHoje: MAX_SPRINTS_DIA - j.sprintsHoje,
    })
  }
  return ganho
}

/** Fim do foco de um sprint SOLO: 10 migalhas secas, sem bando, mesmo teto
    diário de 8 sprints (compartilhado com o modo sala). */
function fecharSprintSolo(sala, j) {
  const completou = j.solo.focoValido && j.online
  j.solo.focoValido = false
  // Mesmo rito do fim de foco da sala: a tarefa marcada pede confirmação.
  liberarTarefaAtual(j, true)
  enviarTarefas(j)
  if (!completou) return
  if (j.dia !== chaveDoDia()) {
    j.dia = chaveDoDia()
    j.sprintsHoje = 0
  }
  if (j.sprintsHoje < MAX_SPRINTS_DIA) {
    const ganho = creditar(j, 0, true)
    anunciar(sala, `${j.nome} fechou um sprint solo · +${ganho} 🍞`)
  }
  salvar()
}

function fecharSprint(sala) {
  // O bando é quem atravessou o foco junto. Quem já bateu o teto diário
  // continua contando pro bônus dos outros — só não leva migalha.
  const concluiram = [...sala.jogadores.values()].filter((j) => j.focoValido && j.online)
  const bando = Math.min(Math.max(concluiram.length - 1, 0), MAX_AMIGOS_BONUS)
  const ganho = BASE_MIGALHAS + BONUS_POR_AMIGO * bando
  const premiados = concluiram.filter((j) => j.sprintsHoje < MAX_SPRINTS_DIA)

  for (const j of premiados) {
    creditar(j, bando)
    j.focoValido = false
  }

  for (const j of sala.jogadores.values()) {
    j.focoValido = false
    // Fim de verdade do ciclo de foco: quem tinha tarefa selecionada é
    // convidado a confirmar se terminou. Não confirmou? Volta ao mural
    // como 'em_andamento' — é o liberarTarefaAtual que já cuida disso.
    liberarTarefaAtual(j, true)
    enviarTarefas(j)
  }

  if (premiados.length > 0) {
    const nomes = premiados.map((j) => j.nome).join(', ')
    anunciar(
      sala,
      premiados.length === 1
        ? `${nomes} fechou o sprint · +${ganho} 🍞`
        : `${nomes} fecharam o sprint juntos · +${ganho} 🍞 cada (bando de ${concluiram.length})`
    )
  }
  salvar() // migalhas e/ou tarefas podem ter mudado mesmo sem premiados
}

/* A PRIMEIRA consulta ao Postgres paga sozinha o custo de abrir a conexão
   (~1s daqui) — e quem pagava essa conta era o primeiro pombo a pousar,
   olhando pra uma praça vazia enquanto o 'entrar' esperava o banco. Uma
   consulta boba no boot deixa o caminho aberto pra ele.
   É a MESMA consulta do carregarSala (com um código que não existe): o
   primeiro pouso encontra a conexão aberta E a consulta já preparada. */
function aquecerBanco() {
  return prisma.sala
    .findUnique({
      // Código impossível (os de verdade são maiúsculos e têm até 8 letras):
      // não lê sala nenhuma, só abre o caminho.
      where: { codigo: 'aquecimento-do-boot' },
      include: { participacoes: { include: { user: true } } },
    })
    .catch((e) => console.warn('[pombodoro] banco não respondeu no aquecimento:', e.message))
}

importarDataJson().finally(() => {
  aquecerBanco()
  http.listen(PORT, () => {
    console.log(`\n  🐦  Pombodoro voando em http://localhost:${PORT}\n`)
  })
})
