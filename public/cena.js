import { spriteCanvas, CENARIO, CRISTAS } from './sprites.js'

/* A cena é desenhada num canvas lógico de 280x160 e depois ampliada por um
   fator INTEIRO. É isso que mantém o pixel quadrado em qualquer tela.
   Nomes e balões vêm depois, já na resolução real, pra não virarem borrão. */

const LARG = 250
const ALT = 84
const SPRITE = 24 // largura do pombo
const LINHA_CHAO = 62
const ESTACAO = 38 // monitor (15) + pombo (24), encostadinhos
const PASSO_MAX = 46 // com respiro entre um posto e outro

let cv, ctx, off, offCtx
let estado = { fase: 'foco', rodando: false, jogadores: [], meuId: null }

// Os pombos só ficam nos monitores com o relógio RODANDO em foco.
// Foco pausado = todo mundo levanta e espairece.
const trabalhando = () => estado.fase === 'foco' && estado.rodando
const vistas = new Map() // id -> estado de animação, só local
let t = 0

/* controle do próprio pombo */
const teclas = new Set()
const TECLAS_JOGO = new Set(['a', 'd', 'w', 's', 'e', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'])
let aoMover = null // callback pro app.js mandar a posição pro servidor
let ultimoEnvio = 0

const eDigitando = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
const minhaVista = () => vistas.get(estado.meuId)

export function iniciarCena(canvas, cbMover) {
  cv = canvas
  ctx = cv.getContext('2d')
  aoMover = cbMover || null
  off = document.createElement('canvas')
  off.width = LARG
  off.height = ALT
  offCtx = off.getContext('2d')
  redimensionar()
  addEventListener('resize', redimensionar)

  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase()
    if (!TECLAS_JOGO.has(k) || eDigitando()) return
    e.preventDefault()
    if (trabalhando()) return // no foco rodando o pombo está no monitor
    teclas.add(k)
    const v = minhaVista()
    if (!v) return
    // Voo, bicada e soco são one-shot: disparam no keydown e avisam na hora.
    if ((k === 'w' || k === 'arrowup') && v.alt === 0) {
      v.vy = -2.6
      aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: 'pula' })
    }
    if (k === 's' || k === 'arrowdown') {
      v.bicandoAte = performance.now() + 700
      aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: 'bica' })
    }
    if (k === 'e') {
      // O servidor decide quem apanha e devolve o evento 'soco' pra todos.
      aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: 'soco' })
    }
  })
  addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()))
  // Se a janela perde o foco com tecla apertada, o keyup nunca chega.
  addEventListener('blur', () => teclas.clear())

  requestAnimationFrame(quadro)
}

/** Posição de outro jogador vinda do servidor. */
export function aplicarPosRemota({ id, x, dir, acao }) {
  const v = vistas.get(id)
  if (!v) return
  v.rede = { x, dir }
  v.redeEm = performance.now()
  if (acao === 'bica') v.bicandoAte = performance.now() + 700
  if (acao === 'pula' && v.alt === 0) v.vy = -2.6
}

/** Soco vindo do servidor: anima o agressor e derruba as vítimas. */
export function aplicarSoco({ id, x, dir, vitimas = [] }) {
  const agora = performance.now()
  const atacante = vistas.get(id)
  if (atacante) {
    atacante.socandoAte = agora + 450
    if (id !== estado.meuId) {
      atacante.rede = { x, dir }
      atacante.redeEm = agora
    }
  }
  for (const vit of vitimas) {
    const v = vistas.get(vit.id)
    if (!v) continue
    v.tontoAte = agora + 1000
    v.vy = v.alt === 0 ? -1.6 : v.vy // pulinho de impacto
    v.emote = '💫'
    v.emoteAte = agora + 1000
    if (vit.id === estado.meuId) {
      v.x = vit.x // eu fui empurrado — teleporta local, o resto interpola
    } else {
      v.rede = { x: vit.x, dir: v.dir }
      v.redeEm = agora
    }
  }
}

/** Balão de fala sobre a cabeça de quem falou no mural. */
export function dispararFala(id, texto) {
  const v = vistas.get(id)
  if (!v) return
  v.fala = String(texto).slice(0, 64)
  v.falaAte = performance.now() + 4500
}

function redimensionar() {
  const caixa = cv.parentElement.getBoundingClientRect()
  const escala = Math.max(1, Math.floor(Math.min(caixa.width / LARG, caixa.height / ALT)))
  cv.width = LARG * escala
  cv.height = ALT * escala
  cv.style.width = `${LARG * escala}px`
  cv.style.height = `${ALT * escala}px`
  ctx.imageSmoothingEnabled = false
}

export function atualizarCena(novo) {
  estado = { ...estado, ...novo }
  const vivos = new Set(estado.jogadores.map((j) => j.id))
  for (const id of vistas.keys()) if (!vivos.has(id)) vistas.delete(id)
}

export function dispararEmote(id, emoji) {
  const v = vistas.get(id)
  if (v) {
    v.emote = emoji
    v.emoteAte = performance.now() + 2600
  }
}

function vistaDe(j, i) {
  if (!vistas.has(j.id)) {
    // Espalha o ponto de partida pra praça não parecer um pelotão marchando.
    const semente = (i * 2654435761) % 1000
    vistas.set(j.id, {
      x: Number.isFinite(j.x) ? j.x : 20 + (semente % (LARG - 60)),
      alvo: null,
      dir: semente % 2 ? 1 : -1,
      alt: 0, // altura do pulo (negativa = no ar)
      vy: 0,
      andando: false,
      rede: null, // última posição vinda do servidor
      redeEm: 0,
      bicandoAte: 0,
      socandoAte: 0,
      tontoAte: 0,
      fala: null,
      falaAte: 0,
      emote: null,
      emoteAte: 0,
    })
  }
  return vistas.get(j.id)
}

/* Uma fileira só, sempre na linha do chão. Com muita gente os postos vão se
   apertando e os pombos se encostam — é o que a praça faz mesmo. */
function estacao(i) {
  const n = Math.max(estado.jogadores.length, 1)
  const passo = Math.min(PASSO_MAX, (LARG - ESTACAO - 8) / Math.max(n - 1, 1))
  // Centraliza pela largura ocupada de verdade, senão a fileira desliza pra direita.
  const largura = (n - 1) * passo + ESTACAO
  const x0 = (LARG - largura) / 2 + i * passo
  return { x: Math.round(x0), y: LINHA_CHAO }
}

function quadro(agora) {
  t = agora
  desenharCenario()

  const ordenados = [...estado.jogadores]
  // Fileira de trás desenha primeiro pra frente sobrepor.
  const comIndice = ordenados.map((j, i) => ({ j, i, ...(trabalhando() ? estacao(i) : {}) }))
  comIndice.sort((a, b) => (a.y ?? LINHA_CHAO) - (b.y ?? LINHA_CHAO))

  const rotulos = []

  for (const item of comIndice) {
    const { j, i } = item
    const v = vistaDe(j, i)
    let x, y, sprite, espelhar

    if (!j.online) {
      const pos = trabalhando() ? estacao(i) : { x: v.x, y: LINHA_CHAO }
      x = pos.x
      y = pos.y
      sprite = 'dormindo'
      espelhar = false
    } else if (trabalhando()) {
      const pos = estacao(i)
      x = pos.x + 13
      y = pos.y
      sprite = 'sentado'
      espelhar = false
      desenharMonitor(pos.x, pos.y + 2)
    } else {
      // Três fontes de movimento, por prioridade: teclado (meu pombo),
      // servidor (pombo de outra pessoa) ou passeio automático.
      const atordoado = agora < v.tontoAte
      if (atordoado) v.andando = false // quem apanhou não anda, só balança
      else if (j.id === estado.meuId) moverLocal(v, agora)
      else if (v.rede && agora - v.redeEm < 5000) seguirRede(v)
      else passear(v, agora)
      fisica(v)
      x = Math.round(v.x)
      y = LINHA_CHAO + Math.round(v.alt)
      espelhar = v.dir > 0
      if (agora < v.socandoAte) sprite = 'soco'
      else if (atordoado) {
        sprite = 'tonto'
        x += Math.floor(agora / 60) % 2 ? 1 : -1 // tremidinha
      } else if (v.alt < 0) sprite = Math.floor(agora / 90) % 2 ? 'vooCima' : 'vooBaixo'
      else if (agora < v.bicandoAte) sprite = 'bicando'
      else if (v.andando) sprite = Math.floor(agora / 180) % 2 ? 'passo' : 'parado'
      else sprite = 'parado'
    }

    desenharSprite(sprite, x, y, j.corpo, j.crista, espelhar)
    rotulos.push({ j, v, x: x + SPRITE / 2, y })
  }

  // Amplia a cena com fator inteiro; nada de suavização.
  const escala = cv.width / LARG
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, cv.width, cv.height)
  ctx.drawImage(off, 0, 0, cv.width, cv.height)

  for (const r of rotulos) desenharRotulo(r, escala, agora)

  requestAnimationFrame(quadro)
}

function passear(v, agora) {
  v.andando = false
  if (agora < v.bicandoAte) return
  if (v.alvo === null) {
    // Metade das vezes fica parado bicando o chão — pombo é assim.
    if (Math.random() < 0.5) {
      v.bicandoAte = agora + 900 + Math.random() * 1600
      return
    }
    v.alvo = 14 + Math.random() * (LARG - 44)
  }
  const delta = v.alvo - v.x
  if (Math.abs(delta) < 1.5) {
    v.alvo = null
    return
  }
  v.dir = delta > 0 ? 1 : -1
  v.x += v.dir * 0.32
  v.andando = true
}

function moverLocal(v, agora) {
  const esq = teclas.has('a') || teclas.has('arrowleft')
  const dir = teclas.has('d') || teclas.has('arrowright')
  v.andando = false
  if (esq !== dir) {
    v.dir = dir ? 1 : -1
    v.x = Math.max(2, Math.min(LARG - SPRITE - 2, v.x + v.dir * 0.9))
    v.andando = true
  }
  // ~8 envios/s bastam; o lerp do outro lado preenche o resto.
  if (v.andando && aoMover && agora - ultimoEnvio > 120) {
    aoMover({ x: Math.round(v.x), dir: v.dir, acao: 'anda' })
    ultimoEnvio = agora
  }
}

function seguirRede(v) {
  const dx = v.rede.x - v.x
  if (Math.abs(dx) > 0.5) {
    v.x += dx * 0.2
    v.dir = v.rede.dir > 0 ? 1 : -1
    v.andando = Math.abs(dx) > 1
  } else {
    v.andando = false
  }
}

function fisica(v) {
  if (v.vy !== 0 || v.alt < 0) {
    v.alt += v.vy
    v.vy += 0.22
    if (v.alt >= 0) {
      v.alt = 0
      v.vy = 0
    }
  }
}

function desenharCenario() {
  offCtx.clearRect(0, 0, LARG, ALT)
  offCtx.fillStyle = CENARIO.ceu
  offCtx.fillRect(0, 0, LARG, ALT)

  // Sombra elíptica achatada, estilo diorama — os pés pousam DENTRO dela.
  offCtx.fillStyle = CENARIO.chao
  offCtx.beginPath()
  offCtx.ellipse(LARG / 2, LINHA_CHAO + 1, LARG * 0.44, 9, 0, 0, Math.PI * 2)
  offCtx.fill()
  offCtx.fillStyle = CENARIO.chaoLuz
  offCtx.beginPath()
  offCtx.ellipse(LARG / 2, LINHA_CHAO - 1, LARG * 0.41, 6, 0, 0, Math.PI * 2)
  offCtx.fill()
}

function desenharSprite(nome, x, y, corpo, crista, espelhar) {
  const img = spriteCanvas(nome, corpo, crista)
  const px = Math.round(x)
  const py = Math.round(y) - img.height
  if (espelhar) {
    offCtx.save()
    offCtx.translate(px + img.width, py)
    offCtx.scale(-1, 1)
    offCtx.drawImage(img, 0, 0)
    offCtx.restore()
  } else {
    offCtx.drawImage(img, px, py)
  }
}

function desenharMonitor(x, y) {
  const img = spriteCanvas('monitor', 0, 0)
  offCtx.drawImage(img, Math.round(x), Math.round(y) - img.height)
}

function desenharRotulo({ j, v, x, y }, escala, agora) {
  const cx = x * escala
  const base = (y - SPRITE) * escala

  ctx.font = `${Math.max(10, Math.round(3.2 * escala))}px ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'

  const nome = j.nome
  const larguraTexto = ctx.measureText(nome).width
  const padX = 4 * (escala / 4)
  const altura = Math.max(12, 4.5 * escala)
  const topo = base - altura - 4 * (escala / 4)

  ctx.fillStyle = 'rgba(20,20,32,.72)'
  ctx.fillRect(cx - larguraTexto / 2 - padX, topo, larguraTexto + padX * 2, altura)

  ctx.fillStyle = j.online ? '#f2f0e8' : '#8f8fa4'
  ctx.fillText(nome, cx, topo + altura - Math.max(2, escala * 0.6))

  // Ponto colorido da crista = identidade rápida no placar e na praça.
  ctx.fillStyle = CRISTAS[j.crista % CRISTAS.length]
  ctx.fillRect(cx - larguraTexto / 2 - padX + 1, topo, 2 * (escala / 4) || 2, altura)

  if (v.emote && agora < v.emoteAte) {
    const flutuar = Math.sin(agora / 260) * 2 * (escala / 4)
    ctx.font = `${Math.round(5.5 * escala)}px serif`
    ctx.fillText(v.emote, cx + 6 * (escala / 4), topo - 4 * (escala / 4) + flutuar)
  } else if (v.emote) {
    v.emote = null
  }

  if (v.fala && agora < v.falaAte) desenharBalao(v.fala, cx, topo, escala)
  else if (v.fala) v.fala = null
}

/** Balão de fala pixelado: fundo claro, borda escura, rabinho. */
function desenharBalao(texto, cx, topoRotulo, escala) {
  const fonte = Math.max(10, Math.round(3.4 * escala))
  ctx.font = `${fonte}px ui-monospace, monospace`

  // Quebra em até 2 linhas de ~16 colunas.
  const palavras = texto.split(/\s+/)
  const linhas = ['']
  for (const p of palavras) {
    const atual = linhas[linhas.length - 1]
    if ((atual + ' ' + p).trim().length <= 16) linhas[linhas.length - 1] = (atual + ' ' + p).trim()
    else if (linhas.length < 2) linhas.push(p)
    else {
      linhas[1] = linhas[1].slice(0, 14) + '…'
      break
    }
  }

  const largTexto = Math.max(...linhas.map((l) => ctx.measureText(l).width))
  const padX = 5 * (escala / 4)
  const altLinha = fonte + 2
  const alt = linhas.length * altLinha + 8 * (escala / 4)
  const larg = largTexto + padX * 2
  const bx = Math.max(4, Math.min(cv.width - larg - 4, cx - larg / 2))
  const by = topoRotulo - alt - 8 * (escala / 4)

  ctx.fillStyle = '#26201c'
  ctx.fillRect(bx - 2, by - 2, larg + 4, alt + 4)
  ctx.fillStyle = '#fdfbf5'
  ctx.fillRect(bx, by, larg, alt)
  // rabinho
  const rx = Math.max(bx + 4, Math.min(bx + larg - 10, cx - 3))
  ctx.fillStyle = '#26201c'
  ctx.fillRect(rx - 2, by + alt, 10, 4)
  ctx.fillStyle = '#fdfbf5'
  ctx.fillRect(rx, by + alt, 6, 3)

  ctx.fillStyle = '#26201c'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  linhas.forEach((l, i) => ctx.fillText(l, bx + padX, by + 4 * (escala / 4) + i * altLinha))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
}
