import { spriteCanvas, CENARIO, CRISTAS, CORPOS } from './sprites.js'

/* A cena é desenhada num canvas lógico de 280x160 e depois ampliada por um
   fator INTEIRO. É isso que mantém o pixel quadrado em qualquer tela.
   Nomes e balões vêm depois, já na resolução real, pra não virarem borrão. */

// Mundo 640x320 (2:1, mesmo aspecto do fundo.png). O dobro do anterior:
// o pombo fica pequeno diante da cidade e a câmera + zoom exploram o resto.
const LARG = 640
const ALT = 320
const SPRITE = 24 // largura do pombo
const LINHA_CHAO = 270 // meio da faixa de pedra portuguesa (pombos andam 'dentro' da calçada)

let cv, ctx, off, offCtx
let estado = { fase: 'foco', rodando: false, jogadores: [], meuId: null }

// Os pombos só ficam nos monitores com o relógio RODANDO em foco.
// Foco pausado = todo mundo levanta e espairece.
const trabalhando = () => estado.fase === 'foco' && estado.rodando
const vistas = new Map() // id -> estado de animação, só local
let t = 0

/* controle do próprio pombo */
const teclas = new Set()
const TECLAS_JOGO = new Set(['a', 'd', 'w', 's', 'e', ' ', '1', '2', '3', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'])
let ultimoCoco = 0
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

  // Zoom no scroll. Acumula o delta porque trackpad dispara dezenas de
  // eventos minúsculos por gesto — 1 passo a cada ~60 acumulados.
  let acumuloRoda = 0
  cv.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      acumuloRoda += e.deltaY
      if (Math.abs(acumuloRoda) >= 60) {
        ajustarZoom(acumuloRoda < 0 ? 1 : -1)
        acumuloRoda = 0
      }
    },
    { passive: false }
  )

  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase()
    if (eDigitando()) return
    // Zoom funciona sempre, até durante o foco.
    if (k === '+' || k === '=') return ajustarZoom(1)
    if (k === '-' || k === '_') return ajustarZoom(-1)
    if (!TECLAS_JOGO.has(k)) return
    e.preventDefault()
    if (trabalhando()) return // no foco rodando o pombo está no monitor
    teclas.add(k)
    const v = minhaVista()
    if (!v) return
    // Bicada e soco são one-shot. O voo não: é segurar W (empuxo contínuo
    // no moverLocal) — soltou, plana de volta pro chão.
    if (k === 's' || k === 'arrowdown') {
      v.dormindo = false
      v.dancando = false
      v.bicandoLoop = false
      // Em cima de algo? S desce (fura a plataforma). No chão, S bica.
      if (v.vy === 0 && v.alt < -0.5) {
        v.alt += 0.6 // passa pra baixo do topo; a física acha a próxima superfície
        v.vy = 0.3
      } else {
        v.bicandoAte = performance.now() + 700
        aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: 'bica' })
      }
    }
    if (k === 'e') {
      v.dormindo = false
      // O servidor decide quem apanha e devolve o evento 'soco' pra todos.
      aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: 'soco' })
    }
    // Espaço (cocô) é contínuo: tratado no moverLocal enquanto estiver segurando.
    // 1/2/3 são loops infinitos em TOGGLE: um toque liga, outro desliga
    // (mover-se também desliga). Desligar avisa como 'anda'.
    if (k === '1') {
      const liga = !v.dancando
      v.dormindo = false
      v.bicandoLoop = false
      v.dancando = liga
      aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: liga ? 'danca' : 'anda' })
    }
    if (k === '2') {
      const liga = !v.bicandoLoop
      v.dormindo = false
      v.dancando = false
      v.bicandoLoop = liga
      aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: liga ? 'bica2' : 'anda' })
    }
    if (k === '3') {
      const liga = !v.dormindo
      v.dancando = false
      v.bicandoLoop = false
      v.dormindo = liga
      if (liga) v.dormiuEm = performance.now()
      aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: liga ? 'dorme' : 'anda' })
    }
  })
  addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()))
  // Se a janela perde o foco com tecla apertada, o keyup nunca chega.
  addEventListener('blur', () => teclas.clear())

  requestAnimationFrame(quadro)
}

/** Posição de outro jogador vinda do servidor. */
export function aplicarPosRemota({ id, x, dir, alt, acao }) {
  const v = vistas.get(id)
  if (!v) return
  const altNovo = Number.isFinite(alt) ? alt : 0
  // Estável = dois pacotes seguidos na mesma altitude (parado, não voando).
  v.redeEstavel = altNovo === v.redeUltAlt
  v.redeUltAlt = altNovo
  v.rede = { x, dir, alt: altNovo }
  v.redeEm = performance.now()
  if (acao === 'bica') v.bicandoAte = performance.now() + 700
  if (acao === 'bica2') v.bicandoLoop = true
  if (acao === 'danca') v.dancando = true
  if (acao === 'dorme') {
    v.dormindo = true
    v.dormiuEm = performance.now()
  }
  if (acao === 'anda') {
    v.dormindo = false
    v.dancando = false
    v.bicandoLoop = false
  }
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
    v.tontoAte = agora + 1700
    v.dormindo = false
    v.dancando = false
    v.bicandoLoop = false
    // Voando? Despenca. No chão? Capota pra cima e cai estatelado.
    v.vy = v.alt < -1 ? Math.max(v.vy, 2.4) : -1.9
    v.emote = '💫'
    v.emoteAte = agora + 1500
    // Faísca de impacto no ponto do soco.
    for (let i = 0; i < 7; i++) {
      particulas.push({
        x: v.x + SPRITE / 2,
        y: LINHA_CHAO + v.alt - 10,
        vx: (Math.random() - 0.5) * 2.6,
        vy: (Math.random() - 0.5) * 1.8,
        cor: ['#ffffff', '#ffe066', '#f5a623'][i % 3],
        ate: agora + 280,
      })
    }
    if (vit.id === estado.meuId) {
      v.x = vit.x // eu fui empurrado — teleporta local
    } else {
      v.x = vit.x // empurrão é seco de propósito — soco não tem suavização
      v.rede = { x: vit.x, dir: v.dir, alt: 0 }
      v.redeEm = agora
    }
  }
}

/* Pelotas em queda e marcas no chão. Tudo cosmético e local — a decisão
   de quem sujou veio do servidor dentro do evento. */
const pelotas = [] // {x, y, vy, vitimas, aplicado}
const splats = [] // {x, ate}

export function aplicarCoco({ id, x, dir, alt, vitimas = [] }) {
  const agora = performance.now()
  const v = vistas.get(id)
  if (v && id !== estado.meuId) {
    v.rede = { x, dir, alt: alt || 0 }
    v.redeEm = agora
  }
  // Sai do rabo, que fica do lado oposto ao que o pombo olha.
  const rabinho = dir > 0 ? x + 4 : x + SPRITE - 4
  pelotas.push({
    x: rabinho + (Math.random() - 0.5) * 3,
    y: LINHA_CHAO + (alt || 0) - 5,
    vx: (Math.random() - 0.5) * 0.7 - dir * 0.25, // espirra pra trás
    vy: 0.35 + Math.random() * 0.5,
    vitimas,
    aplicado: false,
  })
}

/* Explosão de saída: pixels de sangue voando + mancha que fica (via estado). */
const particulas = []

export function explodirPombo(id, x) {
  const v = vistas.get(id)
  const j = estado.jogadores.find((jj) => jj.id === id)
  const corpo = CORPOS[(j?.corpo || 0) % CORPOS.length]
  const px = (v ? v.x : x) + SPRITE / 2
  const py = LINHA_CHAO + (v ? v.alt : 0) - 9
  // O pombo SOME no instante do estouro — vira só fragmentos.
  if (v) v.explodiu = performance.now()
  // Sangue + pedaços da própria plumagem + faísca.
  const cores = ['#a91f1f', '#7c1212', '#e04040', '#4a0b0b', corpo.l, corpo.m, corpo.d, '#f2a63c']
  for (let i = 0; i < 46; i++) {
    particulas.push({
      x: px + (Math.random() - 0.5) * 6,
      y: py + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 4.4,
      vy: -Math.random() * 3.4 - 0.4,
      tam: 1 + Math.floor(Math.random() * 3),
      cor: cores[i % cores.length],
      ate: performance.now() + 800 + Math.random() * 700,
    })
  }
}

function animarParticulas(agora) {
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i]
    if (agora > p.ate) {
      particulas.splice(i, 1)
      continue
    }
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.18
    if (p.y > LINHA_CHAO + 2) {
      p.y = LINHA_CHAO + 2
      p.vy = 0
      p.vx *= 0.6
    }
    offCtx.fillStyle = p.cor
    const tam = p.tam || 2
    offCtx.fillRect(Math.round(p.x), Math.round(p.y), tam, tam)
  }
}

/** Manchas de sangue no chão (vêm do servidor; secam em 30min). */
function desenharManchas() {
  for (const m of estado.manchas || []) {
    const x = Math.round(m.x) + SPRITE / 2
    offCtx.fillStyle = '#7c1515'
    offCtx.fillRect(x - 6, LINHA_CHAO, 12, 2)
    offCtx.fillRect(x - 2, LINHA_CHAO - 1, 5, 1)
    offCtx.fillStyle = '#5a0e0e'
    offCtx.fillRect(x - 9, LINHA_CHAO + 1, 3, 1)
    offCtx.fillRect(x + 6, LINHA_CHAO + 1, 4, 1)
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
  // O canvas cobre o palco inteiro; a câmera decide o que aparece.
  const caixa = cv.parentElement.getBoundingClientRect()
  cv.width = Math.max(1, Math.round(caixa.width))
  cv.height = Math.max(1, Math.round(caixa.height))
  cv.style.width = '100%'
  cv.style.height = '100%'
  ctx.imageSmoothingEnabled = false
}

/* ─── câmera ───────────────────────────────────────────────── */

const cam = { x: 0, y: 0, ok: false }
let miraCam = null // posição desenhada do MEU pombo neste quadro
let zoomExtra = 0 // passos inteiros ACIMA do mínimo (mínimo = cobre o palco)

/** +1 aproxima, -1 afasta. O piso é o zoom que cobre o palco sem bordas. */
export function ajustarZoom(delta) {
  zoomExtra = Math.max(0, Math.min(8, zoomExtra + delta))
}

function atualizarCamera(viewW, viewH) {
  const cx = miraCam ? miraCam.x : LARG / 2
  const cy = miraCam ? miraCam.y : ALT * 0.7
  const tx = Math.min(Math.max(cx - viewW / 2, 0), Math.max(0, LARG - viewW))
  const ty = Math.min(Math.max(cy - viewH / 2, 0), Math.max(0, ALT - viewH))
  if (!cam.ok) {
    cam.x = tx
    cam.y = ty
    cam.ok = true
    return
  }
  // Persegue com suavização — a câmera "respira" atrás do pombo.
  cam.x += (tx - cam.x) * 0.09
  cam.y += (ty - cam.y) * 0.09
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
      alt: 0, // altura do voo (negativa = no ar)
      vy: 0,
      ultimoAltEnviado: 0,
      andando: false,
      rede: null, // última posição vinda do servidor
      redeEm: 0,
      bicandoAte: 0,
      socandoAte: 0,
      tontoAte: 0,
      dancando: false,
      bicandoLoop: false,
      dormindo: false,
      dormiuEm: 0,
      fala: null,
      falaAte: 0,
      sujoAte: 0,
      emote: null,
      emoteAte: 0,
    })
  }
  return vistas.get(j.id)
}

function quadro(agora) {
  t = agora
  desenharCenario()
  desenharManchas()

  const ordenados = [...estado.jogadores]
  const rotulos = []

  for (let i = 0; i < ordenados.length; i++) {
    const j = ordenados[i]
    if (vistas.get(j.id)?.explodiu) continue // virou fragmentos
    const v = vistaDe(j, i)
    let x, y, sprite, espelhar

    if (!j.online) {
      x = Math.round(v.x)
      espelhar = false
      if (agora < v.tontoAte) {
        // Apanhou dormindo: capota igual a qualquer um.
        hopImpacto(v)
        sprite = v.vy !== 0 ? 'tonto' : 'caido'
        if (v.vy !== 0) espelhar = Math.floor(agora / 80) % 2 === 0
      } else {
        sprite = 'dormindo'
      }
      y = LINHA_CHAO + Math.round(v.alt)
    } else if (trabalhando()) {
      // O foco pega o pombo ONDE ELE ESTÁ — até em cima do muro.
      x = Math.round(v.x)
      y = LINHA_CHAO + Math.round(v.alt)
      const digitando = Math.floor(agora / 280) % 2
      sprite = digitando ? 'sentado2' : 'sentado'
      espelhar = false
      desenharNotebook(x - 11, y + 1, digitando)
    } else {
      // Três fontes de movimento, por prioridade: teclado (meu pombo),
      // servidor (pombo de outra pessoa) ou passeio automático.
      const atordoado = agora < v.tontoAte
      const meu = j.id === estado.meuId
      if (atordoado) v.andando = false // quem apanhou não anda, só balança
      else if (meu) moverLocal(v, agora)
      else if (v.rede) seguirRede(v) // posição conhecida: fica onde o dono deixou
      else {
        passear(v, agora)
        assentar(v) // quem passeia obedece chão e plataformas
      }
      // Física: meu pombo tem gravidade de verdade (voo); os outros seguem
      // a altitude da rede e só quicam no impacto do soco.
      if (meu) fisicaLocal(v)
      else {
        hopImpacto(v)
        // Remoto: "no ar" = altitude em movimento. Parado em cima do banco
        // (alt constante) fica em pose de chão, não batendo asa.
        v.noAr = Math.abs(v.alt - (v.altPrev ?? v.alt)) > 0.15
        v.altPrev = v.alt
      }
      x = Math.round(v.x)
      y = LINHA_CHAO + Math.round(v.alt)
      espelhar = v.dir > 0
      if (agora < v.socandoAte) {
        // Dois tempos: recua engatilhando, depois cruza com avanço.
        const desde = 450 - (v.socandoAte - agora)
        if (desde < 110) {
          sprite = 'parado'
          x += v.dir > 0 ? -2 : 2
        } else {
          sprite = 'soco'
          x += v.dir > 0 ? 3 : -3
        }
      } else if (atordoado) {
        if (v.vy !== 0 || v.alt < alturaDoChaoSob(v.x, v.alt) - 0.5) {
          // No ar depois do soco: cambalhota (espelha rápido).
          sprite = 'tonto'
          espelhar = Math.floor(agora / 80) % 2 === 0
        } else {
          sprite = 'caido' // estatelado de costas até levantar
        }
      } else if (v.noAr) sprite = Math.floor(agora / 90) % 2 ? 'vooCima' : 'vooBaixo'
      else if (v.bicandoLoop || agora < v.bicandoAte) sprite = Math.floor(agora / 130) % 2 ? 'bicando2' : 'bicando'
      else if (v.dormindo) {
        sprite = 'dormindo'
        const desde = agora - (v.dormiuEm || agora)
        if (desde > 2500 && desde % 4200 < 260) x += Math.floor(agora / 50) % 2 ? 1 : -1
      } else if (v.dancando) {
        // Dança: vira de lado no ritmo, com pulinho alternado. Loop infinito.
        sprite = Math.floor(agora / 160) % 2 ? 'passo' : 'parado'
        espelhar = Math.floor(agora / 320) % 2 === 0
        y -= Math.floor(agora / 160) % 2 ? 2 : 0
      } else if (v.andando) sprite = Math.floor(agora / 180) % 2 ? 'passo' : 'parado'
      else sprite = 'parado'
    }

    desenharSprite(sprite, x, y, j.corpo, j.crista, j.acessorio, espelhar)
    if (agora < v.sujoAte) desenharSujeira(x, y)
    if (j.id === estado.meuId) miraCam = { x: x + SPRITE / 2, y: y - 10 }
    rotulos.push({ j, v, x: x + SPRITE / 2, y })
  }

  animarPelotas(agora)
  animarParticulas(agora)

  // Câmera: zoom inteiro que COBRE o palco (sem bordas) e segue o pombo.
  // zoomExtra só aproxima — afastar além do mínimo mostraria borda.
  const escala = Math.max(1, Math.ceil(Math.max(cv.width / LARG, cv.height / ALT))) + zoomExtra
  const viewW = cv.width / escala
  const viewH = cv.height / escala
  atualizarCamera(viewW, viewH)

  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, cv.width, cv.height)
  ctx.setTransform(escala, 0, 0, escala, Math.round(-cam.x * escala), Math.round(-cam.y * escala))
  ctx.drawImage(off, 0, 0)
  ctx.setTransform(1, 0, 0, 1, 0, 0)

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

const TETO = -(LINHA_CHAO - 26) // altura máxima de voo, em px lógicos

/* Plataformas: topo onde dá pra pousar/andar. alt é negativo (acima do chão).
   Todas casam com objetos que JÁ EXISTEM no cenário — nada desenhado por cima.
   Sai da beirada → cai; pousa de cima → fica (one-way, sobe atravessando). */
/* Medidas verificadas VISUALMENTE: overlay das linhas sobre o fundo.png
   (scratchpad, /tmp/colisao-v3.png) até cada linha casar com o pixel real. */
const PLATAFORMAS = [
  { x1: 424, x2: 480, alt: -21 }, // borda da jardineira (o ipê nasce dela)
  { x1: 163, x2: 209, alt: -33 }, // banco de concreto 1
  { x1: 363, x2: 411, alt: -33 }, // banco de concreto 2
  { x1: 613, x2: 629, alt: -42 }, // lixeira verde
  { x1: 110, x2: 134, alt: -56 }, // capacete do orelhão
  { x1: 495, x2: 561, alt: -61 }, // cobertura do ponto de ônibus
  { x1: 26, x2: 94, alt: -66 }, // cúpula da banca de jornal
  { x1: 583, x2: 601, alt: -66 }, // placa de trânsito
  // Muro: SÓ os trechos visíveis, na altura CONFERIDA em recorte ampliado
  // (/tmp/cap-zoom2.png): a borda real é -72. Atrás do coreto, da árvore,
  // da banca e do ponto não há pouso — o capeamento fica escondido.
  { x1: 0, x2: 24, alt: -81 },
  { x1: 96, x2: 108, alt: -81 },
  { x1: 136, x2: 236, alt: -81 },
  { x1: 359, x2: 404, alt: -81 },
  { x1: 562, x2: 582, alt: -81 },
  { x1: 602, x2: 612, alt: -81 },
  { x1: 630, x2: 640, alt: -81 },
  { x1: 283, x2: 305, alt: -96 }, // pico do telhado do coreto (poleiro)
  { x1: 420, x2: 476, alt: -95 }, // copa do ipê roxo
]

/** Superfície mais próxima ABAIXO de quem está em `alt` no ponto x. */
function alturaDoChaoSob(x, alt) {
  const cx = x + SPRITE / 2
  let melhor = 0 // o chão da praça é a plataforma universal
  for (const p of PLATAFORMAS) {
    // Margem interna em plataformas largas: exige apoio de verdade, senão o
    // pombo fica com meio corpo pra fora da beirada, "pendurado no ar".
    const folga = p.x2 - p.x1 > 18 ? 4 : 1
    if (cx < p.x1 + folga || cx > p.x2 - folga) continue
    if (p.alt >= alt - 0.001 && p.alt < melhor) melhor = p.alt
  }
  return melhor
}

function moverLocal(v, agora) {
  const esq = teclas.has('a') || teclas.has('arrowleft')
  const dir = teclas.has('d') || teclas.has('arrowright')
  v.andando = false
  if (esq !== dir) {
    v.dir = dir ? 1 : -1
    // No ar é mais rápido — está voando, não caminhando.
    v.x = Math.max(2, Math.min(LARG - SPRITE - 2, v.x + v.dir * (v.alt < 0 ? 1.3 : 0.9)))
    v.andando = true
  }
  // Segurar W = empuxo contínuo; a gravidade da fisicaLocal faz o resto.
  if (teclas.has('w') || teclas.has('arrowup')) {
    v.vy = Math.max(v.vy - 0.5, -1.7)
  }
  // Mover-se acorda e interrompe qualquer loop de animação.
  if (v.andando || v.vy !== 0) {
    v.dormindo = false
    v.dancando = false
    v.bicandoLoop = false
  }
  // Espaço segurado = JATO de cocô (~12/s; o servidor modera o mural).
  if (teclas.has(' ') && agora - ultimoCoco > 85) {
    ultimoCoco = agora
    v.dormindo = false
    aoMover?.({ x: Math.round(v.x), dir: v.dir, alt: Math.round(v.alt), acao: 'coco' })
  }

  const noAr = v.alt < 0 || v.vy !== 0
  const altRedonda = Math.round(v.alt)
  const precisaAvisar = v.andando || noAr || v.ultimoAltEnviado !== altRedonda
  if (precisaAvisar && aoMover && agora - ultimoEnvio > 120) {
    aoMover({ x: Math.round(v.x), dir: v.dir, alt: altRedonda, acao: 'anda' })
    v.ultimoAltEnviado = altRedonda
    ultimoEnvio = agora
  }
}

/** Superfície (chão ou plataforma) a até `raio` px de `alt` no ponto x. */
function superficieProxima(x, alt, raio) {
  const cx = x + SPRITE / 2
  let melhor = null
  if (Math.abs(alt) <= raio) melhor = 0 // chão
  for (const p of PLATAFORMAS) {
    if (cx < p.x1 + 1 || cx > p.x2 - 1) continue
    const d = Math.abs(p.alt - alt)
    if (d <= raio && (melhor === null || d < Math.abs(melhor - alt))) melhor = p.alt
  }
  return melhor
}

/** Puxa o pombo pra superfície de apoio sob ele (nada de andar no ar). */
function assentar(v) {
  const chao = alturaDoChaoSob(v.x, v.alt - 0.5)
  if (v.alt < chao) v.alt = Math.min(chao, v.alt + 1.4)
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
  // Altitude vem da rede; o lerp deixa a subida/descida suave.
  let altAlvo = v.rede.alt || 0
  // Pombo remoto PARADO no ar (drift ou cliente de versão velha)?
  // Cola na superfície válida mais próxima — ninguém levita na minha tela.
  if (v.redeEstavel) {
    const perto = superficieProxima(v.x, altAlvo, 14)
    if (perto !== null) altAlvo = perto
  }
  if (Math.abs(altAlvo - v.alt) > 0.5) v.alt += (altAlvo - v.alt) * 0.25
  else if (v.vy === 0) v.alt = altAlvo
}

/** Gravidade + empuxo + teto + plataformas: só pro MEU pombo. */
function fisicaLocal(v) {
  const suporte = alturaDoChaoSob(v.x, v.alt)
  const apoiado = v.vy === 0 && Math.abs(v.alt - suporte) < 0.5

  if (apoiado) {
    v.alt = suporte
    v.noAr = false
    return
  }

  const altAntes = v.alt
  v.alt += v.vy
  v.vy += 0.22
  if (v.alt <= TETO) {
    v.alt = TETO
    v.vy = Math.max(v.vy, 0)
  }
  // Caindo e cruzou uma superfície que estava abaixo? Pousou nela.
  const chao = alturaDoChaoSob(v.x, altAntes)
  if (v.vy > 0 && v.alt >= chao) {
    v.alt = chao
    v.vy = 0
  }
  v.noAr = !(v.vy === 0 && Math.abs(v.alt - alturaDoChaoSob(v.x, v.alt)) < 0.5)
}

/** Pombos remotos: só o quique de impacto do soco; altitude vem da rede. */
function hopImpacto(v) {
  if (v.vy !== 0) {
    v.alt += v.vy
    v.vy += 0.22
    if (v.alt >= 0) {
      v.alt = 0
      v.vy = 0
    }
  }
}

/* Cenário urbano gerado (public/fundo.png). Desenhado no canvas lógico de
   250px e depois ampliado com pixel duro — qualquer imagem vira "pixel art"
   na densidade da cena. A calçada da imagem é alinhada à LINHA_CHAO. */
const fundo = new Image()
let fundoOk = false
fundo.onload = () => (fundoOk = true)
fundo.src = '/fundo.png'

function desenharCenario() {
  offCtx.clearRect(0, 0, LARG, ALT)

  if (fundoOk) {
    // Cena e imagem têm o mesmo aspecto 2:1 — full-bleed, sem corte.
    // SEM suavização: o downscale vira vizinho-mais-próximo e o cenário
    // ganha o mesmo grão de pixel dos sprites.
    offCtx.drawImage(fundo, 0, 0, LARG, ALT)
    return
  }

  // Fallback (imagem ainda carregando): o diorama liso de antes.
  offCtx.fillStyle = CENARIO.ceu
  offCtx.fillRect(0, 0, LARG, ALT)
  offCtx.fillStyle = CENARIO.chao
  offCtx.beginPath()
  offCtx.ellipse(LARG / 2, LINHA_CHAO + 1, LARG * 0.44, 9, 0, 0, Math.PI * 2)
  offCtx.fill()
  offCtx.fillStyle = CENARIO.chaoLuz
  offCtx.beginPath()
  offCtx.ellipse(LARG / 2, LINHA_CHAO - 1, LARG * 0.41, 6, 0, 0, Math.PI * 2)
  offCtx.fill()
}

function desenharSprite(nome, x, y, corpo, crista, acessorio, espelhar) {
  const img = spriteCanvas(nome, corpo, crista, acessorio || 0)
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

function desenharNotebook(x, y, quadro) {
  const img = spriteCanvas(quadro ? 'notebook2' : 'notebook', 0, 0)
  offCtx.drawImage(img, Math.round(Math.max(x, -8)), Math.round(y) - img.height)
}

/** Respingos brancos no pombo atingido: cabeça, costas e asa. */
function desenharSujeira(x, y) {
  const px = Math.round(x)
  const py = Math.round(y) - 19 // topo aproximado do sprite
  offCtx.fillStyle = '#c9c2ae' // sombrinha pra ler em plumagem clara
  offCtx.fillRect(px + 7, py + 5, 3, 1)
  offCtx.fillRect(px + 13, py + 10, 2, 1)
  offCtx.fillStyle = '#f8f6ef'
  offCtx.fillRect(px + 7, py + 3, 3, 2)
  offCtx.fillRect(px + 9, py + 5, 2, 2)
  offCtx.fillRect(px + 13, py + 8, 2, 2)
  offCtx.fillRect(px + 6, py + 11, 2, 2)
}

function animarPelotas(agora) {
  for (let i = pelotas.length - 1; i >= 0; i--) {
    const p = pelotas[i]
    p.x += p.vx || 0
    p.y += p.vy
    p.vy += 0.12
    // Na altura da cabeça de quem está embaixo, a sujeira "pega".
    if (!p.aplicado && p.vitimas.length && p.y >= LINHA_CHAO - 16) {
      p.aplicado = true
      for (const id of p.vitimas) {
        const vv = vistas.get(id)
        if (vv) {
          vv.sujoAte = agora + 12000
          vv.emote = '💩'
          vv.emoteAte = agora + 1500
        }
      }
    }
    if (p.y >= LINHA_CHAO - 1) {
      // Cocô no mesmo lugar ACUMULA: a pilha cresce e dura mais.
      const perto = splats.find((s2) => Math.abs(s2.x - p.x) < 7)
      if (perto) {
        perto.quantidade = Math.min(perto.quantidade + 1, 10)
        perto.ate = agora + 20000 + perto.quantidade * 4000
      } else {
        splats.push({ x: p.x, quantidade: 1, ate: agora + 20000 })
      }
      pelotas.splice(i, 1)
      continue
    }
    offCtx.fillStyle = '#f8f6ef'
    offCtx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2)
  }

  for (let i = splats.length - 1; i >= 0; i--) {
    const s = splats[i]
    if (agora > s.ate) {
      splats.splice(i, 1)
      continue
    }
    // Montinho: base cresce com a quantidade, empilhando em pirâmide.
    const q = s.quantidade || 1
    const larg = Math.min(3 + q, 13)
    const altura = 1 + Math.min(Math.floor(q / 2), 4)
    const cx2 = Math.round(s.x)
    offCtx.fillStyle = '#b9b3a0' // sombra da base
    offCtx.fillRect(cx2 - Math.ceil(larg / 2), LINHA_CHAO, larg + 1, 1)
    for (let ry = 0; ry < altura; ry++) {
      const wRow = Math.max(2, Math.round(larg - (ry * larg) / altura))
      offCtx.fillStyle = ry === altura - 1 ? '#f8f6ef' : ry % 2 ? '#e8e4d4' : '#efece0'
      offCtx.fillRect(cx2 - Math.floor(wRow / 2), LINHA_CHAO - 1 - ry, wRow, 1)
    }
  }
}

function desenharRotulo({ j, v, x, y }, escala, agora) {
  // Converte do espaço da cena pro da tela (desconta a câmera).
  const cx = (x - cam.x) * escala
  const base = (y - SPRITE - cam.y) * escala
  if (cx < -80 || cx > cv.width + 80) return // fora da janela

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
    // Nasce estourando (1.5x) e assenta no tamanho cheio — bem maior que antes.
    const restante = v.emoteAte - agora
    const idade = 2600 - restante // emotes duram ~2.6s? usa pop nos primeiros 180ms
    const pop = idade < 180 ? 1.5 - (idade / 180) * 0.5 : 1
    ctx.font = `${Math.round(11 * escala * pop)}px serif`
    ctx.fillText(v.emote, cx + 8 * (escala / 4), topo - 10 * (escala / 4) + flutuar)
  } else if (v.emote) {
    v.emote = null
  }

  if (v.fala && agora < v.falaAte) desenharBalao(v.fala, cx, topo, escala)
  else if (v.fala) v.fala = null

  // zZz do sono: três z's subindo em ciclo, com balanço e fade.
  if (v.dormindo) {
    ctx.textAlign = 'center'
    for (let n = 0; n < 3; n++) {
      const t = (agora / 1000 + n * 0.8) % 2.4
      const sobe = t * 11 * (escala / 4)
      const balanco = Math.sin(t * 4 + n) * 2.5 * (escala / 4)
      ctx.globalAlpha = Math.max(0, 0.9 - t / 2.4)
      ctx.font = `${Math.round((3 + n) * 0.9 * escala)}px ui-monospace, monospace`
      ctx.fillStyle = '#26201c'
      ctx.fillText('z', cx + (8 + n * 3) * (escala / 4) + balanco, topo - 4 * (escala / 4) - sobe)
    }
    ctx.globalAlpha = 1
  }
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
