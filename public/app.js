import { CORPOS, CRISTAS, spriteCanvas } from './sprites.js'
import { iniciarCena, atualizarCena, dispararEmote, aplicarPosRemota, aplicarSoco, dispararFala } from './cena.js'

const $ = (id) => document.getElementById(id)
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
}
const salvarEu = () => localStorage.setItem('pombodoro', JSON.stringify(eu))

const codigo = (() => {
  const daUrl = location.pathname.match(/^\/r\/([A-Z0-9]{1,8})$/i)?.[1]
  if (daUrl) return daUrl.toUpperCase()
  const novo = Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
  history.replaceState(null, '', `/r/${novo}`)
  return novo
})()

/* ─── portaria ─────────────────────────────────────────────── */

$('codigoPreview').textContent = codigo
$('nome').value = eu.nome

function montarCores(container, cores, chave) {
  container.innerHTML = ''
  cores.forEach((cor, i) => {
    const b = document.createElement('button')
    b.style.background = cor
    b.setAttribute('aria-pressed', String(eu[chave] === i))
    b.onclick = () => {
      eu[chave] = i
      montarCores(container, cores, chave)
      desenharPrevia()
    }
    container.append(b)
  })
}

function desenharPrevia() {
  const cv = $('previa')
  const ctx = cv.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, cv.width, cv.height)
  const img = spriteCanvas('sentado', eu.corpo, eu.crista)
  const escala = Math.max(1, Math.floor(Math.min(cv.width / img.width, cv.height / img.height)))
  ctx.drawImage(img, (cv.width - img.width * escala) / 2, (cv.height - img.height * escala) / 2, img.width * escala, img.height * escala)
}

montarCores($('opcoesCrista'), CRISTAS, 'crista')
montarCores($('opcoesCorpo'), CORPOS, 'corpo')
desenharPrevia()

$('btnEntrar').onclick = () => {
  eu.nome = $('nome').value.trim().slice(0, 16) || 'Pombo Anônimo'
  salvarEu()
  $('entrada').hidden = true
  $('praca').hidden = false
  iniciarCena($('cena'), (m) => socket.emit('mover', m))
  socket.emit('entrar', { codigo, ...eu })
}
$('nome').addEventListener('keydown', (e) => e.key === 'Enter' && $('btnEntrar').click())

/* ─── conexão ──────────────────────────────────────────────── */

const socket = io()
let ultimo = null
let deltaRelogio = 0 // relógio do servidor − relógio daqui

socket.on('connect', () => {
  if (!$('praca').hidden) socket.emit('entrar', { codigo, ...eu })
})

socket.on('estado', (s) => {
  deltaRelogio = s.agoraServidor - Date.now()
  ultimo = s
  montarControles(s)
  montarPlacar(s)
  montarMural(s)
  atualizarCena({ fase: s.fase, rodando: s.rodando, jogadores: s.jogadores, meuId: eu.id })
  aplicarTravaDoMural(s)
})

socket.on('emote', ({ id, emoji }) => dispararEmote(id, emoji))
socket.on('pos', (p) => aplicarPosRemota(p))
socket.on('soco', (p) => aplicarSoco(p))
socket.on('recusado', (msg) => toast(msg))

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
