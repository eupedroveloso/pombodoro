import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = join(__dirname, 'data.json')
const PORT = process.env.PORT || 3000

// Bump a cada mudança de física/protocolo: clientes com versão diferente
// recarregam sozinhos — acaba o pombo fantasma de aba desatualizada.
const VERSAO_APP = 16

/* ─────────────────────────── regras da praça ─────────────────────────── */

const FOCO_PADRAO = 30 * 60
const PAUSA_PADRAO = 6 * 60
const BASE_MIGALHAS = 10
const BONUS_POR_AMIGO = 5
const MAX_AMIGOS_BONUS = 3
const MAX_SPRINTS_DIA = 8
const TOLERANCIA_QUEDA_SEC = 120 // reconectou em até 2min? o sprint continua valendo
const SOME_DA_PRACA_SEC = 600 // offline há 10min: sai do desenho, mantém as migalhas
const ALCANCE_SOCO = 26 // px lógicos
const EMPURRAO_SOCO = 14

function chaveDoDia(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().slice(0, 10)
}

/* ─────────────────────────── estado + persistência ─────────────────────────── */

/** O timer é estado da sala: qualquer pombo presente pode controlar. */
function novoTimer(focusSec = FOCO_PADRAO, breakSec = PAUSA_PADRAO) {
  return { fase: 'foco', restante: focusSec, rodando: false, focusSec, breakSec }
}

/** Rádio: fila coletiva de YouTube. O servidor é a autoridade de posição. */
function novoRadio() {
  return { fila: [], indice: 0, tocando: false, inicioEm: 0, offsetSec: 0 }
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

function avancarRadio(r) {
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

const salas = new Map()

function novaSala(codigo) {
  return { codigo, timer: novoTimer(), radio: novoRadio(), jogadores: new Map(), mural: [], manchas: [] }
}

function pegarSala(codigo) {
  if (!salas.has(codigo)) salas.set(codigo, novaSala(codigo))
  return salas.get(codigo)
}

function anunciar(sala, texto) {
  sala.mural.push({ tipo: 'sistema', texto, ts: Date.now() })
}

/* ─────────────────────────── mural de tarefas ─────────────────────────── */
/* Tarefas são PESSOAIS — cada jogador só vê e mexe nas suas. Por isso não
   entram em jogadoresVisiveis()/estado() (que é broadcast pra sala inteira);
   viajam num evento próprio, direcionado só ao socket do dono. */

const MAX_TAREFAS = 60
const gerarIdTarefa = () => `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const tarefaSerializada = (t) => ({ id: t.id, texto: t.texto, status: t.status, criadaEm: t.criadaEm })

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

function carregar() {
  if (!existsSync(DATA_FILE)) return
  try {
    const bruto = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
    for (const [codigo, dados] of Object.entries(bruto)) {
      const sala = novaSala(codigo)
      if (Number.isFinite(dados.focusSec)) sala.timer = novoTimer(dados.focusSec, dados.breakSec)
      for (const [id, j] of Object.entries(dados.jogadores || {})) {
        sala.jogadores.set(id, {
          id,
          nome: j.nome,
          crista: j.crista,
          corpo: j.corpo,
          acessorio: j.acessorio || 0,
          migalhas: j.migalhas || 0,
          sprints: j.sprints || 0,
          sprintsHoje: j.dia === chaveDoDia() ? j.sprintsHoje || 0 : 0,
          dia: chaveDoDia(),
          online: false,
          offlineDesde: Date.now(),
          socketId: null,
          focoValido: false,
          saiu: false,
          tarefas: Array.isArray(j.tarefas) ? j.tarefas : [],
          tarefaAtual: j.tarefaAtual || null,
        })
      }
      salas.set(codigo, sala)
    }
  } catch (e) {
    console.error('[pombodoro] não consegui ler data.json, começando limpo:', e.message)
  }
}

let salvarPendente = null
function salvar() {
  if (salvarPendente) return
  salvarPendente = setTimeout(() => {
    salvarPendente = null
    const saida = {}
    for (const [codigo, sala] of salas) {
      saida[codigo] = {
        focusSec: sala.timer.focusSec,
        breakSec: sala.timer.breakSec,
        jogadores: Object.fromEntries(
          [...sala.jogadores].map(([id, j]) => [
            id,
            {
              nome: j.nome,
              crista: j.crista,
              corpo: j.corpo,
              acessorio: j.acessorio || 0,
              migalhas: j.migalhas,
              sprints: j.sprints,
              sprintsHoje: j.sprintsHoje,
              dia: j.dia,
              tarefas: j.tarefas || [],
              tarefaAtual: j.tarefaAtual || null,
            },
          ])
        ),
      }
    }
    try {
      writeFileSync(DATA_FILE, JSON.stringify(saida, null, 2))
    } catch (e) {
      console.error('[pombodoro] falhei ao salvar:', e.message)
    }
  }, 1500)
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

/* ─────────────────────────── servidor ─────────────────────────── */

const app = express()
const http = createServer(app)
const io = new Server(http)

app.use(
  express.static(join(__dirname, 'public'), {
    // Sempre revalidar: o navegador não pode servir física velha do cache.
    etag: true,
    maxAge: 0,
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
  })
)
app.get('/r/:codigo', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')))

io.on('connection', (socket) => {
  let sala = null
  let jogador = null

  socket.on('entrar', (payload = {}) => {
    const codigo = String(payload.codigo || '').toUpperCase().slice(0, 8)
    const id = String(payload.id || '').slice(0, 40)
    if (!codigo || !id) return

    sala = pegarSala(codigo)
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
  })

  socket.on('emote', (payload = {}) => {
    if (!sala || !jogador) return
    const emoji = String(payload.emoji || '').slice(0, 4)
    if (!emoji) return
    io.to(sala.codigo).emit('emote', { id: jogador.id, emoji })
  })

  socket.on('mover', (payload = {}) => {
    if (!sala || !jogador) return
    if (emFoco(sala)) return // trabalhando não se anda nem se soca

    const acao = ['anda', 'bica', 'bica2', 'pula', 'soco', 'coco', 'danca', 'dorme', 'fuma', 'fuma-fim', 'cafe', 'cafe-fim'].includes(
      payload.acao
    )
      ? payload.acao
      : 'anda'
    const x = Number(payload.x)
    if (Number.isFinite(x)) jogador.posX = Math.max(0, Math.min(640, x))
    jogador.posDir = payload.dir === 1 ? 1 : -1
    const alt = Number(payload.alt)
    jogador.posAlt = Number.isFinite(alt) ? Math.max(-260, Math.min(0, alt)) : 0

    if (acao === 'coco') {
      if (!Number.isFinite(jogador.posX)) return
      // Quem está na vertical do pombo E abaixo dele (cocô não cai pra cima).
      // Janela larga de propósito — pegar os outros deve ser fácil, não uma
      // mira cirúrgica.
      const vitimas = []
      for (const outro of sala.jogadores.values()) {
        if (outro === jogador || outro.saiu || !Number.isFinite(outro.posX)) continue
        if (Math.abs(outro.posX - jogador.posX) > 18) continue
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
        outro.posX = Math.max(0, Math.min(640, outro.posX + (dx >= 0 ? 1 : -1) * EMPURRAO_SOCO))
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
      const id = extrairVideoId(String(payload.url || ''))
      if (!id) return socket.emit('recusado', 'Não entendi esse link do YouTube 🤔')
      if (r.fila.length >= 50) return socket.emit('recusado', 'A fila está lotada (50 músicas)')
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
      // Vários clientes reportam a mesma faixa; só o primeiro avança —
      // pros demais o videoId já não bate e o evento morre aqui.
      if (!atual || atual.videoId !== payload.videoId) return
      if (acao === 'erro') anunciar(sala, `"${atual.titulo}" não tocou por aqui — pulando ⏭`)
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
      if (!j.online && agora - j.offlineDesde > TOLERANCIA_QUEDA_SEC * 1000) j.focoValido = false
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
    j.focoValido = j.online
  }
}

function fecharSprint(sala) {
  // O bando é quem atravessou o foco junto. Quem já bateu o teto diário
  // continua contando pro bônus dos outros — só não leva migalha.
  const concluiram = [...sala.jogadores.values()].filter((j) => j.focoValido && j.online)
  const bando = Math.min(Math.max(concluiram.length - 1, 0), MAX_AMIGOS_BONUS)
  const ganho = BASE_MIGALHAS + BONUS_POR_AMIGO * bando
  const premiados = concluiram.filter((j) => j.sprintsHoje < MAX_SPRINTS_DIA)

  for (const j of premiados) {
    if (j.dia !== chaveDoDia()) {
      j.dia = chaveDoDia()
      j.sprintsHoje = 0
    }
    j.migalhas += ganho
    j.sprints += 1
    j.sprintsHoje += 1
    j.focoValido = false
    if (j.socketId) {
      io.to(j.socketId).emit('creditado', {
        ganho,
        base: BASE_MIGALHAS,
        bando,
        total: j.migalhas,
        restamHoje: MAX_SPRINTS_DIA - j.sprintsHoje,
      })
    }
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

carregar()
http.listen(PORT, () => {
  console.log(`\n  🐦  Pombodoro voando em http://localhost:${PORT}\n`)
})
