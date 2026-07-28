import { CORPOS, CRISTAS, ACESSORIOS, spriteCanvas } from './sprites.js'
import { iniciarCena, atualizarCena, dispararEmote, aplicarPosRemota, aplicarSoco, aplicarCoco, dispararFala, ajustarZoom, explodirPombo } from './cena.js'

const $ = (id) => document.getElementById(id)
const VERSAO_APP = 15
const EMOTES = ['👍', '🔥', '☕', '😵', '🍞', '🎧']

/* ─── identidade local ─────────────────────────────────────── */

// crypto.randomUUID só existe em contexto seguro (https/localhost) — acessando
// pelo IP da rede ele é undefined e derrubaria o módulo inteiro.
const gerarId = () =>
  crypto.randomUUID?.() ??
  `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const guardado = JSON.parse(localStorage.getItem('pombodoro') || '{}')
const eu = {
  id: guardado.id || gerarId(),
  nome: guardado.nome || '',
  corpo: guardado.corpo ?? 0,
  crista: guardado.crista ?? Math.floor(Math.random() * CRISTAS.length),
  acessorio: guardado.acessorio ?? 0,
}
const salvarEu = () => localStorage.setItem('pombodoro', JSON.stringify(eu))

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
$('nome').value = eu.nome

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
    const img = spriteCanvas('parado', eu.corpo, eu.crista, i)
    cx.drawImage(img, -6, 2, img.width * 1.6, img.height * 1.6)
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

montarCores($('opcoesCrista'), CRISTAS, 'crista')
montarCores($('opcoesCorpo'), CORPOS, 'corpo')
montarAcessorios()
desenharPrevia()

let naPraca = false
let cenaIniciada = false
let radioIniciado = false

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
    iniciarCena($('cena'), (m) => naPraca && socket.emit('mover', m))
  }
  if (!radioIniciado) {
    radioIniciado = true
    iniciarRadio()
  }
  socket.emit('entrar', { codigo, ...eu })
}

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
    ultimaFalaTs = null
    radioAtual = null
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

socket.on('connect', () => {
  if (naPraca) socket.emit('entrar', { codigo, ...eu })
})

socket.on('estado', (s) => {
  // Servidor atualizou? Recarrega já — física velha polui a praça de todo mundo.
  if (s.versao && s.versao !== VERSAO_APP) {
    location.reload()
    return
  }
  deltaRelogio = s.agoraServidor - Date.now()
  ultimo = s
  montarControles(s)
  montarPlacar(s)
  montarMural(s)
  atualizarCena({ fase: s.fase, rodando: s.rodando, jogadores: s.jogadores, manchas: s.manchas, meuId: eu.id })
  aplicarTravaDoMural(s)
  if (s.radio) {
    radioAtual = { ...s.radio, agora: s.agoraServidor }
    montarRadio(s.radio)
    sincronizarRadio()
  }
})

socket.on('emote', ({ id, emoji }) => dispararEmote(id, emoji))
socket.on('pos', (p) => aplicarPosRemota(p))
socket.on('soco', (p) => aplicarSoco(p))
socket.on('coco', (p) => aplicarCoco(p))
socket.on('explodiu', ({ id, x }) => explodirPombo(id, x))
socket.on('recusado', (msg) => toast(msg))
socket.on('sorteado', ({ nome }) => toast(`🎲 Deu ${nome}!`))

socket.on('creditado', ({ ganho, bando, total }) => {
  toast(
    bando > 0
      ? `Sprint fechado! +${ganho} 🍞 (10 base + ${ganho - 10} de bando) · total ${total}`
      : `Sprint fechado! +${ganho} 🍞 · total ${total}`
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

setInterval(() => {
  const r = restanteAgora()
  if (r === null) return

  const m = Math.floor(r / 60)
  const s = r % 60
  $('relogio').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  const rotulo = $('rotuloFase')
  rotulo.textContent = ultimo.fase === 'foco' ? 'Foco' : 'Migalha'
  rotulo.classList.toggle('pausa', ultimo.fase === 'pausa')
  rotulo.classList.toggle('parado', !ultimo.rodando)
  $('proxima').textContent = !ultimo.rodando
    ? 'relógio parado'
    : ultimo.fase === 'foco'
      ? 'até a pausa'
      : 'até o próximo sprint'
  document.title = `${ultimo.rodando ? $('relogio').textContent : '⏸'} · Pombodoro`
}, 250)

/* ─── painéis ──────────────────────────────────────────────── */

function montarControles(s) {
  $('btnPlay').textContent = s.rodando ? '⏸' : '▶'
  $('btnPlay').title = s.rodando ? 'Pausar' : 'Continuar'

  // Não puxa o slider da mão de quem está arrastando.
  const ativo = document.activeElement
  if (ativo !== $('slFoco')) $('slFoco').value = Math.round(s.focusSec / 60)
  if (ativo !== $('slPausa')) $('slPausa').value = Math.round(s.breakSec / 60)
  $('vFoco').textContent = `${$('slFoco').value}m`
  $('vPausa').textContent = `${$('slPausa').value}m`
}

$('btnPlay').onclick = () => socket.emit('timer', { acao: ultimo?.rodando ? 'pause' : 'play' })
$('btnReset').onclick = () => socket.emit('timer', { acao: 'reset' })

for (const id of ['slFoco', 'slPausa']) {
  $(id).addEventListener('input', () => {
    $('vFoco').textContent = `${$('slFoco').value}m`
    $('vPausa').textContent = `${$('slPausa').value}m`
  })
  // 'change' (soltou o dedo), não 'input': mudar duração reseta o sprint da sala.
  $(id).addEventListener('change', () =>
    socket.emit('config', { focusMin: +$('slFoco').value, breakMin: +$('slPausa').value })
  )
}

function montarPlacar(s) {
  $('placar').innerHTML = s.jogadores
    .map(
      (j) => `<li class="${j.online ? '' : 'offline'} ${j.id === eu.id ? 'eu' : ''}">
        <i class="ponto" style="background:${CRISTAS[j.crista % CRISTAS.length]}"></i>
        <span class="nome">${escapar(j.nome)}</span>
        <span class="pts">${j.migalhas} 🍞</span>
      </li>`
    )
    .join('')
}

let ultimaFalaTs = null // null = primeira carga; não replicar balões antigos

function montarMural(s) {
  const el = $('mural')
  const grudado = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  el.innerHTML = s.mural
    .map((m) => {
      if (m.tipo === 'sistema') return `<div class="sistema">${escapar(m.texto)}</div>`
      if (m.tipo === 'recado') return `<div class="recado"><b>${escapar(m.de)}</b> fez: ${escapar(m.texto)}</div>`
      return `<div><b>${escapar(m.de)}</b> ${escapar(m.texto)}</div>`
    })
    .join('')
  if (grudado) el.scrollTop = el.scrollHeight

  // Falas novas viram balão sobre o pombo de quem falou.
  const falas = s.mural.filter((m) => m.tipo === 'fala' && m.deId)
  if (ultimaFalaTs === null) {
    ultimaFalaTs = falas.length ? falas[falas.length - 1].ts : 0
  } else {
    for (const m of falas) {
      if (m.ts > ultimaFalaTs) dispararFala(m.deId, m.texto)
    }
    if (falas.length) ultimaFalaTs = Math.max(ultimaFalaTs, falas[falas.length - 1].ts)
  }
}

function aplicarTravaDoMural(s) {
  const travado = s.fase === 'foco' && s.rodando
  $('inputMural').disabled = travado
  $('btnEnviar').disabled = travado
  $('inputMural').placeholder = travado ? 'O mural abre na pausa 🔒' : 'Piar alguma coisa…'
}

/* ─── interações ───────────────────────────────────────────── */

$('emotes').innerHTML = EMOTES.map((e) => `<button data-e="${e}">${e}</button>`).join('')
$('emotes').onclick = (ev) => {
  const emoji = ev.target.dataset.e
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
    toast('Convite copiado! Manda pros pombos. 🔗')
  } catch {
    prompt('Copie o convite:', url)
  }
}

/* ─── rádio da praça ────────────────────────────────────────── */

let player = null
let playerPronto = false
let radioAtual = null
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
        },
        onError: () => {
          const faixa = radioAtual?.fila[radioAtual.indice]
          if (faixa) socket.emit('radio', { acao: 'erro', videoId: faixa.videoId })
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
}
setInterval(sincronizarRadio, 7000)

function montarRadio(r) {
  const faixa = r.fila[r.indice]
  $('rPlay').textContent = r.tocando ? '⏸' : '▶'
  $('radioInfo').innerHTML = faixa
    ? `<b>${escapar(faixa.titulo)}</b> · pedida por ${escapar(faixa.de)}`
    : 'Fila vazia — cola um link aí 👇'
  $('fila').innerHTML = r.fila
    .map(
      (f, i) => `<li class="${i === r.indice ? 'atual' : i < r.indice ? 'passada' : ''}">
        <span class="t" data-i="${i}" title="Tocar esta">${escapar(f.titulo)}</span>
        <small>${escapar(f.de)}</small>
        <button type="button" data-rm="${i}" title="Tirar da fila">✕</button>
      </li>`
    )
    .join('')
}

$('rPlay').onclick = () => socket.emit('radio', { acao: radioAtual?.tocando ? 'pause' : 'play' })
$('rNext').onclick = () => socket.emit('radio', { acao: 'next' })
$('rPrev').onclick = () => socket.emit('radio', { acao: 'prev' })

$('btnSom').onclick = () => {
  if (!playerPronto) return
  mutado = !mutado
  mutado ? player.mute() : player.unMute()
  $('btnSom').textContent = mutado ? '🔇' : '🔊'
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
    $('btnSom').textContent = '🔊'
  } else if (v === 0 && !mutado) {
    mutado = true
    player.mute()
    $('btnSom').textContent = '🔇'
  }
})

$('formRadio').onsubmit = (ev) => {
  ev.preventDefault()
  const url = $('inputRadio').value.trim()
  if (!url) return
  socket.emit('radio', { acao: 'add', url })
  $('inputRadio').value = ''
}

$('fila').onclick = (ev) => {
  const rm = ev.target.dataset.rm
  const ir = ev.target.dataset.i
  if (rm !== undefined) socket.emit('radio', { acao: 'remover', indice: +rm })
  else if (ir !== undefined) socket.emit('radio', { acao: 'ir', indice: +ir })
}

/* Pombo-correio: o recado de uma linha vira o log de trabalho do time. */
function pedirRecado() {
  const texto = prompt('🕊️ Pombo-correio — o que você fez nesse sprint?')
  if (texto?.trim()) socket.emit('recado', { texto: texto.trim() })
}

/* ─── utilidades ───────────────────────────────────────────── */

let toastTimer
function toast(msg) {
  const el = $('toast')
  el.textContent = msg
  el.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (el.hidden = true), 5000)
}

function escapar(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}
