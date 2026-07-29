import { spriteCanvas, CRISTAS, CORPOS, PALETA, CABECA } from './sprites.js'
import { pintarEmCanvas, niveisEm, LARG, ALT, CHAO } from './cenario.js'
import { EMOTE_ICONES, iconeCanvas } from './icones.js'

/* A cena é desenhada num canvas lógico de 640x320 e depois ampliada por um
   fator INTEIRO. É isso que mantém o pixel quadrado em qualquer tela.
   Nomes e balões vêm depois, já na resolução real, pra não virarem borrão.

   O cenário vem do cenario.js, desenhado pixel a pixel NESTA resolução —
   mesma densidade e mesma paleta chapada dos sprites. Era um PNG grande
   reamostrado, e é por isso que os pombos pareciam colados: pixel borrado
   por baixo, pixel duro por cima. */

const SPRITE = 36 // largura do pombo (grade 36x34)
const LINHA_CHAO = CHAO // meio da faixa de pedra portuguesa

const SUJEIRA_MAX = 5 // nível máximo de cobertura — o pombo continua visível sob o cocô
const SUJO_MS = 5000 // cada acerto deixa sujo por 5s; depois disso o pombo fica limpo

const COCO_MONTE_MAX = 80 // monte BEM grande: acumula bastante antes de parar de crescer
const COCO_VIDA_CHEIA_MS = 60000 // fica sólido por 1 minuto
const COCO_FADE_MS = 15000 // depois começa a sumir aos poucos, ao longo de 15s

/* Canto superior-esquerdo do olho (coluna, linha) por pose, pra desenhar a
   pálpebra fechando (bloco K de 4x3 sobre o olho de 4x4) na piscada. Só nas
   poses com olho aberto de verdade; dormindo/caído/tonto/traga/bebendo já
   têm estado ocular próprio e ficam de fora. */
const OLHO = {
  parado: [6, 7], parado2: [6, 8],
  passo: [6, 9], passo2: [6, 8], passo3: [6, 9], passo4: [6, 7],
  sentado: [6, 9], sentado2: [6, 10], sentado3: [6, 9],
  socoPrep: [7, 9], soco: [5, 8], soco2: [6, 8],
  vooCima: [6, 7], vooMeio: [6, 7], vooBaixo: [6, 6],
  fumando: [7, 7], fumando2: [7, 7],
  cafeSegurando: [8, 7], cafeEnchendo: [8, 7],
}

let cv, ctx, off, offCtx
let estado = { fase: 'foco', rodando: false, jogadores: [], meuId: null }

// Os pombos só ficam nos monitores com o relógio RODANDO em foco.
// Foco pausado = todo mundo levanta e espairece.
const trabalhando = () => estado.fase === 'foco' && estado.rodando
const vistas = new Map() // id -> estado de animação, só local
let t = 0

/* controle do próprio pombo */
const teclas = new Set()
const TECLAS_JOGO = new Set(['a', 'd', 'w', 's', 'e', ' ', '1', '2', '3', '4', '5', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'])
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
      v.fumando = false
      v.cafe = false
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
      v.fumando = false
      v.cafe = false
      v.dancando = liga
      aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: liga ? 'danca' : 'anda' })
    }
    if (k === '2') {
      const liga = !v.bicandoLoop
      v.dormindo = false
      v.dancando = false
      v.fumando = false
      v.cafe = false
      v.bicandoLoop = liga
      aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: liga ? 'bica2' : 'anda' })
    }
    if (k === '3') {
      const liga = !v.dormindo
      v.dancando = false
      v.bicandoLoop = false
      v.fumando = false
      v.cafe = false
      v.dormindo = liga
      if (liga) v.dormiuEm = performance.now()
      aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: liga ? 'dorme' : 'anda' })
    }
    // 4 (cigarro) e 5 (café) são loops que SOBREVIVEM a andar/voar — só
    // desligam apertando a tecla de novo. Por isso usam ações próprias de
    // início/fim (fuma/fuma-fim, cafe/cafe-fim) em vez de reaproveitar
    // 'anda': o 'anda' comum (emitido a cada passo) não pode apagar o estado.
    if (k === '4') {
      const liga = !v.fumando
      v.dormindo = false
      v.dancando = false
      v.bicandoLoop = false
      v.cafe = false
      v.fumando = liga
      if (liga) v.fumaInicioEm = performance.now()
      aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: liga ? 'fuma' : 'fuma-fim' })
    }
    if (k === '5') {
      const liga = !v.cafe
      v.dormindo = false
      v.dancando = false
      v.bicandoLoop = false
      v.fumando = false
      v.cafe = liga
      if (liga) v.cafeInicioEm = performance.now()
      aoMover?.({ x: Math.round(v.x), dir: v.dir, acao: liga ? 'cafe' : 'cafe-fim' })
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
  // Cigarro e café têm início/fim próprios (não usam 'anda') justamente pra
  // sobreviver ao andar/voar do dono — remoto precisa da mesma regra.
  if (acao === 'fuma') {
    v.fumando = true
    v.fumaInicioEm = performance.now()
    v.cafe = false
  }
  if (acao === 'fuma-fim') v.fumando = false
  if (acao === 'cafe') {
    v.cafe = true
    v.cafeInicioEm = performance.now()
    v.fumando = false
  }
  if (acao === 'cafe-fim') v.cafe = false
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
        y: LINHA_CHAO + v.alt - 14,
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
  const rabinho = dir > 0 ? x + 5 : x + SPRITE - 5
  pelotas.push({
    x: rabinho + (Math.random() - 0.5) * 3,
    y: LINHA_CHAO + (alt || 0) - 8,
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
  const py = LINHA_CHAO + (v ? v.alt : 0) - 13
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

/* Fumaça: fiapos finos + baforada maior (mais partículas, mais dispersão)
   toda vez que solta o ar. Sobe, se espalha lateralmente e desmancha —
   puramente cosmético e local. Compartilhada entre cigarro e vapor de café. */
const fumaca = []

function emitirFumaca(x, y, baforada) {
  const n = baforada ? 7 : 1
  const agora = performance.now()
  for (let i = 0; i < n; i++) {
    const vida = baforada ? 900 + Math.random() * 600 : 650 + Math.random() * 350
    fumaca.push({
      x: x + (Math.random() - 0.5) * (baforada ? 5 : 1.5),
      y: y + (Math.random() - 0.5) * 2,
      vx: (Math.random() - 0.5) * (baforada ? 0.6 : 0.22),
      vy: -(baforada ? 0.4 + Math.random() * 0.35 : 0.22 + Math.random() * 0.18),
      tam: baforada ? 1 + Math.floor(Math.random() * 2) : 1,
      nasceu: agora,
      ate: agora + vida,
    })
  }
}

function animarFumaca(agora) {
  for (let i = fumaca.length - 1; i >= 0; i--) {
    const p = fumaca[i]
    if (agora > p.ate) {
      fumaca.splice(i, 1)
      continue
    }
    p.x += p.vx
    p.y += p.vy
    p.vy -= 0.004 // fumaça é mais leve que ar: acelera um pouco pra cima
    p.vx += (Math.random() - 0.5) * 0.035 // dispersão lateral
    const vida = (p.ate - agora) / (p.ate - p.nasceu)
    offCtx.globalAlpha = Math.max(0, vida) * 0.5
    offCtx.fillStyle = '#d8d4c8'
    offCtx.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam)
  }
  offCtx.globalAlpha = 1
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
      fumando: false,
      fumaInicioEm: 0,
      fumaFase: 'idle',
      fumaUltimoWisp: 0,
      cafe: false,
      cafeInicioEm: 0,
      cafeUltimoWisp: 0,
      fala: null,
      falaAte: 0,
      sujoAte: 0,
      sujeira: 0, // nível de cocô acumulado (1..SUJEIRA_MAX), desenhado por cima do sprite
      piscarAte: 0,
      piscarProximoEm: performance.now() + 1200 + Math.random() * 4000,
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
        sprite = Math.floor(agora / 1100) % 2 ? 'dormindo2' : 'dormindo'
      }
      y = LINHA_CHAO + Math.round(v.alt)
    } else if (trabalhando()) {
      // O foco pega o pombo ONDE ELE ESTÁ — até em cima do muro.
      x = Math.round(v.x)
      y = LINHA_CHAO + Math.round(v.alt)
      // Digitação em 4 tempos: repouso → teclado → meio → teclado.
      const fase = Math.floor(agora / 200) % 4
      sprite = ['sentado', 'sentado2', 'sentado3', 'sentado2'][fase]
      espelhar = false
      desenharNotebook(x - 16, y + 1, Math.floor(agora / 400) % 2)
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
        // Três tempos: engatilha (asa atrás), cruza com avanço, recolhe.
        const desde = 450 - (v.socandoAte - agora)
        if (desde < 120) {
          sprite = 'socoPrep'
          x += v.dir > 0 ? -3 : 3
        } else if (desde < 320) {
          sprite = 'soco'
          x += v.dir > 0 ? 4 : -4
        } else {
          sprite = 'soco2'
          x += v.dir > 0 ? 1 : -1
        }
      } else if (atordoado) {
        if (v.vy !== 0 || v.alt < alturaDoChaoSob(v.x, v.alt) - 0.5) {
          // No ar depois do soco: cambalhota (espelha rápido).
          sprite = 'tonto'
          espelhar = Math.floor(agora / 80) % 2 === 0
        } else {
          sprite = 'caido' // estatelado de costas até levantar
        }
      } else if (v.fumando) {
        // Cigarro e café ficam ANTES do voo/passo de propósito: precisam
        // continuar de pé mesmo andando ou voando — só a tecla desliga.
        // Ciclo de ~3.2s: a maior parte é baforada tranquila (brasa piscando),
        // com uma tragada funda no fim que solta a nuvem de fumaça.
        const desde = agora - (v.fumaInicioEm || agora)
        const ciclo = desde % 3200
        const tragando = ciclo < 500
        sprite = tragando ? 'fumandoTraga' : Math.floor(agora / 480) % 2 ? 'fumando2' : 'fumando'
        // Ponta do cigarro pendurado: canto inferior do bico (x0,y12 na grade).
        const pontaX = x + (espelhar ? SPRITE - 1 : 0)
        const pontaY = y - 22
        if (tragando) {
          v.fumaFase = 'traga'
        } else if (v.fumaFase === 'traga') {
          v.fumaFase = 'idle'
          emitirFumaca(pontaX, pontaY, true) // baforada funda ao soltar a fumaça
        }
        if (!tragando && agora - v.fumaUltimoWisp > 420) {
          v.fumaUltimoWisp = agora
          emitirFumaca(pontaX, pontaY, false)
        }
      } else if (v.cafe) {
        // Ciclo de ~3.6s: maioria segurando a caneca (vapor leve); a cada
        // 3 ciclos, em vez de um golinho rápido, reabastece com a térmica.
        const CICLO_CAFE = 3600
        const desde = agora - (v.cafeInicioEm || agora)
        const numCiclo = Math.floor(desde / CICLO_CAFE)
        const noCiclo = desde % CICLO_CAFE
        const reabastecendo = numCiclo % 3 === 2
        const duracaoAcao = reabastecendo ? 900 : 480
        const emAcao = noCiclo < duracaoAcao
        sprite = emAcao ? (reabastecendo ? 'cafeEnchendo' : 'cafeBebendo') : 'cafeSegurando'
        const canecaX = x + (espelhar ? SPRITE - 2 : 1)
        const canecaY = y - 24 // boca da caneca (y10 na grade de 34)
        if (reabastecendo && emAcao) desenharTermica(canecaX, canecaY, espelhar)
        if (!emAcao && agora - v.cafeUltimoWisp > 500) {
          v.cafeUltimoWisp = agora
          emitirFumaca(canecaX, canecaY, false) // vapor do café — mesmo sistema da fumaça
        }
      } else if (v.noAr) {
        // Batida completa: cima → meio → baixo → meio (o meio amortece).
        sprite = ['vooCima', 'vooMeio', 'vooBaixo', 'vooMeio'][Math.floor(agora / 90) % 4]
      } else if (v.bicandoLoop || agora < v.bicandoAte) {
        // Bicada em 3 tempos: antecipação → golpe no chão → recuperação.
        sprite = ['bicando', 'bicando2', 'bicando3'][Math.floor(agora / 130) % 3]
      } else if (v.dormindo) {
        sprite = Math.floor(agora / 1100) % 2 ? 'dormindo2' : 'dormindo' // respiração lenta
        const desde = agora - (v.dormiuEm || agora)
        if (desde > 2500 && desde % 4200 < 260) x += Math.floor(agora / 50) % 2 ? 1 : -1
      } else if (v.dancando) {
        // Dança: vira de lado no ritmo, com pulinho alternado. Loop infinito.
        sprite = Math.floor(agora / 160) % 2 ? 'passo' : 'parado'
        espelhar = Math.floor(agora / 320) % 2 === 0
        y -= Math.floor(agora / 160) % 2 ? 2 : 0
      } else if (v.andando) {
        // Ciclo de 4 quadros: contato, sobe, cruza, sobe do outro lado.
        sprite = ['passo', 'passo2', 'passo3', 'passo4'][Math.floor(agora / 140) % 4]
      } else {
        sprite = Math.floor(agora / 1600) % 2 ? 'parado2' : 'parado' // idle respira
      }
    }

    // Pisca aleatório: cada pombo tem seu próprio relógio de piscada.
    if (agora > v.piscarProximoEm) {
      v.piscarAte = agora + 110 + Math.random() * 50
      v.piscarProximoEm = agora + 1800 + Math.random() * 4500
    }
    const piscando = agora < v.piscarAte

    if (agora >= v.sujoAte && v.sujeira) v.sujeira = 0 // sujeira expirou: limpou de vez

    desenharSombra(v.x, v.alt)

    desenharSprite(sprite, x, y, j.corpo, j.crista, j.acessorio, espelhar, piscando)
    // Sujeira é OVERLAY: o pombo nunca some — os respingos escalam com o nível.
    if (agora < v.sujoAte && v.sujeira) desenharSujeira(x, y, v.sujeira, espelhar, agora, sprite)
    if (j.id === estado.meuId) miraCam = { x: x + SPRITE / 2, y: y - 10 }
    rotulos.push({ j, v, x: x + SPRITE / 2, y })
  }

  animarPelotas(agora)
  animarParticulas(agora)
  animarFumaca(agora)

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

const TETO = -(LINHA_CHAO - 44) // altura máxima de voo, em px lógicos (sprite de 34 cabe)

/* ── colisão ─────────────────────────────────────────────────────────────
   Não existe mais tabela de plataformas escrita à mão. O cenario.js registra
   cada topo pisável na MESMA linha em que pinta o pixel, e entrega isso por
   coluna: `niveisEm(x)` devolve as altitudes com apoio naquele x, ordenadas
   de cima pra baixo, sempre terminando em 0 (a calçada). O que dá pra pisar
   é, literalmente, o que está desenhado — não tem como desalinhar.

   Consulta é O(1) na coluna (1 a 4 níveis cada), em vez de varrer uma lista
   de plataformas a cada pombo a cada quadro.

   Apoio é medido no CENTRO DAS PATAS, não no centro do sprite: as patas
   ficam nas colunas 10..18 do sprite de 36px. Isso é o que faz o pombo poder
   ficar na beiradinha do banco — como pombo de verdade fica — e cair no
   instante em que os pés passam da quina. */
const PE = 14

const colunaDe = (x) => niveisEm(x + PE)

/** Superfície mais próxima ABAIXO de quem está em `alt` no ponto x. */
function alturaDoChaoSob(x, alt) {
  const col = colunaDe(x)
  for (let i = 0; i < col.length; i++) if (col[i] >= alt - 0.001) return col[i]
  return 0
}

/* Degrau que o pombo sobe andando. Sem isso, subir a água do telhado do
   coreto (que sobe ~1px a cada 2px) faria ele despencar em vez de escalar. */
const DEGRAU = 3.2

/** Superfície que SUSTENTA quem está em `alt` — a mesma em que já pisa ou um
    degrau curto acima. `null` = não tem nada sob as patas, ou seja: queda. */
function apoioSob(x, alt) {
  const col = colunaDe(x)
  let melhor = null
  for (const v of col) {
    const d = alt - v // > 0 = nível acima do pombo (degrau pra subir)
    if (d < -0.5 || d > DEGRAU) continue
    if (melhor === null || Math.abs(alt - v) < Math.abs(alt - melhor)) melhor = v
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
  // Mover-se acorda e interrompe a maioria dos loops — MENOS cigarro/café,
  // que continuam pitados enquanto anda ou voa (só a própria tecla desliga).
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

/** Superfície a até `raio` px de `alt` no ponto x — pra colar pombo remoto
    que ficou boiando (drift de rede ou cliente de versão velha). */
function superficieProxima(x, alt, raio) {
  const col = colunaDe(x)
  let melhor = null
  for (const v of col) {
    const d = Math.abs(v - alt)
    if (d <= raio && (melhor === null || d < Math.abs(melhor - alt))) melhor = v
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

/** Gravidade + empuxo + teto + superfícies: só pro MEU pombo. */
function fisicaLocal(v) {
  // Pisando: cola na superfície de apoio (subindo degrau curto, se houver).
  if (v.vy === 0) {
    const apoio = apoioSob(v.x, v.alt)
    if (apoio !== null) {
      v.alt = apoio
      v.noAr = false
      return
    }
  }

  const altAntes = v.alt
  v.alt += v.vy
  v.vy += 0.22
  if (v.alt <= TETO) {
    v.alt = TETO
    v.vy = Math.max(v.vy, 0)
  }
  // Caindo e cruzou uma superfície que estava abaixo? Pousou nela. Subindo,
  // atravessa: toda superfície aqui é one-way, como manda o gênero.
  const chao = alturaDoChaoSob(v.x, altAntes)
  if (v.vy > 0 && v.alt >= chao) {
    v.alt = chao
    v.vy = 0
  }
  v.noAr = !(v.vy === 0 && apoioSob(v.x, v.alt) !== null)
}

/** Pombos remotos: só o quique de impacto do soco; altitude vem da rede.
    Quem apanhou em cima do banco cai de volta no banco, não atravessa até
    a calçada. */
function hopImpacto(v) {
  if (v.vy !== 0) {
    const antes = v.alt
    v.alt += v.vy
    v.vy += 0.22
    const chao = alturaDoChaoSob(v.x, antes)
    if (v.vy > 0 && v.alt >= chao) {
      v.alt = chao
      v.vy = 0
    }
  }
}

/* A praça é pintada UMA vez, num canvas de 640x320, e depois só copiada.
   São alguns milhares de fillRect de 1px — de graça uma vez, caro sessenta
   vezes por segundo. É esse mesmo passe que monta o mapa de colisão. */
const cenario = document.createElement('canvas')
cenario.width = LARG
cenario.height = ALT
pintarEmCanvas(cenario.getContext('2d'))

function desenharCenario() {
  // Cobre o quadro inteiro: não precisa limpar antes.
  offCtx.drawImage(cenario, 0, 0)
}

/** Sombra do pombo na superfície embaixo dele. Some conforme sobe. É o que
    prende o bicho no chão — sem ela, sprite chapado sobre fundo chapado
    sempre parece adesivo. */
function desenharSombra(x, alt) {
  const chao = alturaDoChaoSob(x, alt)
  const queda = chao - alt // px até a superfície
  if (queda > 44) return
  const perto = 1 - queda / 44
  const larg = Math.round(6 + 10 * perto)
  offCtx.globalAlpha = 0.1 + 0.2 * perto
  offCtx.fillStyle = '#2b2a2e'
  offCtx.fillRect(Math.round(x + PE - larg / 2), LINHA_CHAO + chao, larg, 1)
  if (perto > 0.6) offCtx.fillRect(Math.round(x + PE - larg / 2) + 2, LINHA_CHAO + chao + 1, larg - 4, 1)
  offCtx.globalAlpha = 1
}

function desenharSprite(nome, x, y, corpo, crista, acessorio, espelhar, piscando) {
  const img = spriteCanvas(nome, corpo, crista, acessorio || 0)
  const px = Math.round(x)
  const py = Math.round(y) - img.height
  // Pisca: apaga o pixel do olho com a cor de contorno, igual ao truque que
  // o sprite 'dormindo' já usa pra pálpebra fechada — dentro da MESMA
  // transformação, senão o espelhamento (pombo virado pra direita) erraria o lado.
  const olho = piscando && OLHO[nome]
  if (espelhar) {
    offCtx.save()
    offCtx.translate(px + img.width, py)
    offCtx.scale(-1, 1)
    offCtx.drawImage(img, 0, 0)
    if (olho) {
      offCtx.fillStyle = PALETA.K
      offCtx.fillRect(olho[0], olho[1], 4, 3) // pálpebra cobre o olho 4x4, sobra a fresta de baixo
    }
    offCtx.restore()
  } else {
    offCtx.drawImage(img, px, py)
    if (olho) {
      offCtx.fillStyle = PALETA.K
      offCtx.fillRect(px + olho[0], py + olho[1], 4, 3)
    }
  }
}

function desenharNotebook(x, y, quadro) {
  const img = spriteCanvas(quadro ? 'notebook2' : 'notebook', 0, 0)
  offCtx.drawImage(img, Math.round(Math.max(x, -10)), Math.round(y) - img.height)
}

/** Garrafa térmica: só aparece no instante de reabastecer a caneca de café.
    Recebe a posição da BOCA da caneca e paira logo acima, despejando. */
function desenharTermica(x, y, espelhar) {
  const img = spriteCanvas('termica', 0, 0)
  const px = Math.round(x) - (espelhar ? img.width - 2 : 2)
  const py = Math.round(y) - img.height - 8
  offCtx.drawImage(img, px, py)
}

/* ── sujeira de cocô ──────────────────────────────────────────────────────
   Respingos desenhados POR CIMA do sprite (o pombo nunca some), na mesma
   grade de 36×34, sprite olhando pra esquerda. Cada splat é um mini-mapa de
   pixels multi-tom com forma orgânica; alguns têm escorridos de 1px que
   crescem com o tempo até a gota desprender e cair — depois recomeça.
   `n` é o nível de sujeira a partir do qual o splat aparece (1..SUJEIRA_MAX);
   no máximo entram placas pesadas na cabeça e no dorso, mas olho (cols 6..9,
   dy 7..9) e bico (cols 0..4) ficam SEMPRE livres pra leitura. */
const COCO_TONS = {
  W: '#f8f6ef', // branco fresco pegando a luz de cima-esquerda
  w: '#eae4d2', // off-white — corpo da placa
  G: '#c9c2ae', // cinza-esverdeado no meio-tom
  g: '#a8a288', // esverdeado na sombra (matiz desliza, não só escurece)
  k: '#7b7460', // toque escuro de borda — assenta o respingo na pluma
}

/* dy é medido do topo do sprite (y-33). pingos: dx relativo ao splat,
   alt = comprimento máximo do fio, t = ritmo em ms, f = defasagem.
   `cab: true` = respingo na CABEÇA — segue a tabela CABECA da pose, igual
   aos acessórios, senão a placa flutua quando o pombo abaixa pra bicar. */
const SPLATS_COCO = [
  // nível 1 — o acerto na moleira, escorrendo pela nuca
  { n: 1, cab: true, x: 6, y: 2, m: ['..wW..', '.WWWWg', 'gWWWGg', '.kGgk.'], pingos: [{ dx: 5, alt: 4, t: 300, f: 0 }] },
  { n: 1, x: 18, y: 14, m: ['Wg'] },
  // nível 2 — placa no dorso com escorrido, respingo na asa
  { n: 2, x: 15, y: 13, m: ['.wWWw.', 'GWWWWg', '.gGgk.'], pingos: [{ dx: 2, alt: 5, t: 340, f: 900 }] },
  { n: 2, x: 10, y: 19, m: ['wW', '.g'] },
  // nível 3 — cauda atingida e respingo na nuca
  { n: 3, x: 27, y: 12, m: ['.WWg', 'wWGg', '.kg.'], pingos: [{ dx: 1, alt: 3, t: 380, f: 400 }] },
  { n: 3, cab: true, x: 12, y: 5, m: ['.Ww', 'GWg'] },
  // nível 4 — asa grande, uropígio e peito
  { n: 4, x: 8, y: 21, m: ['.wWWg.', 'gWWWWg', '.kGg..'], pingos: [{ dx: 3, alt: 3, t: 320, f: 1300 }] },
  { n: 4, x: 22, y: 17, m: ['WGg', '.g.'] },
  { n: 4, x: 5, y: 13, m: ['Ww', 'gG'] },
  // nível 5 — cobertura pesada: placas grandes escorrendo pela cabeça e
  // pelo dorso, respingos até a ponta da cauda. Olho e bico continuam livres.
  {
    n: 5,
    cab: true,
    x: 4,
    y: 1,
    m: ['...wWWWw...', '.wWWWWWWWw.', 'wWWWWWWWWWg', 'gGWWWWWWGGg', '.k.gGg..Ggk'],
    pingos: [
      { dx: 1, alt: 3, t: 300, f: 200 }, // escorre na frente da cara, beirando o olho
      { dx: 9, alt: 5, t: 360, f: 700 }, // escorre pela nuca
    ],
  },
  {
    n: 5,
    x: 14,
    y: 12,
    m: ['..wWWWWw....', '.wWWWWWWWWw.', 'gWWWWWWWWWGg', '.kgGWWWGgk..', '...kgGk.....'],
    pingos: [
      { dx: 4, alt: 6, t: 340, f: 0 },
      { dx: 9, alt: 4, t: 300, f: 1500 },
    ],
  },
  { n: 5, x: 26, y: 10, m: ['.wWWg', 'wWWGg', '.gGk.'] },
  { n: 5, x: 32, y: 13, m: ['Wg'] },
  { n: 5, x: 11, y: 16, m: ['wW', 'gG', '.g'] },
  { n: 5, x: 19, y: 20, m: ['Wg', 'g.'] },
  { n: 5, x: 9, y: 26, m: ['wg'] },
]

function desenharSujeira(x, y, nivel, espelhar, agora, pose) {
  const px = Math.round(x)
  const py = Math.round(y) - 33 // topo aproximado do sprite (grade de 34)
  const n = Math.min(Math.max(nivel || 1, 1), SUJEIRA_MAX)
  const [cabDx, cabDy] = CABECA[pose] || [0, 0]
  const pinta = (cx, cy, cor) => {
    offCtx.fillStyle = cor
    offCtx.fillRect(px + (espelhar ? SPRITE - 1 - cx : cx), py + cy, 1, 1)
  }
  for (const s of SPLATS_COCO) {
    if (s.n > n) continue
    const ox = s.cab ? cabDx : 0 // respingo de cabeça acompanha a pose
    const oy = s.cab ? cabDy : 0
    for (let r = 0; r < s.m.length; r++)
      for (let c = 0; c < s.m[r].length; c++) {
        const tom = COCO_TONS[s.m[r][c]]
        if (tom) pinta(s.x + ox + c, s.y + oy + r, tom)
      }
    if (!s.pingos) continue
    for (const p of s.pingos) {
      // Fio cresce 1px por batida do relógio; passado `alt`, a gota desprende
      // e cai sozinha por 3px enquanto o fio recolhe. Aí o ciclo recomeça.
      const fase = Math.floor((agora + (p.f || 0)) / p.t) % (p.alt + 4)
      const gx = s.x + ox + p.dx
      const gy = s.y + oy + s.m.length - 1 // pende da última linha do splat
      if (fase <= p.alt) {
        for (let k = 1; k <= fase; k++) pinta(gx, gy + k, k === fase && fase > 1 ? COCO_TONS.W : COCO_TONS.G)
      } else {
        pinta(gx, gy + 1, COCO_TONS.g) // resto do fio que ficou
        pinta(gx, gy + p.alt + (fase - p.alt), COCO_TONS.w) // gota em queda
      }
    }
  }
}

function animarPelotas(agora) {
  for (let i = pelotas.length - 1; i >= 0; i--) {
    const p = pelotas[i]
    p.x += p.vx || 0
    p.y += p.vy
    p.vy += 0.12
    // Na altura da cabeça de quem está embaixo, a sujeira "pega" — e ACUMULA:
    // cada acerto novo sobe um nível e estende a duração. No nível máximo a
    // cobertura é pesada (placas e escorridos), mas o pombo segue visível.
    if (!p.aplicado && p.vitimas.length && p.y >= LINHA_CHAO - 24) {
      p.aplicado = true
      for (const id of p.vitimas) {
        const vv = vistas.get(id)
        if (vv) {
          vv.sujeira = Math.min((vv.sujeira || 0) + 1, SUJEIRA_MAX)
          vv.sujoAte = agora + SUJO_MS
          vv.emote = '💩'
          vv.emoteAte = agora + 1500
        }
      }
    }
    if (p.y >= LINHA_CHAO - 1) {
      // Cocô no mesmo lugar ACUMULA: a pilha cresce (até virar um monte bem
      // grande) e o relógio reinicia — enquanto tiver movimento ali, ela dura.
      const perto = splats.find((s2) => Math.abs(s2.x - p.x) < 7)
      if (perto) {
        perto.quantidade = Math.min(perto.quantidade + 1, COCO_MONTE_MAX)
        perto.criadoEm = agora
      } else {
        splats.push({ x: p.x, quantidade: 1, criadoEm: agora })
      }
      pelotas.splice(i, 1)
      continue
    }
    offCtx.fillStyle = '#f8f6ef'
    offCtx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2)
  }

  for (let i = splats.length - 1; i >= 0; i--) {
    const s = splats[i]
    const desde = agora - s.criadoEm
    // Sólido por 1min, depois esmaece aos poucos até sumir de vez.
    if (desde > COCO_VIDA_CHEIA_MS + COCO_FADE_MS) {
      splats.splice(i, 1)
      continue
    }
    const alpha = desde <= COCO_VIDA_CHEIA_MS ? 1 : Math.max(0, 1 - (desde - COCO_VIDA_CHEIA_MS) / COCO_FADE_MS)
    // Montinho: base cresce com a quantidade, empilhando em pirâmide —
    // com bastante cocô em cima, isso vira um monte de verdade.
    const q = s.quantidade || 1
    const larg = Math.min(4 + q * 0.55, 42)
    const altura = 1 + Math.min(Math.floor(q / 4), 14)
    const cx2 = Math.round(s.x)
    offCtx.globalAlpha = alpha
    offCtx.fillStyle = '#b9b3a0' // sombra da base
    offCtx.fillRect(cx2 - Math.ceil(larg / 2), LINHA_CHAO, Math.round(larg) + 1, 1)
    for (let ry = 0; ry < altura; ry++) {
      const wRow = Math.max(2, Math.round(larg - (ry * larg) / altura))
      offCtx.fillStyle = ry === altura - 1 ? '#f8f6ef' : ry % 2 ? '#e8e4d4' : '#efece0'
      offCtx.fillRect(cx2 - Math.floor(wRow / 2), LINHA_CHAO - 1 - ry, wRow, 1)
    }
    offCtx.globalAlpha = 1
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
    const ex = cx + 8 * (escala / 4)
    const ey = topo - 10 * (escala / 4) + flutuar
    const nomeIcone = EMOTE_ICONES[v.emote]
    if (nomeIcone) {
      // Emote em pixel art: o ícone é desenhado num canvas já no múltiplo
      // inteiro (iconeCanvas cacheia por fator), então o drawImage é 1:1 —
      // nítido em qualquer zoom, e o "pop" anda em degraus de pixel.
      const fator = Math.max(1, Math.round(escala * 0.8 * pop))
      const img = iconeCanvas(nomeIcone, fator)
      ctx.drawImage(img, Math.round(ex - img.width / 2), Math.round(ey - img.height))
    } else {
      // Emote sem mapa (sala antiga, emoji desconhecido): texto como antes.
      ctx.font = `${Math.round(11 * escala * pop)}px serif`
      ctx.fillText(v.emote, ex, ey)
    }
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
