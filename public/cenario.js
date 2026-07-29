/* ─────────────────────────────────────────────────────────────────────────
   A PRAÇA, PIXEL A PIXEL.

   Antes isto era um PNG de 1536x768 reamostrado pra 640x320. Uma imagem com
   122 mil cores encolhida vira pixel *borrado*: meio-tom em toda borda,
   gradiente em toda superfície. Os pombos são o oposto — vinte cores
   chapadas, contorno de 1px, sombra em degrau. Daí a sensação de colagem.

   Agora o cenário é desenhado no MESMO idioma dos sprites, na resolução
   lógica (1 pixel de arte = 1 pixel de mundo):

     · paleta fechada, cor chapada, zero gradiente, zero dithering;
     · 2 ou 3 tons por material (luz / meio / sombra), sempre em degrau;
     · luz sempre de cima-à-esquerda;
     · contorno #26201c — o MESMO dos pombos — só no mobiliário da praça.
       O que divide o plano com o pombo tem contorno; o que está longe não
       tem. É esse contraste que gruda o bicho no chão em vez de deixá-lo
       boiando por cima de uma foto;
     · profundidade por VALOR (fundo mais claro e mais lavado), nunca por
       desfoque. O muro é quase creme de propósito: ele é a "tela" clara
       contra a qual a silhueta escura do pombo tem que ler.

   E o principal: as superfícies pisáveis são registradas AQUI, na mesma
   linha em que os pixels são pintados (`sup()`). Não existe tabela de
   colisão à mão pra dessincronizar do desenho — o que dá pra pisar é,
   literalmente, o que foi desenhado.
   ───────────────────────────────────────────────────────────────────────── */

export const LARG = 640
export const ALT = 320
export const CHAO = 270 // linha dos pés do pombo

const MURO_Y = 189 // topo do capeamento do muro
const CALCADA_Y = 250 // onde a calçada encosta no muro
const GUIA_Y = 292 // meio-fio
const RUA_Y = 296

/* Paleta fechada. Tons de um mesmo material são vizinhos de valor — o pulo
   é sempre curto, senão vira desenho de bloco. */
export const C = {
  K: '#26201c', // contorno — o mesmo dos pombos
  KS: '#453b34', // contorno suave, pra peça pequena não empastar

  ceuA: '#8fb2c9',
  ceuB: '#a3c2d5',
  ceuC: '#b8d2df',
  nuvem: '#eef3f2',
  nuvemS: '#cfe0e7',

  // Três planos de cidade. A distância é resolvida com VALOR e TEMPERATURA:
  // longe puxa pro azul do céu, perto puxa pro bege quente e mais escuro.
  longeA: '#b6c9d8',
  longeB: '#abc0d1',
  longeT: '#c8d7e2',
  janelaL: '#9fb5c5',

  medioA: '#cac8c3',
  medioB: '#bfbcb5',
  medioT: '#d8d6d0',
  medioS: '#aaa79f',
  janelaM: '#949aa1',

  pertoA: '#c9bfa9',
  pertoB: '#bda78f',
  pertoC: '#d4cbb8',
  pertoT: '#e2dbc9',
  pertoS: '#9c917c',
  janelaP: '#77808e',
  janelaAcesa: '#c8b273',
  caixa: '#5b7d92',
  caixaL: '#7597a9',
  caixaS: '#41616f',

  fio: '#4a4750',
  poste: '#847d72',
  posteS: '#6a6459',

  // o muro é o fundo claro do "retrato" — quase creme
  muro: '#ddd6c4',
  muroL: '#e8e2d2',
  muroS: '#c9c1ad',
  muroBase: '#b2a996',
  capa: '#efeade',
  capaS: '#bfb6a2',
  pich: '#6a6280',
  grafA: '#bd6b58',
  grafB: '#63918c',
  grafC: '#cfa957',
  hera: '#6d8a4e',
  heraS: '#516d39',
  heraL: '#8aa762',

  pedra: '#ddd7c7',
  pedraS: '#cbc4b1',
  pedraEsc: '#6b6672',
  pedraEscL: '#7e7885',
  guia: '#cdc6b4',
  guiaF: '#a19886',
  asfalto: '#5c5b63',
  asfaltoL: '#696871',
  asfaltoS: '#4d4c54',

  conc: '#c6bfae',
  concL: '#dad3c2',
  concS: '#a49b89',
  verde: '#487a5c',
  verdeL: '#639b76',
  verdeS: '#325744',
  telha: '#c0674a',
  telhaL: '#dc8a63',
  telhaS: '#8f4030',
  laranja: '#d8703a',
  laranjaL: '#ee9660',
  laranjaS: '#a94d26',
  metal: '#6f6e78',
  metalL: '#8c8b94',
  metalS: '#4f4e58',
  vidro: '#a9c1cf',
  vidroL: '#cbdbe2',
  vidroS: '#7b95a6',
  azul: '#456d99',
  azulL: '#6a8fbb',
  azulS: '#2f4c75',
  ipe: '#8f6fae',
  ipeL: '#ae8ec9',
  ipeS: '#66497f',
  ipeK: '#48345c', // contorno da copa: escuro no MATIZ dela, não preto
  flor: '#cdb2e2',
  tronco: '#6b5648',
  troncoL: '#87705d',
  troncoS: '#4a3a31',
  madeira: '#9a7550',
  madeiraL: '#b58f65',
  madeiraS: '#6b4f36',
  folha: '#5c7a48',
  folhaL: '#77965c',
  terra: '#5a4a3c',
  azulejo: '#eae8df',
  azulejoS: '#cfccc0',
  azulejoAzul: '#5f86b5',
  azulejoAzulL: '#8aa9ce',
  amarelo: '#e0c04a',
  amareloS: '#ab8c2b',
  papel: '#ece8dc',
  vermelho: '#b6534a',
}

/* ── superfícies pisáveis ────────────────────────────────────────────────
   `sup(x, larg, y)` marca o topo desenhado como pisável. Guardamos por
   COLUNA: cada x do mundo tem a lista de alturas com apoio. Consulta é
   O(1) na coluna (cada uma tem de 1 a 4 níveis) — nada de varrer tabela
   de plataformas a 60fps. */
let colunas = null

/* Altura do topo de cada objeto de PRIMEIRO PLANO por coluna. Serve pra uma
   coisa só: saber onde o capeamento do muro fica escondido atrás do coreto
   ou da copa do ipê. Antes isso era chutado à mão numa lista de vãos — e
   estava errado, largo demais: o pombo despencava de um trecho de muro que
   continua bem visível na tela. */
let tetoObj = null

function zerarSuperficies() {
  colunas = Array.from({ length: LARG }, () => [CHAO])
  tetoObj = new Int16Array(LARG).fill(9999)
}

function tapa(x, larg, y) {
  const a = Math.max(0, Math.round(x))
  const b = Math.min(LARG, Math.round(x + larg))
  for (let i = a; i < b; i++) if (y < tetoObj[i]) tetoObj[i] = y
}

function sup(x, larg, y) {
  const a = Math.max(0, Math.round(x))
  const b = Math.min(LARG, Math.round(x + larg))
  const yy = Math.round(y)
  for (let i = a; i < b; i++) if (!colunas[i].includes(yy)) colunas[i].push(yy)
}

/** Alturas de apoio sob `x`, em ALTITUDE (0 = calçada, negativo = mais alto),
    ordenadas de cima pra baixo. Sempre termina em 0 — o chão da praça. */
export function niveisEm(x) {
  const i = Math.max(0, Math.min(LARG - 1, Math.round(x)))
  return colunas[i]
}

function fecharSuperficies() {
  for (let i = 0; i < LARG; i++) colunas[i] = colunas[i].map((y) => y - CHAO).sort((a, b) => a - b)
}

/* ── utilidades ──────────────────────────────────────────────────────── */

/** LCG: o "aleatório" tem que ser SEMPRE o mesmo, senão o cenário muda a
    cada refresh — e as superfícies junto com ele. */
function rnd(semente) {
  let s = semente >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function criarFerramentas(g) {
  const r = (x, y, w, h, cor) => {
    if (w <= 0 || h <= 0) return
    g.r(Math.round(x), Math.round(y), Math.round(w), Math.round(h), cor)
  }
  const p = (x, y, cor) => r(x, y, 1, 1, cor)
  /** Contorno de 1px POR FORA da caixa — o mesmo truque do K dos sprites. */
  const cont = (x, y, w, h, cor = C.K) => {
    r(x, y - 1, w, 1, cor)
    r(x, y + h, w, 1, cor)
    r(x - 1, y, 1, h, cor)
    r(x + w, y, 1, h, cor)
  }
  /** Volume chapado: 1px de luz em cima, 1px de sombra embaixo e à direita. */
  const bloco = (x, y, w, h, meio, luz, sombra) => {
    r(x, y, w, h, meio)
    if (luz) r(x, y, w, 1, luz)
    if (sombra) {
      r(x, y + h - 1, w, 1, sombra)
      r(x + w - 1, y + 1, 1, h - 2, sombra)
    }
  }
  return { r, p, cont, bloco, a: g.a }
}

/* ── céu ─────────────────────────────────────────────────────────────── */

function ceu({ r }) {
  r(0, 0, LARG, 84, C.ceuA)
  r(0, 84, LARG, 44, C.ceuB)
  r(0, 128, LARG, MURO_Y - 128, C.ceuC)
}

function nuvem({ r }, x, y, w) {
  // Cinco degraus de largura: silhueta de nuvem sem uma única borda macia.
  const perfil = [
    [0.36, 0.64],
    [0.22, 0.8],
    [0.09, 0.93],
    [0.0, 1.0],
    [0.05, 0.95],
  ]
  perfil.forEach(([a, b], i) => {
    r(x + a * w, y + i * 2, (b - a) * w, 2, i === perfil.length - 1 ? C.nuvemS : C.nuvem)
  })
  const lw = Math.round(w * 0.4)
  r(x + w * 0.5, y - 2, lw, 2, C.nuvem)
  r(x + w * 0.56, y - 4, Math.round(lw * 0.55), 2, C.nuvem)
}

function nuvens(f) {
  for (const [x, y, w] of [
    [30, 26, 58],
    [150, 58, 36],
    [238, 18, 46],
    [356, 50, 60],
    [472, 24, 40],
    [552, 64, 54],
    [96, 92, 32],
    [606, 36, 30],
    [408, 96, 28],
  ])
    nuvem(f, x, y, w)
}

/* ── skyline ─────────────────────────────────────────────────────────────
   Três planos. Longe = claro, quase da cor do céu, sem janela: em pixel art
   a distância se resolve com VALOR, nunca com blur. Perto = mais contraste,
   janela de 2x3, caixa d'água e antena. Nenhum plano leva contorno preto —
   contorno é privilégio do que divide o chão com o pombo.

   Cada prédio sorteia um TIPO de fachada, senão a fileira vira papel de
   parede: 'grade' (janela quadriculada), 'faixa' (varandas corridas) e
   'liso' (empena cega com junta vertical). */

function faixaPredios(f, cfg) {
  const { r } = f
  const rr = rnd(cfg.semente)
  let x = -12
  while (x < LARG + 12) {
    const w = cfg.wMin + Math.floor(rr() * (cfg.wMax - cfg.wMin + 1))
    const topo = cfg.yMin + Math.floor(rr() * (cfg.yMax - cfg.yMin + 1))
    // Uma torre em cada seis foge do bege: sem isso a linha do horizonte
    // vira papel de parede de um tom só.
    const s = rr()
    const corpo = cfg.corExtra && s < 0.17 ? cfg.corExtra : s < 0.6 ? cfg.corA : cfg.corB
    const h = MURO_Y - topo
    r(x, topo, w, h, corpo)
    r(x, topo, w, 1, cfg.corTopo)
    r(x + w - 1, topo + 1, 1, h - 1, cfg.corSombra)

    if (cfg.janela) {
      const tipo = rr()
      if (tipo < 0.45) {
        for (let jy = topo + 4; jy < MURO_Y - 4; jy += cfg.passoY)
          for (let jx = x + 3; jx + cfg.jw < x + w - 2; jx += cfg.passoX) {
            r(jx, jy, cfg.jw, cfg.jh, rr() < 0.08 ? C.janelaAcesa : cfg.janela)
            if (cfg.peitoril) r(jx, jy + cfg.jh, cfg.jw, 1, cfg.corTopo)
          }
      } else if (tipo < 0.78) {
        // varandas corridas: duas linhas 1px por pavimento
        for (let jy = topo + 5; jy < MURO_Y - 4; jy += cfg.passoY + 1) {
          r(x + 2, jy, w - 4, 1, cfg.janela)
          r(x + 2, jy + 1, w - 4, 1, cfg.corSombra)
        }
      } else {
        // empena cega: junta vertical e uma fileira de janelinhas de escada
        for (let jx = x + 5; jx < x + w - 4; jx += 9) r(jx, topo + 3, 1, MURO_Y - topo - 6, cfg.corSombra)
        for (let jy = topo + 6; jy < MURO_Y - 6; jy += cfg.passoY + 3)
          r(x + Math.floor(w / 2), jy, cfg.jw, cfg.jh, cfg.janela)
      }
    }
    if (cfg.caixa && rr() < 0.5 && w > 16) {
      const cw = 5 + Math.floor(rr() * 3)
      const cx = x + 3 + Math.floor(rr() * Math.max(1, w - cw - 6))
      r(cx + 1, topo - 8, 1, 3, C.metalS)
      r(cx + cw - 2, topo - 8, 1, 3, C.metalS)
      r(cx, topo - 6, cw, 6, C.caixa)
      r(cx, topo - 6, cw, 1, C.caixaL)
      r(cx + cw - 1, topo - 5, 1, 5, C.caixaS)
    }
    if (cfg.sacada && rr() < 0.35) {
      // caixa de casa de máquinas recuada no topo
      const bw = Math.round(w * 0.45)
      r(x + 3, topo - 7, bw, 7, cfg.corA)
      r(x + 3, topo - 7, bw, 1, cfg.corTopo)
      r(x + 3 + bw - 1, topo - 6, 1, 6, cfg.corSombra)
    }
    if (cfg.antena && rr() < 0.28) r(x + 4 + Math.floor(rr() * Math.max(1, w - 8)), topo - 9, 1, 9, C.metalS)

    // vão de céu entre torres: é o que deixa o plano de trás aparecer
    x += w + (rr() < (cfg.vaoChance ?? 0) ? 3 + Math.floor(rr() * 10) : 0)
  }
}

/** O prédio do mural — único acento saturado do fundo, em blocos chapados. */
function predioMural({ r }) {
  const x = 384
  const w = 44
  const topo = 40
  r(x, topo, w, MURO_Y - topo, C.pertoC)
  r(x, topo, w, 1, C.pertoT)
  r(x + w - 1, topo + 1, 1, MURO_Y - topo - 1, C.pertoS)
  r(x + 13, topo - 6, 10, 6, C.caixa)
  r(x + 13, topo - 6, 10, 1, C.caixaL)
  r(x + 22, topo - 5, 1, 5, C.caixaS)

  // Empena cega pintada: manchas grandes, chapadas, encaixadas. A leitura
  // vem do recorte entre elas — nenhuma leva linha de contorno.
  const m = [
    [0, 26, 26, 30, C.grafA],
    [26, 26, 18, 18, C.grafC],
    [26, 44, 18, 14, C.grafB],
    [2, 56, 22, 24, C.grafB],
    [24, 58, 20, 26, C.ipe],
    [0, 80, 16, 30, C.grafC],
    [16, 84, 16, 26, C.azul],
    [32, 84, 12, 30, C.grafA],
    [2, 110, 24, 20, C.ipe],
    [26, 114, 18, 18, C.grafC],
    [0, 130, 20, 19, C.azul],
    [20, 132, 24, 17, C.grafA],
  ]
  for (const [dx, dy, dw, dh, cor] of m) r(x + dx, topo + dy, dw, dh, cor)
  // Grafismo por cima: faixas e chevrons claros amarrando as manchas. A 44px
  // de largura, figura vira borrão — geometria continua legível.
  r(x + 2, topo + 52, 40, 3, C.papel)
  r(x + 6, topo + 106, 32, 3, C.papel)
  for (let i = 0; i < 5; i++) {
    r(x + 4 + i * 8, topo + 70, 4, 4, C.papel)
    r(x + 8 + i * 8, topo + 74, 4, 4, C.papel)
  }
  r(x + 12, topo + 90, 20, 12, C.papel)
  r(x + 16, topo + 94, 12, 4, C.grafA)
}

function skyline(f) {
  faixaPredios(f, {
    semente: 7,
    wMin: 14,
    wMax: 30,
    yMin: 128,
    yMax: 158,
    corA: C.longeA,
    corB: C.longeB,
    corTopo: C.longeT,
    corSombra: C.longeB,
    janela: C.janelaL,
    jw: 1,
    jh: 1,
    passoX: 4,
    passoY: 5,
    vaoChance: 0.3,
  })
  faixaPredios(f, {
    semente: 23,
    wMin: 18,
    wMax: 38,
    yMin: 88,
    yMax: 136,
    corA: C.medioA,
    corB: C.medioB,
    corTopo: C.medioT,
    corSombra: C.medioS,
    corExtra: '#b6bec4',
    janela: C.janelaM,
    jw: 1,
    jh: 2,
    passoX: 4,
    passoY: 6,
    caixa: true,
    vaoChance: 0.35,
  })
  faixaPredios(f, {
    semente: 61,
    wMin: 24,
    wMax: 50,
    yMin: 48,
    yMax: 124,
    corA: C.pertoA,
    corB: C.pertoB,
    corTopo: C.pertoT,
    corSombra: C.pertoS,
    corExtra: '#a98a7a',
    janela: C.janelaP,
    jw: 2,
    jh: 3,
    passoX: 6,
    passoY: 8,
    peitoril: true,
    caixa: true,
    antena: true,
    sacada: true,
    vaoChance: 0.75, // vão largo: é por aqui que os planos de trás aparecem
  })
  predioMural(f)
}

/* ── fiação ──────────────────────────────────────────────────────────────
   Poste atrás do muro e fio pendurado. São Paulo sem fio no céu não é São
   Paulo. Tudo 1px, cor única: leitura de traço, sem meio-tom. */

function fioPendurado({ p }, x1, y1, x2, y2, barriga, cor) {
  const dx = x2 - x1
  for (let i = 0; i <= dx; i++) {
    const t = i / dx
    p(x1 + i, Math.round(y1 + (y2 - y1) * t + barriga * Math.sin(Math.PI * t)), cor)
  }
}

function fiacao(f) {
  const { r } = f
  const postes = [88, 268, 452, 606]
  for (const x of postes) {
    r(x, 100, 3, MURO_Y - 100, C.poste)
    r(x, 100, 3, 1, C.metalL)
    r(x + 2, 101, 1, MURO_Y - 101, C.posteS)
    r(x - 6, 110, 15, 1, C.posteS)
    r(x - 5, 121, 13, 1, C.posteS)
    r(x - 5, 108, 1, 2, C.metalS)
    r(x + 7, 108, 1, 2, C.metalS)
    if (x === 268) {
      r(x + 4, 128, 7, 10, C.metal)
      r(x + 4, 128, 7, 1, C.metalL)
      r(x + 10, 129, 1, 9, C.metalS)
    }
  }
  const pts = [-24, ...postes, LARG + 24]
  for (let i = 0; i < pts.length - 1; i++) {
    fioPendurado(f, pts[i], 111, pts[i + 1], 111, 7, C.fio)
    fioPendurado(f, pts[i], 113, pts[i + 1], 113, 10, C.fio)
    fioPendurado(f, pts[i], 122, pts[i + 1], 122, 6, C.fio)
    fioPendurado(f, pts[i], 123, pts[i + 1], 123, 12, C.fio)
  }
}

/* ── muro ────────────────────────────────────────────────────────────────
   Concreto quase creme: é o fundo claro contra o qual a silhueta do pombo
   precisa ler. Campo chapado + junta de 1px + mancha de umidade em degrau.
   Nada de granulado — mancha em pixel art é FORMA, não ruído. */

function muro(f) {
  const { r, p } = f
  const base = CALCADA_Y + 8

  // Painéis pré-moldados: cada um com seu tom, variação curta (3 degraus).
  // É o que quebra a barra creme sem sujar o fundo do "retrato" do pombo.
  const tons = [C.muro, C.muroL, '#d7d0be']
  const rp = rnd(5)
  for (let x = 0; x < LARG; x += 44) {
    r(x, MURO_Y + 4, 44, base - MURO_Y - 4, tons[Math.floor(rp() * tons.length)])
    r(x + 43, MURO_Y + 5, 1, base - MURO_Y - 5, C.muroS) // junta vertical
  }
  r(0, MURO_Y, LARG, 1, C.capa)
  r(0, MURO_Y + 1, LARG, 3, C.muroL)
  r(0, MURO_Y + 4, LARG, 1, C.capaS)
  r(0, 214, LARG, 1, C.muroS) // junta horizontal do painel

  const rr = rnd(9)
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(rr() * LARG)
    const w = 2 + Math.floor(rr() * 6)
    const h = 5 + Math.floor(rr() * 16)
    r(x, MURO_Y + 5, w, h, C.muroS)
    r(x + 1, MURO_Y + 5, 1, h + 4, C.muroS)
  }
  r(0, base - 7, LARG, 6, C.muroS)
  r(0, base - 1, LARG, 1, C.muroBase)

  // Pichação e grafite: traço fino e lavado. Não pode competir com o pombo.
  for (const [tx, ty, cor] of [
    [150, 224, C.pich],
    [208, 236, C.pich],
    [332, 228, C.grafA],
    [470, 232, C.pich],
    [534, 222, C.grafB],
    [78, 238, C.grafC],
  ]) {
    /* Tag = rabisco CURTO e fechado (~20px), traço contínuo de 2px subindo e
       descendo. Se esticar demais vira fio elétrico atravessando o muro; se
       virar bloco solto, vira sujeira flutuando. */
    const r2 = rnd(tx)
    let x = tx
    let y = ty
    for (let i = 0; i < 8; i++) {
      const nx = x + 1 + Math.floor(r2() * 3)
      const ny = ty + (i % 2 ? -1 : 1) * (2 + Math.floor(r2() * 4))
      const passo = Math.max(1, Math.abs(nx - x), Math.abs(ny - y))
      for (let s = 0; s <= passo; s++)
        r(x + ((nx - x) * s) / passo, y + ((ny - y) * s) / passo, 2, 2, cor)
      x = nx
      y = ny
    }
  }

  // Hera: gavinha de 1px descendo do capeamento, folha de 2px.
  for (const hx of [246, 252, 258, 264, 270, 498, 504, 510, 594, 600, 606, 612, 618]) {
    const r3 = rnd(hx * 3)
    const comp = 8 + Math.floor(r3() * 26)
    let x = hx
    for (let i = 0; i < comp; i++) {
      const y = MURO_Y + 5 + i
      p(x, y, i % 5 === 0 ? C.heraS : C.hera)
      if (i % 4 === 1) r(x - 2, y, 2, 2, C.heraL)
      if (i % 4 === 3) r(x + 1, y, 2, 2, C.hera)
      if (r3() < 0.22) x += r3() < 0.5 ? 1 : -1
    }
  }
  for (const [hx, hw] of [
    [244, 30],
    [496, 18],
    [592, 30],
  ])
    for (let i = 0; i < hw; i++) {
      const alt = 4 + Math.round(2 * Math.sin(i / 2.2))
      r(hx + i, MURO_Y - alt, 1, alt + 3, i % 3 === 0 ? C.heraS : C.hera)
      p(hx + i, MURO_Y - alt, C.heraL)
    }
}

/* ── calçada portuguesa e rua ───────────────────────────────────────────
   A onda é um seno ARREDONDADO PRA INTEIRO: o degrau é o pixel, não um
   antialias disfarçado. O preto da pedra foi puxado pro cinza-lilás pra não
   brigar com o contorno do pombo, que precisa ser a coisa mais escura do
   plano do chão. */

function calcada(f) {
  const { r, p } = f
  r(0, CALCADA_Y, LARG, GUIA_Y - CALCADA_Y, C.pedra)
  r(0, CALCADA_Y, LARG, 1, C.pedraS)

  for (let x = 0; x < LARG; x++) {
    const yA = 264 + Math.round(4 * Math.sin(x / 7.4))
    r(x, yA, 1, 5, C.pedraEsc)
    p(x, yA, C.pedraEscL)
    const yB = 282 + Math.round(3 * Math.sin((x + 26) / 7.4))
    r(x, yB, 1, 4, C.pedraEsc)
    p(x, yB, C.pedraEscL)
  }

  // Textura: pedra portuguesa é pedrinha quadrada. Ponto em GRADE, esparso —
  // nunca ruído denso, que é o que faz cenário parecer JPEG.
  const rr = rnd(17)
  for (let y = CALCADA_Y + 2; y < GUIA_Y; y += 3)
    for (let x = y % 6 === 0 ? 0 : 2; x < LARG; x += 4) if (rr() < 0.35) p(x, y, C.pedraS)

  r(0, GUIA_Y, LARG, 1, C.pedra)
  r(0, GUIA_Y + 1, LARG, 3, C.guia)
  r(0, GUIA_Y + 3, LARG, 1, C.guiaF)
  r(0, RUA_Y, LARG, ALT - RUA_Y, C.asfalto)
  r(0, RUA_Y, LARG, 2, C.asfaltoS)
  for (let x = 0; x < LARG; x += 3) if (rnd(x + 5)() < 0.28) p(x, RUA_Y + 5 + (x % 7), C.asfaltoL)
  r(0, RUA_Y + 9, LARG, 1, C.asfaltoS)
}

/** Sombra chapada no chão: é ela que ancora o objeto na calçada. */
function sombraChao({ r, a }, x, w) {
  a(0.2)
  r(x, CHAO - 1, w, 2, '#2b2a2e')
  r(x + 2, CHAO + 1, w - 4, 1, '#2b2a2e')
  a(1)
}

/* ── mobiliário ──────────────────────────────────────────────────────────
   Daqui pra baixo tudo leva contorno #26201c — o mesmo dos pombos. */

/* Banco de ripa de madeira sobre pé de concreto — o da praça de bairro. A
   madeira também é o único marrom quente no meio do trecho, o que ajuda a
   separar o banco do muro claro atrás. */
function banco(f, x) {
  const { r, cont, bloco } = f
  const w = 52
  const topo = 237
  sombraChao(f, x - 2, w + 4)
  // pés de concreto, levemente cônicos
  for (const px of [x + 5, x + 39]) {
    bloco(px + 1, topo + 7, 6, CHAO - topo - 7, C.conc, C.concL, C.concS)
    cont(px + 1, topo + 7, 6, CHAO - topo - 7)
    bloco(px - 1, CHAO - 4, 10, 4, C.conc, C.concL, C.concS)
    cont(px - 1, CHAO - 4, 10, 4)
  }
  // assento: três ripas com fresta escura de 1px entre elas
  for (let i = 0; i < 3; i++) {
    const y = topo + i * 3
    r(x, y, w, 2, C.madeira)
    r(x, y, w, 1, C.madeiraL)
    if (i < 2) r(x, y + 2, w, 1, C.madeiraS)
  }
  cont(x, topo, w, 8)
  sup(x, w, topo)
}

function banca(f) {
  const { r, cont, bloco } = f
  const x = 24
  const w = 72
  const topo = 204
  sombraChao(f, x - 2, w + 6)

  bloco(x + 2, topo + 6, w - 4, CHAO - topo - 6, C.verde, C.verdeL, C.verdeS)
  cont(x + 2, topo + 6, w - 4, CHAO - topo - 6)
  bloco(x, topo, w, 6, C.verde, C.verdeL, C.verdeS)
  cont(x, topo, w, 6)
  r(x, topo + 5, w, 1, C.verdeS)
  sup(x, w, topo)

  const vx = x + 8
  const vy = topo + 14
  const vw = 40
  const vh = 30
  r(vx, vy, vw, vh, C.vidro)
  cont(vx, vy, vw, vh)
  r(vx, vy, vw, 1, C.vidroL)
  r(vx + vw - 1, vy + 1, 1, vh - 1, C.vidroS)
  const rr = rnd(31)
  for (let i = 0; i < 12; i++) {
    const cx = vx + 3 + (i % 6) * 6
    const cy = vy + 4 + Math.floor(i / 6) * 13
    r(cx, cy, 5, 9, [C.grafA, C.grafC, C.azul, C.ipe, C.verdeL, C.vermelho][Math.floor(rr() * 6)])
    r(cx, cy, 5, 2, C.papel)
    r(cx + 4, cy + 2, 1, 7, C.KS)
  }
  // brilho da vidraça: dois traços chapados na diagonal, zero gradiente
  for (let i = 0; i < 11; i++) r(vx + 3 + i, vy + 13 - i, 2, 1, C.vidroL)
  for (let i = 0; i < 7; i++) r(vx + 17 + i, vy + 16 - i, 2, 1, C.vidroL)

  r(x + 50, topo + 16, 18, 26, C.verdeS)
  cont(x + 50, topo + 16, 18, 26)
  for (let i = 0; i < 3; i++) {
    r(x + 52 + i * 6, topo + 18, 5, 11, C.papel)
    r(x + 52 + i * 6, topo + 21, 5, 1, C.KS)
    r(x + 52 + i * 6, topo + 25, 5, 1, C.KS)
  }
  r(x + 4, CHAO - 4, w - 8, 3, C.verdeS)
}

function orelhao(f) {
  const { r, cont } = f
  const cx = 122
  const topo = 214
  sombraChao(f, cx - 8, 16)

  r(cx - 2, topo + 24, 4, CHAO - topo - 24, C.metal)
  cont(cx - 2, topo + 24, 4, CHAO - topo - 24)
  r(cx - 2, topo + 24, 1, CHAO - topo - 24, C.metalL)
  r(cx - 5, CHAO - 3, 10, 3, C.metalS)
  cont(cx - 5, CHAO - 3, 10, 3)

  /* Casulo do orelhão: capacete de fibra. Topo achatado — é ali que dá pé —
     e lateral em degrau curto, arredondando de verdade em cima e embaixo.
     O contorno acompanha o degrau (não existe caixa por trás). */
  const meia = [7, 10, 11, 12, 12, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 12, 12, 11, 9]
  for (let i = 0; i < meia.length; i++) {
    const hw = meia[i]
    const y = topo + i
    r(cx - hw, y, hw * 2, 1, C.laranja)
    r(cx - hw, y, Math.max(1, Math.round(hw * 0.45)), 1, C.laranjaL)
    r(cx + hw - 2, y, 2, 1, C.laranjaS)
    // contorno em degrau
    r(cx - hw - 1, y, 1, 1, C.K)
    r(cx + hw, y, 1, 1, C.K)
    const ant = i === 0 ? null : meia[i - 1]
    if (ant !== null && hw > ant) {
      r(cx - hw, y - 1, hw - ant, 1, C.K)
      r(cx + ant, y - 1, hw - ant, 1, C.K)
    }
    if (ant !== null && hw < ant) {
      r(cx - ant, y, ant - hw, 1, C.K)
      r(cx + hw, y, ant - hw, 1, C.K)
    }
  }
  r(cx - 7, topo - 1, 14, 1, C.K)
  r(cx - 7, topo, 14, 1, C.laranjaL)
  r(cx - 9, topo + meia.length, 18, 1, C.K)
  r(cx - 9, topo + meia.length - 2, 18, 2, C.laranjaS)
  sup(cx - 7, 14, topo)

  // Boca do casulo: recesso escuro grande com o telefone dentro e o fone
  // pendurado no gancho — é o que faz ler orelhão e não caixa de correio.
  r(cx - 11, topo + 4, 16, 15, C.laranjaS)
  r(cx - 10, topo + 5, 14, 13, C.KS)
  r(cx - 8, topo + 7, 10, 10, C.metal)
  r(cx - 8, topo + 7, 10, 1, C.metalL)
  r(cx - 7, topo + 9, 5, 4, C.vidroS) // visor
  r(cx - 7, topo + 14, 5, 2, C.metalS) // teclado
  r(cx - 1, topo + 8, 2, 7, C.KS) // fone no gancho
  r(cx - 3, topo + 8, 2, 1, C.KS)
  r(cx - 3, topo + 14, 2, 1, C.KS)
}

function posteLuz(f) {
  const { r, cont } = f
  const x = 146
  sombraChao(f, x - 3, 9)
  // Haste de 3px SEM contorno preto: com contorno viraria uma coluna quase
  // preta de 5px cortando a praça no meio. O próprio tom escuro já recorta.
  r(x, 158, 1, CHAO - 158, C.metalL)
  r(x + 1, 158, 1, CHAO - 158, C.metal)
  r(x + 2, 158, 1, CHAO - 158, C.metalS)
  r(x - 3, CHAO - 5, 9, 5, C.metalS)
  cont(x - 3, CHAO - 5, 9, 5)
  // braço em L e luminária de chapéu plano: o poleiro alto da praça
  r(x + 3, 154, 6, 2, C.metal)
  r(x + 3, 154, 6, 1, C.metalL)
  cont(x + 3, 154, 6, 2)
  r(x + 6, 150, 13, 4, C.metal)
  r(x + 6, 150, 13, 1, C.metalL)
  r(x + 6, 153, 13, 1, C.metalS)
  cont(x + 6, 150, 13, 4)
  r(x + 8, 154, 9, 2, C.amarelo)
  r(x + 9, 156, 7, 1, C.amareloS)
  sup(x + 6, 13, 150)
}

function coreto(f) {
  const { r, cont, bloco } = f
  const cx = 294
  const topoLanterna = 174
  const yEave = 200

  sombraChao(f, cx - 62, 124)

  bloco(cx - 58, 256, 116, 8, C.conc, C.concL, C.concS)
  cont(cx - 58, 256, 116, 8)
  bloco(cx - 16, 264, 32, 6, C.conc, C.concL, C.concS)
  cont(cx - 16, 264, 32, 6)

  // Meia-luz por baixo da cobertura: sem isso o vão do coreto fica com o
  // mesmo creme do muro e o coreto vira moldura vazada em vez de abrigo.
  f.a(0.1)
  f.r(cx - 56, 202, 112, 54, '#2b2a3a')
  f.a(1)

  for (const dx of [-56, -34, -12, 10, 32, 54]) {
    r(cx + dx, 202, 4, 54, C.verde)
    r(cx + dx, 202, 1, 54, C.verdeL)
    r(cx + dx + 3, 203, 1, 53, C.verdeS)
    cont(cx + dx, 202, 4, 54)
  }
  for (const dx of [-52, -30, -8, 14, 36]) {
    r(cx + dx, 236, 18, 2, C.verde)
    r(cx + dx, 236, 18, 1, C.verdeL)
    r(cx + dx, 252, 18, 2, C.verde)
    r(cx + dx, 252, 18, 1, C.verdeL)
    for (let i = 0; i < 6; i++) r(cx + dx + 1 + i * 3, 238, 2, 14, C.verdeS)
  }

  // Telhado: cone em degraus. Cada linha é uma fiada de telha — o degrau
  // horizontal É o pixel. Só a parte NOVA de cada fiada vira superfície:
  // é exatamente a silhueta que se vê.
  const linhas = yEave - 179
  const hwDe = (i) => Math.round(11 + 47 * Math.pow(i / linhas, 1.35))
  for (let i = 0; i <= linhas; i++) {
    const hw = hwDe(i)
    const y = 179 + i
    tapa(cx - hw - 1, hw * 2 + 2, y)
    r(cx - hw, y, hw * 2, 1, i % 3 === 2 ? C.telhaS : C.telha)
    r(cx - hw + 1, y, Math.max(1, Math.round(hw * 0.34)), 1, i % 3 === 2 ? C.telhaS : C.telhaL)
    for (const k of [0.38, 0.74, 1]) {
      const dx = Math.round(hw * k)
      r(cx - dx, y, 1, 1, C.telhaS)
      r(cx + dx - 1, y, 1, 1, C.telhaS)
    }
    if (i > 0) {
      const ant = hwDe(i - 1)
      if (hw > ant) {
        sup(cx - hw, hw - ant, y)
        sup(cx + ant, hw - ant, y)
        r(cx - hw, y - 1, hw - ant, 1, C.K)
        r(cx + ant, y - 1, hw - ant, 1, C.K)
      }
      r(cx - hw - 1, y, 1, 1, C.K)
      r(cx + hw, y, 1, 1, C.K)
    }
  }
  r(cx - 60, yEave + 1, 120, 2, C.telhaS)
  cont(cx - 60, yEave + 1, 120, 2)
  r(cx - 58, yEave + 3, 116, 1, C.verdeS)

  // Lanterna de topo plano: o poleiro nobre da praça.
  tapa(cx - 13, 26, topoLanterna)
  r(cx - 12, topoLanterna + 1, 24, 4, C.telha)
  r(cx - 12, topoLanterna + 1, 24, 1, C.telhaL)
  r(cx - 12, topoLanterna + 4, 24, 1, C.telhaS)
  cont(cx - 12, topoLanterna + 1, 24, 4)
  r(cx - 9, topoLanterna + 6, 18, 5, C.verde)
  r(cx - 9, topoLanterna + 6, 18, 1, C.verdeL)
  for (let i = 0; i < 5; i++) r(cx - 8 + i * 4, topoLanterna + 7, 2, 3, C.verdeS)
  cont(cx - 9, topoLanterna + 6, 18, 5)
  sup(cx - 12, 24, topoLanterna + 1)
}

/* Copa do ipê: silhueta montada por união de lobos e depois DESENHADA
   coluna a coluna. A superfície pisável é o topo de cada coluna da máscara,
   ou seja, a folhagem que se vê. Assim não existe "pousar no ar" nem
   "atravessar a copa": o contorno da massa é a colisão. */
function copaIpe(f, cxT) {
  const { r } = f
  const X0 = 398
  const X1 = 506
  const Y0 = 166
  const Y1 = 226
  const W = X1 - X0
  const H = Y1 - Y0
  const masc = new Uint8Array(W * H)
  // Massa de folhagem = união de lobos. Raios e achatamentos diferentes pra
  // não virar pirulito: a copa tem que ter ombro, tufo e falha.
  const lobos = [
    [cxT - 2, 197, 25, 1.45],
    [cxT - 23, 199, 17, 1.2],
    [cxT + 21, 196, 18, 1.25],
    [cxT - 13, 184, 16, 1.4],
    [cxT + 9, 182, 15, 1.5],
    [cxT - 34, 205, 12, 1.1],
    [cxT + 35, 203, 11, 1.15],
    [cxT + 2, 210, 21, 1.05],
    [cxT - 29, 189, 9, 1.2],
    [cxT + 28, 187, 8, 1.25],
  ]
  for (const [lx, ly, lr, sq] of lobos)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const dx = X0 + x - lx
        const dy = (Y0 + y - ly) * sq
        if (dx * dx + dy * dy <= lr * lr) masc[y * W + x] = 1
      }

  const rr = rnd(77)
  /* Volume sem gradiente: cada pixel pega o lobo a que mais "pertence" e é
     pintado pela posição DENTRO desse lobo — canto de cima-à-esquerda claro,
     barriga escura. Dá massa agrupada em cachos, que é como folhagem lê em
     pixel art, em vez de uma faixa clara em cima e outra escura embaixo. */
  const tomDe = (px, py) => {
    let melhor = null
    let dentro = -Infinity
    for (const [lx, ly, lr, sq] of lobos) {
      const dx = px - lx
      const dy = (py - ly) * sq
      const d = Math.sqrt(dx * dx + dy * dy)
      if (lr - d > dentro) {
        dentro = lr - d
        melhor = [dx / lr, (py - ly) / lr]
      }
    }
    const [nx, ny] = melhor
    if (ny < -0.12 && nx < 0.25) return C.ipeL
    if (ny > 0.3 || (ny > 0.05 && nx > 0.35)) return C.ipeS
    return C.ipe
  }
  /* Contorno: a copa também precisa recortar do fundo, senão fica sendo a
     única coisa do plano do pombo sem linha. Mas linha PRETA numa massa
     desse tamanho pesa demais — o contorno é um roxo escuro, o mesmo truque
     do reference: escuro no matiz do próprio objeto. A borda é a máscara
     dilatada em 1px, e é ELA que vira superfície: o pombo pousa exatamente
     no pixel que se vê. */
  const dentroM = (x, y) => x >= 0 && y >= 0 && x < W && y < H && masc[y * W + x]
  const borda = new Uint8Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (masc[y * W + x]) continue
      if (dentroM(x - 1, y) || dentroM(x + 1, y) || dentroM(x, y - 1) || dentroM(x, y + 1)) borda[y * W + x] = 1
    }

  for (let x = 0; x < W; x++) {
    let topo = -1
    for (let y = 0; y < H; y++) {
      if (borda[y * W + x]) {
        r(X0 + x, Y0 + y, 1, 1, C.ipeK)
        if (topo < 0) topo = y
        continue
      }
      if (!masc[y * W + x]) continue
      if (topo < 0) topo = y
      r(X0 + x, Y0 + y, 1, 1, tomDe(X0 + x, Y0 + y))
    }
    if (topo >= 0) {
      sup(X0 + x, 1, Y0 + topo)
      tapa(X0 + x, 1, Y0 + topo)
    }
  }
  // Cachos: mancha chapada de 3 tons + furo de céu. Nada de dithering.
  for (let i = 0; i < 70; i++) {
    const px = Math.round(cxT - 34 + rr() * 68)
    const py = Math.round(Y0 + 6 + rr() * 40)
    const mx = px - X0
    const my = py - Y0
    if (mx < 1 || mx >= W - 3 || my < 1 || my >= H - 3) continue
    if (!masc[my * W + mx] || !masc[my * W + mx + 2] || !masc[(my + 1) * W + mx]) continue
    const t = rr()
    const cor = t < 0.36 ? C.ipeL : t < 0.6 ? C.ipeS : t < 0.86 ? C.flor : C.ceuC
    r(px, py, 2 + Math.floor(rr() * 2), t < 0.86 ? 2 : 1, cor)
  }
}

function jardineiraIpe(f) {
  const { r, p, cont, bloco } = f
  const x = 418
  const w = 66
  const topo = 249
  const cxT = 451
  const rr = rnd(99)

  // Tronco cônico e galhos primeiro; a copa cobre o que tem que cobrir.
  for (let y = 188; y < topo + 2; y++) {
    const hw = 3 + Math.floor((y - 188) / 20)
    r(cxT - hw, y, hw * 2, 1, C.tronco)
    r(cxT - hw, y, 2, 1, C.troncoL)
    r(cxT + hw - 1, y, 1, 1, C.troncoS)
    if (y > 214) {
      p(cxT - hw - 1, y, C.K)
      p(cxT + hw, y, C.K)
    }
  }
  for (const [gx, gy, gw] of [
    [cxT - 17, 195, 15],
    [cxT + 4, 190, 15],
    [cxT - 11, 184, 10],
    [cxT + 6, 200, 10],
  ]) {
    r(gx, gy, gw, 2, C.tronco)
    r(gx, gy, gw, 1, C.troncoL)
  }
  copaIpe(f, cxT)

  sombraChao(f, x - 2, w + 4)
  bloco(x, topo, w, CHAO - topo, C.azulejo, '#f4f2eb', C.azulejoS)
  cont(x, topo, w, CHAO - topo)
  r(x, topo + 3, w, 1, C.azulejoS)
  r(x, CHAO - 4, w, 4, C.azulejoAzul)
  r(x, CHAO - 4, w, 1, C.azulejoAzulL)
  for (let gy = topo + 7; gy < CHAO - 6; gy += 7)
    for (let gx = x + 4; gx < x + w - 4; gx += 7) {
      p(gx + 1, gy, C.azulejoAzul)
      r(gx, gy + 1, 3, 1, C.azulejoAzul)
      p(gx + 1, gy + 2, C.azulejoAzul)
      p(gx + 1, gy + 1, C.azulejoAzulL)
    }
  r(x + 3, topo + 4, w - 6, 3, C.terra)
  for (let i = 0; i < 24; i++) r(x + 4 + Math.floor(rr() * (w - 8)), topo + 2, 1, 3, rr() < 0.5 ? C.folha : C.folhaL)
  sup(x, w, topo)

  // flor caída: o ipê pinta a calçada de roxo embaixo dele
  for (let i = 0; i < 30; i++) {
    const fx = Math.round(cxT - 46 + rr() * 92)
    const fy = CHAO + 1 + Math.floor(rr() * 18)
    p(fx, fy, rr() < 0.5 ? C.ipe : C.ipeL)
    if (rr() < 0.3) p(fx + 1, fy, C.ipeS)
  }
}

function pontoOnibus(f) {
  const { r, cont, bloco } = f
  const x = 492
  const w = 72
  const topo = 209
  sombraChao(f, x - 2, w + 6)

  for (const px of [x + 2, x + w - 6]) {
    r(px, topo + 6, 4, CHAO - topo - 6, C.azul)
    r(px, topo + 6, 1, CHAO - topo - 6, C.azulL)
    r(px + 3, topo + 7, 1, CHAO - topo - 7, C.azulS)
    cont(px, topo + 6, 4, CHAO - topo - 6)
    r(px - 2, CHAO - 3, 8, 3, C.azulS)
    cont(px - 2, CHAO - 3, 8, 3)
  }
  r(x + 8, topo + 10, w - 18, 40, C.vidro)
  cont(x + 8, topo + 10, w - 18, 40)
  r(x + 8, topo + 10, w - 18, 1, C.vidroL)
  for (let i = 0; i < 13; i++) r(x + 11 + i, topo + 32 - i, 2, 1, C.vidroL)
  r(x + 30, topo + 10, 1, 40, C.vidroS)
  r(x + 44, topo + 12, 16, 24, C.papel)
  cont(x + 44, topo + 12, 16, 24, C.KS)
  r(x + 46, topo + 14, 12, 9, C.grafA)
  r(x + 46, topo + 25, 12, 1, C.KS)
  r(x + 46, topo + 28, 9, 1, C.KS)
  r(x + 46, topo + 31, 11, 1, C.KS)
  bloco(x + 12, topo + 42, 26, 3, C.metal, C.metalL, C.metalS)
  cont(x + 12, topo + 42, 26, 3)
  r(x + 14, topo + 45, 2, 12, C.metalS)
  r(x + 33, topo + 45, 2, 12, C.metalS)

  bloco(x, topo, w, 6, C.azul, C.azulL, C.azulS)
  cont(x, topo, w, 6)
  r(x, topo + 5, w, 1, C.azulS)
  sup(x, w, topo)
}

function placa(f) {
  const { r, cont, bloco } = f
  const x = 582
  const w = 20
  const topo = 204
  sombraChao(f, x + 6, 9)
  r(x + 8, topo + 16, 3, CHAO - topo - 16, C.metal)
  r(x + 8, topo + 16, 1, CHAO - topo - 16, C.metalL)
  cont(x + 8, topo + 16, 3, CHAO - topo - 16)
  r(x + 6, CHAO - 3, 7, 3, C.metalS)
  cont(x + 6, CHAO - 3, 7, 3)
  bloco(x, topo, w, 16, C.amarelo, '#eed46a', C.amareloS)
  cont(x, topo, w, 16)
  r(x + 4, topo + 4, 12, 7, C.KS)
  r(x + 5, topo + 5, 10, 3, C.vidroL)
  r(x + 5, topo + 11, 2, 2, C.KS)
  r(x + 13, topo + 11, 2, 2, C.KS)
  sup(x, w, topo)
}

function lixeira(f) {
  const { r, cont, bloco } = f
  const x = 612
  const w = 18
  const topo = 228
  sombraChao(f, x - 2, w + 4)
  bloco(x + 1, topo + 5, w - 2, CHAO - topo - 5, C.verde, C.verdeL, C.verdeS)
  cont(x + 1, topo + 5, w - 2, CHAO - topo - 5)
  for (let i = 0; i < 4; i++) r(x + 3 + i * 4, topo + 9, 2, CHAO - topo - 14, C.verdeS)
  bloco(x, topo, w, 5, C.verde, C.verdeL, C.verdeS)
  cont(x, topo, w, 5)
  r(x + 6, topo + 1, 6, 1, C.verdeS)
  sup(x, w, topo)
}

/* O capeamento do muro só é poleiro ONDE ELE APARECE. Em vez de decorar uma
   lista de vãos (que envelhece mal e erra por vários pixels), pergunta ao
   próprio desenho: coreto e copa marcaram por onde passam, e só onde eles
   sobem acima da linha do muro é que não há capeamento visível. Roda DEPOIS
   de todo mundo desenhar, por isso. */
function supMuro() {
  for (let x = 0; x < LARG; x++) if (tetoObj[x] > MURO_Y + 3) sup(x, 1, MURO_Y)
}

function detalhes(f) {
  const { r, p } = f
  const rr = rnd(101)
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rr() * LARG)
    const y = CHAO - 6 + Math.floor(rr() * 22)
    const t = rr()
    if (t < 0.5) r(x, y, 2, 1, C.folha)
    else if (t < 0.8) p(x, y, C.troncoS)
    else r(x, y, 2, 1, C.papel)
  }
  // poça refletindo o céu
  r(196, CHAO + 13, 22, 3, C.ceuC)
  r(199, CHAO + 12, 15, 1, C.ceuC)
  r(198, CHAO + 16, 18, 1, C.vidroS)
  // bueiro
  r(340, RUA_Y + 11, 22, 6, C.asfaltoS)
  r(340, RUA_Y + 11, 22, 1, C.asfaltoL)
  for (let i = 0; i < 5; i++) r(343 + i * 4, RUA_Y + 13, 2, 2, C.asfalto)
}

/* ── composição ──────────────────────────────────────────────────────── */

export function pintarCena(g) {
  const f = criarFerramentas(g)
  zerarSuperficies()

  ceu(f)
  nuvens(f)
  skyline(f)
  fiacao(f)
  muro(f)
  calcada(f)

  banca(f)
  orelhao(f)
  posteLuz(f)
  banco(f, 160)
  coreto(f)
  banco(f, 360)
  jardineiraIpe(f)
  pontoOnibus(f)
  placa(f)
  lixeira(f)
  detalhes(f)

  supMuro() // por último: depende de quem passou na frente do muro
  fecharSuperficies()
}

/** Pinta num contexto 2D e deixa o mapa de colisão pronto pra `niveisEm`. */
export function pintarEmCanvas(ctx) {
  let alfa = 1
  pintarCena({
    r: (x, y, w, h, cor) => {
      if (alfa !== 1) ctx.globalAlpha = alfa
      ctx.fillStyle = cor
      ctx.fillRect(x, y, w, h)
      if (alfa !== 1) ctx.globalAlpha = 1
    },
    a: (v) => (alfa = v),
  })
}
