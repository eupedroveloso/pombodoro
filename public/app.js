import { CORPOS, CRISTAS, ACESSORIOS, spriteCanvas } from './sprites.js'
import { iniciarCena, atualizarCena, dispararEmote, aplicarPosRemota, aplicarSoco, aplicarCoco, dispararFala, ajustarZoom, explodirPombo, sincronizarRelogio } from './cena.js'
import { iconeHtml, iconeCanvas, montarIcones, EMOTE_ICONES } from './icones.js'
import { iniciarPip, avisarPip } from './pip.js'

const $ = (id) => document.getElementById(id)
const VERSAO_APP = 20
// A string do emoji continua sendo o ID no protocolo (o servidor repassa
// como veio); só a EXIBIÇÃO vira ícone pixel art (EMOTE_ICONES).
const EMOTES = ['👍', '🔥', '☕', '😵', '🍞', '🎧']

// Hidrata os <i data-icone> do HTML e troca o favicon pelo pombo pixel art.
montarIcones()
$('favicon').href = iconeCanvas('pombo', 2).toDataURL('image/png')

/* Mensagens do servidor ainda vêm com emoji no texto — a UI é 100% pixel
   art, então a exibição limpa o que for pictográfico antes de mostrar. */
function semEmoji(t) {
  return String(t)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/ {2,}/g, ' ')
    .trim()
}

/* ─── identidade ───────────────────────────────────────────── */
/* Duas vidas possíveis: logado (conta Google — o pombo mora no servidor e
   te acompanha em qualquer navegador) ou convidado (identidade gerada e
   guardada só neste navegador, como sempre foi). */

// crypto.randomUUID só existe em contexto seguro (https/localhost) — acessando
// pelo IP da rede ele é undefined e derrubaria o módulo inteiro.
const gerarId = () =>
  crypto.randomUUID?.() ??
  `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const guardado = JSON.parse(localStorage.getItem('pombodoro') || '{}')
const convidado = {
  id: guardado.id || gerarId(),
  nome: guardado.nome || '',
  corpo: guardado.corpo ?? 0,
  crista: guardado.crista ?? Math.floor(Math.random() * CRISTAS.length),
  acessorio: guardado.acessorio ?? 0,
}
let conta = null // usuário logado (vem de /auth/eu ou /auth/google)
const eu = { ...convidado }

// Convidado persiste no navegador; conta é o servidor quem guarda (no 'entrar').
const salvarEu = () => {
  if (conta) return
  Object.assign(convidado, eu)
  localStorage.setItem('pombodoro', JSON.stringify(convidado))
}

const gerarCodigo = () =>
  Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')

// A sala vem do link do convite ou da última usada neste navegador.
// Primeiro acesso sem link = sem sala: o botão "Criar minha praça" resolve.
let codigo = (() => {
  const daUrl = location.pathname.match(/^\/r\/([A-Z0-9]{1,8})$/i)?.[1]
  if (daUrl) return daUrl.toUpperCase()
  const salva = localStorage.getItem('pombodoro-sala')
  if (salva) {
    history.replaceState(null, '', `/r/${salva}`)
    return salva
  }
  return null
})()

function adotarSala(novo) {
  codigo = novo
  localStorage.setItem('pombodoro-sala', novo)
  history.replaceState(null, '', `/r/${novo}`)
  atualizarPortaria()
}

function atualizarPortaria() {
  const tem = Boolean(codigo)
  $('btnCriar').hidden = tem
  $('btnEntrar').hidden = !tem
  $('rodapeSala').hidden = !tem
  if (tem) $('codigoPreview').textContent = codigo
}

/* ─── portaria ─────────────────────────────────────────────── */

atualizarPortaria()

function montarCores(container, cores, chave) {
  container.innerHTML = ''
  cores.forEach((cor, i) => {
    const b = document.createElement('button')
    // Plumagens são {l,m,d}: o swatch mostra o tom médio com o escuro na borda.
    if (typeof cor === 'object') {
      b.style.background = cor.m
      b.style.borderBottomColor = cor.d
    } else {
      b.style.background = cor
    }
    b.setAttribute('aria-pressed', String(eu[chave] === i))
    b.onclick = () => {
      eu[chave] = i
      montarCores(container, cores, chave)
      montarAcessorios()
      desenharPrevia()
    }
    container.append(b)
  })
}

function montarAcessorios() {
  const el = $('opcoesAcessorio')
  el.innerHTML = ''
  ACESSORIOS.forEach((ac, i) => {
    const b = document.createElement('button')
    b.className = 'mini'
    b.title = ac.nome
    b.setAttribute('aria-pressed', String(eu.acessorio === i))
    // Miniatura: o próprio pombo de acessório, direto do compositor.
    const cv = document.createElement('canvas')
    cv.width = 30
    cv.height = 30
    const cx = cv.getContext('2d')
    cx.imageSmoothingEnabled = false
    // Enquadra a CABEÇA (centro ~[9,8] na grade 36x34) — é onde o acessório mora.
    const img = spriteCanvas('parado', eu.corpo, eu.crista, i)
    cx.drawImage(img, 4, 5, img.width * 1.2, img.height * 1.2)
    b.append(cv)
    b.onclick = () => {
      eu.acessorio = i
      montarAcessorios()
      desenharPrevia()
    }
    el.append(b)
  })
}

function desenharPrevia() {
  const cv = $('previa')
  const ctx = cv.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, cv.width, cv.height)
  const img = spriteCanvas('sentado', eu.corpo, eu.crista, eu.acessorio)
  const escala = Math.max(1, Math.floor(Math.min(cv.width / img.width, cv.height / img.height)))
  ctx.drawImage(img, (cv.width - img.width * escala) / 2, (cv.height - img.height * escala) / 2, img.width * escala, img.height * escala)
}

/* ─── login ────────────────────────────────────────────────── */
/* A portaria tem dois passos: (1) quem é você — Google ou convidado —
   e (2) montar o pombo e pousar. Sessão viva pula direto pro passo 2. */

function mostrarPombo() {
  $('passoLogin').hidden = true
  $('passoPombo').hidden = false
  $('nome').value = eu.nome
  montarCores($('opcoesCrista'), CRISTAS, 'crista')
  montarCores($('opcoesCorpo'), CORPOS, 'corpo')
  montarAcessorios()
  desenharPrevia()
}

function adotarConta(user) {
  conta = user
  eu.id = user.id
  eu.nome = user.nome || ''
  eu.crista = user.crista ?? 0
  eu.corpo = user.corpo ?? 0
  eu.acessorio = user.acessorio ?? 0
  $('contaChip').hidden = false
  $('contaNome').textContent = user.email || user.nome
  if (user.foto) {
    $('contaFoto').src = user.foto
    $('contaFoto').hidden = false
  }
  mostrarPombo()
}

function mostrarLogin(googleClientId) {
  $('passoPombo').hidden = true
  $('passoLogin').hidden = false
  if (!googleClientId) {
    $('loginAviso').hidden = false
    $('loginAviso').textContent = 'Login com Google ainda não configurado neste servidor — entra como convidado por enquanto.'
    return
  }
  const tag = document.createElement('script')
  tag.src = 'https://accounts.google.com/gsi/client'
  tag.onload = () => {
    google.accounts.id.initialize({ client_id: googleClientId, callback: aoReceberCredencial })
    google.accounts.id.renderButton($('botaoGoogle'), {
      theme: 'filled_black',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      locale: 'pt-BR',
    })
  }
  document.head.append(tag)
}

async function aoReceberCredencial(resposta) {
  try {
    const r = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: resposta.credential }),
    })
    const corpo = await r.json()
    if (!r.ok) throw new Error(corpo.erro || 'login falhou')
    adotarConta(corpo.user)
  } catch (e) {
    $('loginAviso').hidden = false
    $('loginAviso').innerHTML = `${iconeHtml('aviso', 12)} ${escapar(e.message)}`
  }
}

async function iniciarPortaria() {
  let googleClientId = null
  try {
    const [rConfig, rEu] = await Promise.all([fetch('/auth/config'), fetch('/auth/eu')])
    googleClientId = (await rConfig.json()).googleClientId
    if (rEu.ok) {
      adotarConta((await rEu.json()).user)
      return
    }
  } catch {
    // servidor de auth fora do ar: segue como convidado
  }
  mostrarLogin(googleClientId)
}

$('btnConvidado').onclick = () => {
  conta = null
  Object.assign(eu, convidado)
  $('contaChip').hidden = true
  mostrarPombo()
}

// Sair da conta recarrega a página: o jeito mais simples de garantir que
// nada da sessão antiga (socket, pombo, prefill) fique pra trás.
$('btnSairConta').onclick = async () => {
  try {
    await fetch('/auth/sair', { method: 'POST' })
  } catch {}
  location.reload()
}

iniciarPortaria()

let naPraca = false
let cenaIniciada = false
let radioIniciado = false

/* ─── memória de onde meu pombo estava ───────────────────────
   Guardada POR PRAÇA, neste navegador. Serve ao render otimista: o pombo
   pousa no lugar certo antes de o servidor confirmar, e quando o 'estado'
   chega ele traz a mesma posição — ninguém vê teleporte. A escrita é
   engasgada (1x/s) porque o passeio manda posição ~8x por segundo. */
const chavePos = () => `pombodoro-pos-${codigo}`
let ultimaPosSalvaEm = 0

function lembrarPos(m) {
  if (!Number.isFinite(m?.x) || Date.now() - ultimaPosSalvaEm < 1000) return
  ultimaPosSalvaEm = Date.now()
  try {
    localStorage.setItem(chavePos(), String(Math.round(m.x)))
  } catch {}
}

function posLembrada() {
  const x = Number(localStorage.getItem(chavePos()))
  return Number.isFinite(x) && x > 0 ? x : undefined
}

function entrarNaPraca() {
  if (!codigo) return // sem sala não tem onde pousar
  localStorage.setItem('pombodoro-sala', codigo)
  eu.nome = $('nome').value.trim().slice(0, 16) || 'Pombo Anônimo'
  salvarEu()
  naPraca = true
  $('entrada').hidden = true
  $('praca').hidden = false
  // Cena e player do YouTube se montam uma vez só: os dois prendem listeners
  // globais e loops que não dá pra ter em duplicata quando o pombo volta.
  if (!cenaIniciada) {
    cenaIniciada = true
    iniciarCena(
      $('cena'),
      (m) => {
        lembrarPos(m)
        return naPraca && socket.emit('mover', m)
      },
      // Cocô MEU na cabeça de um pedestre: só festejo local, sem pontos.
      (nome) => toast(`Na mosca! Acertou em cheio: ${nome}.`)
    )
  }
  if (!radioIniciado) {
    radioIniciado = true
    iniciarRadio()
  }
  aplicarPreferenciaAbas()
  pousoOtimista()
  socket.emit('entrar', { codigo, ...eu })
}

/** O pombo pousa AGORA, sem esperar o servidor.
    O 'entrar' ainda vai e volta (banco frio, rede ruim — ou nunca, se o
    socket não subir), e esperar isso deixava a praça vazia por até ~2s.
    Este estado é SÓ DESENHO: não tem fase, ponto nem notificação — quem
    manda nisso continua sendo o 'estado' do servidor, que substitui este
    sem piscar (a vista do pombo é indexada pelo id, então é a mesma). */
function pousoOtimista() {
  atualizarCena({
    fase: 'foco',
    rodando: false, // relógio parado: o pombo passeia até o servidor dizer o contrário
    jogadores: [
      {
        id: eu.id,
        nome: eu.nome,
        corpo: eu.corpo,
        crista: eu.crista,
        acessorio: eu.acessorio || 0,
        x: posLembrada(),
        online: true,
        soloAtivo: false,
        soloFoco: false,
        provisorio: true, // a cena sabe que essa posição ainda não é a do servidor
      },
    ],
    manchas: [],
    meuId: eu.id,
  })
}

/* ─── abas flutuantes (mural / controles) ─────────────────────
   As duas sidebars flutuam por cima do palco (ver CSS: aside vira overlay
   com fundo translúcido). Cada uma some pra fora da tela ao "esconder" —
   a preferência fica salva por navegador, não por sala. */

function alternarAba(el, chave, botao, icone) {
  const fechada = el.classList.toggle('recolhida')
  localStorage.setItem(`pombodoro-aba-${chave}`, fechada ? '0' : '1')
  botao.title = fechada ? `Mostrar ${chave === 'tarefas' ? 'mural' : 'controles'}` : `Esconder ${chave === 'tarefas' ? 'mural' : 'controles'}`
  botao.innerHTML = fechada ? iconeHtml(icone, 14) : (chave === 'tarefas' ? '‹' : '›')
}

function aplicarPreferenciaAbas() {
  const tarefasFechada = localStorage.getItem('pombodoro-aba-tarefas') === '0'
  const controlesFechada = localStorage.getItem('pombodoro-aba-controles') === '0'
  $('asideTarefas').classList.toggle('recolhida', tarefasFechada)
  $('asideControles').classList.toggle('recolhida', controlesFechada)
  $('toggleTarefas').innerHTML = tarefasFechada ? iconeHtml('mural', 14) : '‹'
  $('toggleControles').innerHTML = controlesFechada ? iconeHtml('painel', 14) : '›'
}

$('toggleTarefas').onclick = () => alternarAba($('asideTarefas'), 'tarefas', $('toggleTarefas'), 'mural')
$('toggleControles').onclick = () => alternarAba($('asideControles'), 'controles', $('toggleControles'), 'painel')

/** Sair é diferente de fechar a aba: o servidor tira o pombo do desenho na
    hora e o sprint em andamento não conta. As migalhas continuam guardadas. */
function sairDaPraca() {
  if (!naPraca) return
  naPraca = false
  socket.emit('sair')
  // O servidor devolve o 'explodiu' — espera a explosão terminar antes de
  // trocar de tela, senão o próprio pombo não vê a própria morte.
  setTimeout(() => {
    ultimo = null
    ultimoSolo = null
    atualizarSeletorModo()
    ultimoMuralTs = null
    $('flutuantes').innerHTML = ''
    radioAtual = null
    minhasTarefas = []
    tarefaAtualId = null
    tarefaParaConfirmar = null
    $('modalTarefa').hidden = true
    $('modalConfirmarTarefa').hidden = true
    if (playerPronto) player.pauseVideo?.()
    atualizarCena({ fase: 'foco', rodando: false, jogadores: [], manchas: [], meuId: eu.id })
    $('relogio').textContent = '--:--'
    $('proxima').textContent = ''
    document.title = 'Pombodoro'
    $('praca').hidden = true
    $('entrada').hidden = false
    $('nome').value = eu.nome
  }, 1100)
}

// Criar/trocar de praça: código novo, mesma identidade de pombo.
$('btnCriar').onclick = () => adotarSala(gerarCodigo())
$('btnNovaPraca').onclick = () => adotarSala(gerarCodigo())

$('btnCopiarPraca').onclick = async () => {
  const url = `${location.origin}/r/${codigo}`
  try {
    await navigator.clipboard.writeText(url)
    $('btnCopiarPraca').textContent = 'copiado!'
    setTimeout(() => ($('btnCopiarPraca').textContent = 'copiar convite'), 1800)
  } catch {
    prompt('Copie o convite:', url)
  }
}

$('btnSortear').onclick = () => socket.emit('sortear')
$('btnEntrar').onclick = entrarNaPraca
$('btnSair').onclick = sairDaPraca
$('zoomMais').onclick = () => ajustarZoom(1)
$('zoomMenos').onclick = () => ajustarZoom(-1)
$('nome').addEventListener('keydown', (e) => e.key === 'Enter' && $('btnEntrar').click())

/* ─── conexão ──────────────────────────────────────────────── */

const socket = io()
let ultimo = null
let deltaRelogio = 0 // relógio do servidor − relógio daqui

/* tarefas pessoais (mural) */
let minhasTarefas = []
let tarefaAtualId = null
let pendenteSelecaoRapida = false // criou tarefa direto no modal do ciclo: seleciona assim que ela chegar
let tarefaParaConfirmar = null // id da tarefa aguardando "concluí / ainda não" no fim do foco

socket.on('connect', () => {
  if (naPraca) socket.emit('entrar', { codigo, ...eu })
})

socket.on('estado', (s) => {
  // Servidor atualizou? Recarrega já — física velha polui a praça de todo mundo.
  if (s.versao && s.versao !== VERSAO_APP) {
    location.reload()
    return
  }
  const anterior = ultimo
  deltaRelogio = s.agoraServidor - Date.now()
  sincronizarRelogio(deltaRelogio) // os pedestres da cena andam nesse relógio
  ultimo = s
  montarControles()
  montarPlacar(s)
  montarMural(s)
  atualizarCena({ fase: s.fase, rodando: s.rodando, jogadores: s.jogadores, manchas: s.manchas, meuId: eu.id })
  aplicarTravaDoMural(s) // trava do mural é regra da SALA — vale até pra quem está em sprint solo
  if (!soloAtivo()) checarNovoCiclo(anterior, s)
  // Ponto único onde a fase da SALA pode ter virado: o PiP redesenha na hora
  // e a notificação sai daqui (pip.js decide se cabe). Em modo solo a
  // notificação é do relógio pessoal — aqui só redesenha (anterior = null).
  avisarPip(soloAtivo() ? null : anterior, s)
  if (s.radio) {
    radioAtual = { ...s.radio, agora: s.agoraServidor }
    montarRadio(s.radio)
    sincronizarRadio()
  }
})

socket.on('minhasTarefas', ({ tarefas, atual }) => {
  minhasTarefas = tarefas || []
  tarefaAtualId = atual || null
  // Tarefa criada na correria do modal do ciclo: assim que ela chega, usa ela.
  if (pendenteSelecaoRapida && !tarefaAtualId) {
    const nova = minhasTarefas[minhasTarefas.length - 1]
    if (nova) socket.emit('tarefa', { acao: 'selecionar', id: nova.id })
    pendenteSelecaoRapida = false
  }
  renderTarefas()
  if (!$('modalTarefa').hidden) {
    if (tarefaAtualId) fecharModalTarefa()
    else renderModalTarefa()
  }
})

socket.on('confirmarTarefa', ({ id, texto }) => {
  tarefaParaConfirmar = id
  $('confirmarTarefaTexto').textContent = texto
  $('modalConfirmarTarefa').hidden = false
})

socket.on('emote', ({ id, emoji }) => dispararEmote(id, emoji))
socket.on('pos', (p) => aplicarPosRemota(p))
socket.on('soco', (p) => aplicarSoco(p))
socket.on('coco', (p) => aplicarCoco(p))
socket.on('explodiu', ({ id, x }) => explodirPombo(id, x))
socket.on('recusado', (msg) => {
  marcarImportando(false) // recusa de playlist (mix, ID inválido…) destrava o campo
  toast(msg)
})
socket.on('sorteado', ({ nome }) => toast(`Deu ${nome}!`))

socket.on('creditado', ({ ganho, bando, total, solo }) => {
  toast(
    solo
      ? `Sprint solo fechado! +${ganho} migalhas · total ${total}`
      : bando > 0
        ? `Sprint fechado! +${ganho} migalhas (10 base + ${ganho - 10} de bando) · total ${total}`
        : `Sprint fechado! +${ganho} migalhas · total ${total}`
  )
  pedirRecado()
})

/* ─── relógio ──────────────────────────────────────────────── */

/** O servidor manda restante + timestamp; daqui pra frente é extrapolação. */
function restanteAgora() {
  if (!ultimo) return null
  if (!ultimo.rodando) return ultimo.restante
  const passou = Math.floor((Date.now() + deltaRelogio - ultimo.agoraServidor) / 1000)
  return Math.max(0, ultimo.restante - Math.max(0, passou))
}

/* ─── sprint solo ──────────────────────────────────────────────
   Relógio pessoal, com a mesma autoridade no servidor e o mesmo padrão do
   da sala: 'estadoSolo' chega só nas viradas (e nas ações do dono), com o
   relógio do servidor junto — daqui pra frente é extrapolação local.
   O modo ativo (sala ou solo) decide o que o relógio grande, o PiP e os
   controles do header mostram e comandam. */

let ultimoSolo = null // último estadoSolo com ativo=true; null = modo sala
let deltaSolo = 0

const soloAtivo = () => Boolean(ultimoSolo?.ativo)

function restanteSoloAgora() {
  if (!ultimoSolo) return null
  if (!ultimoSolo.rodando) return ultimoSolo.restante
  const passou = Math.floor((Date.now() + deltaSolo - ultimoSolo.agoraServidor) / 1000)
  return Math.max(0, ultimoSolo.restante - Math.max(0, passou))
}

/** Retrato do modo ATIVO — é isso que relógio grande, PiP e controles usam. */
function estadoAtivo() {
  if (soloAtivo()) {
    return {
      solo: true,
      restante: restanteSoloAgora(),
      fase: ultimoSolo.fase,
      rodando: ultimoSolo.rodando,
      focusSec: ultimoSolo.focusSec,
      breakSec: ultimoSolo.breakSec,
    }
  }
  if (!ultimo) return null
  return {
    solo: false,
    restante: restanteAgora(),
    fase: ultimo.fase,
    rodando: ultimo.rodando,
    focusSec: ultimo.focusSec,
    breakSec: ultimo.breakSec,
  }
}

/* Os mesmos gestos (play/pause/reset/config) caem no relógio do modo ativo. */
function enviarTimer(acao) {
  soloAtivo() ? socket.emit('solo', { acao }) : socket.emit('timer', { acao })
}

function enviarConfig(focusMin, breakMin) {
  soloAtivo()
    ? socket.emit('solo', { acao: 'config', focusMin, breakMin })
    : socket.emit('config', { focusMin, breakMin })
}

function atualizarSeletorModo() {
  $('btnModoSala').setAttribute('aria-pressed', String(!soloAtivo()))
  $('btnModoSolo').setAttribute('aria-pressed', String(soloAtivo()))
}

$('btnModoSala').onclick = () => soloAtivo() && socket.emit('solo', { acao: 'desativar' })
$('btnModoSolo').onclick = () => !soloAtivo() && socket.emit('solo', { acao: 'ativar' })

socket.on('estadoSolo', (s) => {
  const anterior = ultimoSolo
  deltaSolo = s.agoraServidor - Date.now()
  ultimoSolo = s.ativo ? s : null
  atualizarSeletorModo()
  montarControles()
  if (ultimoSolo) {
    // Virada de fase do MEU sprint: notificação e PiP respondem ao modo ativo.
    avisarPip(anterior?.ativo ? anterior : null, ultimoSolo)
    checarNovoCicloSolo(anterior, ultimoSolo)
  } else {
    avisarPip(null, ultimo) // voltou pro relógio da sala: só redesenha a janelinha
  }
})

/* Novo ciclo de foco SOLO começando: mesmo convite pra escolher tarefa. */
function checarNovoCicloSolo(anterior, s) {
  const fresco = (st) => st?.ativo && st.fase === 'foco' && st.rodando && st.restante === st.focusSec
  if (fresco(s) && !fresco(anterior) && !tarefaAtualId) abrirModalTarefa()
}

setInterval(() => {
  const e = estadoAtivo()
  if (!e || e.restante === null) return

  const m = Math.floor(e.restante / 60)
  const s = e.restante % 60
  $('relogio').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  const rotulo = $('rotuloFase')
  rotulo.textContent = `${e.solo ? 'Solo · ' : ''}${e.fase === 'foco' ? 'Foco' : 'Migalha'}`
  rotulo.classList.toggle('pausa', e.fase === 'pausa')
  rotulo.classList.toggle('parado', !e.rodando)
  rotulo.classList.toggle('solo', e.solo)
  $('proxima').textContent = !e.rodando
    ? 'relógio parado'
    : e.fase === 'foco'
      ? 'até a pausa'
      : 'até o próximo sprint'
  document.title = `${e.rodando ? $('relogio').textContent : 'pausado'} · Pombodoro`
}, 250)

/* ─── PiP: cronômetro flutuante ────────────────────────────── */
/* O pip.js não tem relógio próprio: lê o MESMO restanteAgora() daqui
   (extrapolação sobre o relógio do servidor) e a tarefa marcada no mural.
   A virada de fase chega nele via avisarPip(), lá no handler de 'estado'. */
iniciarPip({
  botao: $('btnPip'),
  obterEstado: () => {
    const e = estadoAtivo()
    if (!e) return null
    return { ...e, tarefa: minhasTarefas.find((t) => t.id === tarefaAtualId)?.texto ?? null }
  },
  // Os botões da janelinha são os MESMOS gestos do header: caem no relógio
  // do modo ativo (sala ou solo) via enviarTimer/enviarConfig.
  acoes: {
    playPause: () => enviarTimer(estadoAtivo()?.rodando ? 'pause' : 'play'),
    reset: () => enviarTimer('reset'),
    duracao: (alvo, delta) => {
      const e = estadoAtivo()
      if (!e) return
      let foco = Math.round(e.focusSec / 60)
      let pausa = Math.round(e.breakSec / 60)
      // Mesmos limites dos sliders da sala.
      if (alvo === 'foco') foco = Math.max(1, Math.min(60, foco + delta))
      else pausa = Math.max(1, Math.min(30, pausa + delta))
      enviarConfig(foco, pausa)
    },
  },
})

/* ─── painéis ──────────────────────────────────────────────── */

/* Play, reset e sliders sempre refletem — e comandam — o modo ATIVO:
   o relógio da sala, ou o sprint solo se o seletor estiver nele. */
function montarControles() {
  const e = estadoAtivo()
  if (!e) return
  // Só re-renderiza o ícone quando o estado muda ('estado' chega toda hora).
  const st = e.rodando ? 'pausa' : 'play'
  if ($('btnPlay').dataset.st !== st) {
    $('btnPlay').dataset.st = st
    $('btnPlay').innerHTML = iconeHtml(st, 24)
    $('btnPlay').title = e.rodando ? 'Pausar' : 'Continuar'
  }

  // Não puxa o slider da mão de quem está arrastando.
  const ativo = document.activeElement
  if (ativo !== $('slFoco')) $('slFoco').value = Math.round(e.focusSec / 60)
  if (ativo !== $('slPausa')) $('slPausa').value = Math.round(e.breakSec / 60)
  $('vFoco').textContent = `${$('slFoco').value}m`
  $('vPausa').textContent = `${$('slPausa').value}m`
}

$('btnPlay').onclick = () => enviarTimer(estadoAtivo()?.rodando ? 'pause' : 'play')
$('btnReset').onclick = () => enviarTimer('reset')

for (const id of ['slFoco', 'slPausa']) {
  $(id).addEventListener('input', () => {
    $('vFoco').textContent = `${$('slFoco').value}m`
    $('vPausa').textContent = `${$('slPausa').value}m`
  })
  // 'change' (soltou o dedo), não 'input': mudar duração reseta o sprint.
  $(id).addEventListener('change', () => enviarConfig(+$('slFoco').value, +$('slPausa').value))
}

function montarPlacar(s) {
  // O placar virou só o top 3, em linha embaixo do cronômetro — o resto
  // do time cada um acompanha pelo próprio indicador no rodapé.
  const top3 = [...s.jogadores].sort((a, b) => b.migalhas - a.migalhas).slice(0, 3)
  $('placarTop3').innerHTML = top3
    .map(
      (j, i) => `<span class="chip-placar ${j.id === eu.id ? 'eu' : ''}">
        <span class="pos">${i + 1}º</span>
        <i class="ponto" style="background:${CRISTAS[j.crista % CRISTAS.length]}"></i>
        <b>${escapar(j.nome)}</b> ${j.migalhas} ${iconeHtml('pao', 14)}
      </span>`
    )
    .join('')

  // Indicador do rodapé: sempre visível, mesmo com a aba de controles fechada.
  const eu2 = s.jogadores.find((j) => j.id === eu.id)
  $('minhasMigalhas').textContent = eu2 ? eu2.migalhas : 0
}

let ultimoMuralTs = null // null = primeira carga; não replica histórico antigo

/* Sem linha do tempo: cada mensagem nova (sistema, recado ou fala) nasce
   flutuando por cima do chat central e some sozinha depois de alguns
   segundos. Fala também sobe como balão sobre a cabeça de quem falou. */
function montarMural(s) {
  if (ultimoMuralTs === null) {
    ultimoMuralTs = s.mural.length ? s.mural[s.mural.length - 1].ts : 0
    return
  }
  for (const m of s.mural) {
    if (m.ts <= ultimoMuralTs) continue
    flutuarMensagem(m)
    if (m.tipo === 'fala' && m.deId) dispararFala(m.deId, m.texto)
  }
  if (s.mural.length) ultimoMuralTs = Math.max(ultimoMuralTs, s.mural[s.mural.length - 1].ts)
}

const MAX_FLUTUANTES = 4

function flutuarMensagem(m) {
  const el = document.createElement('div')
  el.className = `flutuante ${m.tipo}`
  el.innerHTML =
    m.tipo === 'sistema'
      ? escapar(semEmoji(m.texto))
      : m.tipo === 'recado'
        ? `<b>${escapar(m.de)}</b> fez: ${escapar(m.texto)}`
        : `<b>${escapar(m.de)}</b> ${escapar(m.texto)}`
  const caixa = $('flutuantes')
  caixa.append(el)
  while (caixa.children.length > MAX_FLUTUANTES) caixa.firstElementChild.remove()
  setTimeout(() => el.classList.add('sumindo'), 4200)
  setTimeout(() => el.remove(), 5200)
}

function aplicarTravaDoMural(s) {
  const travado = s.fase === 'foco' && s.rodando
  $('inputMural').disabled = travado
  $('btnEnviar').disabled = travado
  $('inputMural').placeholder = travado ? 'O mural abre na pausa' : 'Piar alguma coisa…'
}

/* ─── mural de tarefas ─────────────────────────────────────── */
/* Pessoal: cada pombo só vê e mexe nas próprias tarefas. O servidor manda
   'minhasTarefas' direto pro socket do dono (não é broadcast de sala). */

const TAG_TAREFA = { pendente: 'a fazer', em_andamento: 'em andamento', concluida: 'concluída' }

// Mesmo status agrupado, mas preserva a ordem de criação dentro do grupo
// (Array.sort é estável) — em andamento primeiro, concluída por último.
function ordenarTarefas(lista) {
  const ordem = { em_andamento: 0, pendente: 1, concluida: 2 }
  return [...lista].sort((a, b) => ordem[a.status] - ordem[b.status])
}

function tarefaHtml(t) {
  const botoes = []
  if (t.status === 'concluida') {
    botoes.push(`<button type="button" data-ac="reabrir" title="Reabrir">↺</button>`)
  } else {
    if (t.id !== tarefaAtualId) botoes.push(`<button type="button" data-ac="selecionar" title="Usar nesse ciclo">${iconeHtml('play', 12)}</button>`)
    botoes.push(`<button type="button" data-ac="concluir" title="Marcar concluída">${iconeHtml('check', 12)}</button>`)
  }
  botoes.push(`<button type="button" data-ac="duplicar" title="Duplicar">⧉</button>`)
  botoes.push(`<button type="button" data-ac="excluir" title="Excluir">✕</button>`)
  // Tag e ações lado a lado, numa linha só abaixo do nome — só ícone (grande)
  // + tooltip, pra caber os 3-4 botões sem quebrar linha.
  return `<li class="tarefa status-${t.status}${t.id === tarefaAtualId ? ' atual' : ''}" data-id="${t.id}">
    <span class="txt" data-editar="1" title="Clique pra editar">${escapar(t.texto)}</span>
    <span class="tag">${TAG_TAREFA[t.status]}</span>
    <div class="acoes">${botoes.join('')}</div>
  </li>`
}

function renderTarefas() {
  const ordenada = ordenarTarefas(minhasTarefas)
  $('listaTarefas').innerHTML = ordenada.length
    ? ordenada.map(tarefaHtml).join('')
    : '<li class="tarefa" style="cursor:default">Nenhuma tarefa ainda — adiciona aí em cima</li>'

  const atual = minhasTarefas.find((t) => t.id === tarefaAtualId)
  $('tarefaAtualBox').hidden = !atual
  if (atual) $('tarefaAtualTexto').textContent = atual.texto
}

$('formTarefa').onsubmit = (ev) => {
  ev.preventDefault()
  const texto = $('inputTarefa').value.trim()
  if (!texto) return
  socket.emit('tarefa', { acao: 'criar', texto })
  $('inputTarefa').value = ''
}

$('btnSoltarTarefa').onclick = () => socket.emit('tarefa', { acao: 'soltar' })

$('listaTarefas').onclick = (ev) => {
  const li = ev.target.closest('li[data-id]')
  if (!li) return
  const id = li.dataset.id
  const ac = ev.target.dataset.ac
  if (ac === 'excluir') {
    if (confirm('Excluir essa tarefa?')) socket.emit('tarefa', { acao: 'excluir', id })
  } else if (ac) {
    socket.emit('tarefa', { acao: ac, id })
  } else if (ev.target.dataset.editar) {
    const atual = minhasTarefas.find((t) => t.id === id)
    const novo = prompt('Editar tarefa:', atual?.texto || '')
    if (novo?.trim()) socket.emit('tarefa', { acao: 'editar', id, texto: novo.trim().slice(0, 140) })
  }
}

/* Novo ciclo de foco começando (relógio zerado e disparando): quem ainda
   não tem tarefa selecionada é convidado a escolher uma do mural. */
function checarNovoCiclo(anterior, s) {
  const cicloFresco = (st) => st && st.fase === 'foco' && st.rodando && st.restante === st.focusSec
  if (cicloFresco(s) && !cicloFresco(anterior) && !tarefaAtualId) abrirModalTarefa()
}

function abrirModalTarefa() {
  renderModalTarefa()
  $('modalTarefa').hidden = false
}

function fecharModalTarefa() {
  $('modalTarefa').hidden = true
  $('inputTarefaRapida').value = ''
}

function renderModalTarefa() {
  const disponiveis = minhasTarefas.filter((t) => t.status !== 'concluida')
  $('modalListaTarefas').innerHTML = disponiveis.length
    ? disponiveis
        .map((t) => `<li data-id="${t.id}"><span class="tag">${TAG_TAREFA[t.status]}</span><span>${escapar(t.texto)}</span></li>`)
        .join('')
    : '<li class="vazia">Seu mural está vazio — cria uma tarefa aqui embaixo</li>'
}

$('modalListaTarefas').onclick = (ev) => {
  const li = ev.target.closest('li[data-id]')
  if (li) socket.emit('tarefa', { acao: 'selecionar', id: li.dataset.id })
}

$('formTarefaRapida').onsubmit = (ev) => {
  ev.preventDefault()
  const texto = $('inputTarefaRapida').value.trim()
  if (!texto) return
  pendenteSelecaoRapida = true
  socket.emit('tarefa', { acao: 'criar', texto })
  $('inputTarefaRapida').value = ''
}

$('btnPularTarefa').onclick = () => fecharModalTarefa()

$('btnTarefaConcluida').onclick = () => {
  if (tarefaParaConfirmar) socket.emit('tarefa', { acao: 'concluir', id: tarefaParaConfirmar })
  tarefaParaConfirmar = null
  $('modalConfirmarTarefa').hidden = true
}

$('btnTarefaEmAndamento').onclick = () => {
  tarefaParaConfirmar = null
  $('modalConfirmarTarefa').hidden = true
}

/* ─── interações ───────────────────────────────────────────── */

$('emotes').innerHTML = EMOTES.map((e) => `<button data-e="${e}" title="${EMOTE_ICONES[e]}">${iconeHtml(EMOTE_ICONES[e], 28)}</button>`).join('')
$('emotes').onclick = (ev) => {
  const emoji = ev.target.closest('button[data-e]')?.dataset.e
  if (emoji) socket.emit('emote', { emoji })
}

$('formMural').onsubmit = (ev) => {
  ev.preventDefault()
  const texto = $('inputMural').value.trim()
  if (!texto) return
  socket.emit('mural', { texto })
  $('inputMural').value = ''
}

$('btnLink').onclick = async () => {
  const url = `${location.origin}/r/${codigo}`
  try {
    await navigator.clipboard.writeText(url)
    toast('Convite copiado! Manda pros pombos.')
  } catch {
    prompt('Copie o convite:', url)
  }
}

/* ─── rádio da praça ────────────────────────────────────────── */

let player = null
let playerPronto = false
let radioAtual = null
let tentouDeNovo = null // videoId que já recarreguei depois de um erro passageiro
let mutado = true // autoplay só é permitido mudo; o botão 🔇 libera o som

function iniciarRadio() {
  const tag = document.createElement('script')
  tag.src = 'https://www.youtube.com/iframe_api'
  document.head.append(tag)
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('ytplayer', {
      width: '100%',
      height: '100%',
      playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0 },
      events: {
        onReady: () => {
          player.mute() // autoplay só é permitido mudo; o 🔇/volume libera
          player.setVolume(+(localStorage.getItem('pombodoro-vol') ?? 60))
          playerPronto = true
          sincronizarRadio()
        },
        onStateChange: (e) => {
          const faixa = radioAtual?.fila[radioAtual.indice]
          if (e.data === YT.PlayerState.ENDED && faixa) {
            socket.emit('radio', { acao: 'terminou', videoId: faixa.videoId })
          }
          registrarDuracao()
        },
        // O código do erro vai junto: é ele que decide, no servidor, se a
        // música morre pra sala (removida/embed proibido) ou se foi só o meu
        // navegador tropeçando. Ver decidirPulo() no server.js.
        onError: (e) => {
          const faixa = radioAtual?.fila[radioAtual.indice]
          if (!faixa) return
          const codigo = Number(e?.data) || 0
          // 2 = parâmetro, 5 = player HTML5: costuma ser tropeço do navegador,
          // não defeito da música. Na PRIMEIRA vez nem denuncia a faixa —
          // recarrega e dá uma segunda chance. Importa principalmente pra
          // quem ouve sozinho: ali o quórum do servidor é de um só, então um
          // tropeço bastaria pra pular uma música que estava boa.
          if ((codigo === 2 || codigo === 5) && tentouDeNovo !== faixa.videoId) {
            tentouDeNovo = faixa.videoId
            setTimeout(() => sincronizarRadio(), 1500)
            return
          }
          // Sem conserto, ou já tentei de novo e falhou: aí sim o servidor
          // decide se pula (ver decidirPulo no server.js).
          socket.emit('radio', { acao: 'erro', videoId: faixa.videoId, codigo })
        },
      },
    })
  }
}

/** Alinha o player local ao relógio da sala; corrige drift > 3s. */
function sincronizarRadio() {
  if (!playerPronto || !radioAtual) return
  const faixa = radioAtual.fila[radioAtual.indice]
  if (!faixa) {
    player.stopVideo?.()
    return
  }
  const alvo = radioAtual.tocando
    ? radioAtual.posSec + (Date.now() + deltaRelogio - radioAtual.agora) / 1000
    : radioAtual.posSec

  const carregado = player.getVideoData?.()?.video_id
  if (carregado !== faixa.videoId) {
    radioAtual.tocando ? player.loadVideoById(faixa.videoId, alvo) : player.cueVideoById(faixa.videoId, alvo)
    return
  }
  const drift = Math.abs((player.getCurrentTime?.() || 0) - alvo)
  if (radioAtual.tocando && drift > 3) player.seekTo(alvo, true)
  const st = player.getPlayerState?.()
  if (radioAtual.tocando && st !== YT.PlayerState.PLAYING && st !== YT.PlayerState.BUFFERING) player.playVideo()
  if (!radioAtual.tocando && st === YT.PlayerState.PLAYING) player.pauseVideo()
  registrarDuracao()
}
setInterval(sincronizarRadio, 7000)

// Duração não vem do oEmbed (precisaria de chave da Data API) — então pega
// emprestado do próprio player assim que a faixa carrega. Só cobre o que já
// tocou nesta sessão; o resto mostra "--:--" até chegar a vez dele.
const duracoes = new Map() // videoId -> segundos

function registrarDuracao() {
  if (!playerPronto || !radioAtual) return
  const faixa = radioAtual.fila[radioAtual.indice]
  if (!faixa) return
  const dur = Math.round(player.getDuration?.() || 0)
  if (dur > 0 && duracoes.get(faixa.videoId) !== dur) {
    duracoes.set(faixa.videoId, dur)
    montarRadio(radioAtual)
  }
}

function formatarDuracao(seg) {
  if (!Number.isFinite(seg) || seg <= 0) return '--:--'
  const m = Math.floor(seg / 60)
  const s = Math.floor(seg % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function montarRadio(r) {
  const faixa = r.fila[r.indice]
  const st = r.tocando ? 'pausa' : 'play'
  if ($('rPlay').dataset.st !== st) {
    $('rPlay').dataset.st = st
    $('rPlay').innerHTML = iconeHtml(st, 24)
  }
  $('radioInfo').innerHTML = faixa
    ? `<b>${escapar(faixa.titulo)}</b> · pedida por ${escapar(faixa.de)}`
    : 'Fila vazia — cola um link aí embaixo'
  $('fila').innerHTML = r.fila
    .map((f, i) => {
      const dur = duracoes.get(f.videoId)
      return `<li draggable="true" data-idx="${i}" class="${i === r.indice ? 'atual' : i < r.indice ? 'passada' : ''}">
        ${f.imagem ? `<img src="${f.imagem}" alt="" loading="lazy">` : ''}
        <div class="info">
          <span class="t" data-i="${i}" title="Tocar esta">${escapar(f.titulo)}</span>
          <span class="meta"><span>${escapar(f.de)}</span> <span class="dur">${formatarDuracao(dur)}</span></span>
        </div>
        <button type="button" data-rm="${i}" title="Tirar da fila">✕</button>
      </li>`
    })
    .join('')
}

$('rPlay').onclick = () => socket.emit('radio', { acao: radioAtual?.tocando ? 'pause' : 'play' })
$('rNext').onclick = () => socket.emit('radio', { acao: 'next' })
$('rPrev').onclick = () => socket.emit('radio', { acao: 'prev' })

$('btnSom').onclick = () => {
  if (!playerPronto) return
  mutado = !mutado
  mutado ? player.mute() : player.unMute()
  $('btnSom').innerHTML = iconeHtml(mutado ? 'mudo' : 'som', 24)
}

// Volume é local, como o mudo. Mexer no slider com o som mudo já desmuta —
// a intenção de ouvir está óbvia no gesto.
$('slVol').value = localStorage.getItem('pombodoro-vol') ?? 60
$('slVol').addEventListener('input', () => {
  const v = +$('slVol').value
  localStorage.setItem('pombodoro-vol', v)
  if (!playerPronto) return
  player.setVolume(v)
  if (v > 0 && mutado) {
    mutado = false
    player.unMute()
    $('btnSom').innerHTML = iconeHtml('som', 24)
  } else if (v === 0 && !mutado) {
    mutado = true
    player.mute()
    $('btnSom').innerHTML = iconeHtml('mudo', 24)
  }
})

/* Importação de playlist: enquanto o servidor extrai e valida as músicas
   (até 25 por colada), o campo fica travado pra evitar colada dupla. O
   destrave vem pelo resumo ('radioImport'), por uma recusa ('recusado') ou
   pela queda do socket — o servidor cancela o resto da importação nesse caso. */
let importandoPlaylist = false

function marcarImportando(on) {
  importandoPlaylist = on
  $('inputRadio').disabled = on
  $('btnAddRadio').disabled = on
  $('btnAddRadio').textContent = on ? 'importando…' : '+'
}

socket.on('radioImport', (res = {}) => {
  marcarImportando(false)
  if (res.erro) return toast(res.erro)
  const partes = [`${res.adicionadas} música${res.adicionadas === 1 ? '' : 's'} na fila`]
  if (res.semEmbed) partes.push(`${res.semEmbed} sem permissão de embed`)
  if (res.repetidas) partes.push(`${res.repetidas} já estavam na fila`)
  if (res.filaCheia) partes.push(`${res.filaCheia} não couberam (fila lotada)`)
  if (res.cortadas) partes.push(`${res.cortadas} além do limite de 25 por colada`)
  toast(partes.join(' · '))
})

socket.on('disconnect', () => marcarImportando(false))

$('formRadio').onsubmit = (ev) => {
  ev.preventDefault()
  if (importandoPlaylist) return
  const url = $('inputRadio').value.trim()
  if (!url) return
  socket.emit('radio', { acao: 'add', url })
  // Tem list=? Então é importação de playlist — trava até o servidor responder.
  if (/[?&]list=[\w-]+/.test(url)) marcarImportando(true)
  $('inputRadio').value = ''
}

$('fila').onclick = (ev) => {
  const rm = ev.target.dataset.rm
  const ir = ev.target.dataset.i
  if (rm !== undefined) socket.emit('radio', { acao: 'remover', indice: +rm })
  else if (ir !== undefined) socket.emit('radio', { acao: 'ir', indice: +ir })
}

/* Arrastar pra reordenar: o navegador só anima; quem muda a fila de verdade
   é o servidor (evento 'mover'), porque a ordem é da sala inteira. */
let arrastandoIdx = null

$('fila').addEventListener('dragstart', (ev) => {
  const li = ev.target.closest('li[data-idx]')
  if (!li) return
  arrastandoIdx = +li.dataset.idx
  li.classList.add('arrastando')
  ev.dataTransfer.effectAllowed = 'move'
  ev.dataTransfer.setData('text/plain', li.dataset.idx) // Firefox exige um payload
})

$('fila').addEventListener('dragover', (ev) => {
  if (arrastandoIdx === null) return
  ev.preventDefault() // sem isso o drop nunca dispara
  ev.dataTransfer.dropEffect = 'move'
  const alvo = ev.target.closest('li[data-idx]')
  for (const el of $('fila').children) {
    el.classList.toggle('alvo-drop', el === alvo && +alvo.dataset.idx !== arrastandoIdx)
  }
})

$('fila').addEventListener('drop', (ev) => {
  ev.preventDefault()
  const alvo = ev.target.closest('li[data-idx]')
  if (alvo && arrastandoIdx !== null && +alvo.dataset.idx !== arrastandoIdx) {
    socket.emit('radio', { acao: 'mover', de: arrastandoIdx, para: +alvo.dataset.idx })
  }
})

$('fila').addEventListener('dragend', () => {
  arrastandoIdx = null
  for (const el of $('fila').children) el.classList.remove('alvo-drop', 'arrastando')
})

/* Pombo-correio: o recado de uma linha vira o log de trabalho do time. */
function pedirRecado() {
  const texto = prompt('Pombo-correio — o que você fez nesse sprint?')
  if (texto?.trim()) socket.emit('recado', { texto: texto.trim() })
}

/* ─── utilidades ───────────────────────────────────────────── */

let toastTimer
function toast(msg) {
  const el = $('toast')
  el.textContent = semEmoji(msg)
  el.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (el.hidden = true), 5000)
}

function escapar(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}
