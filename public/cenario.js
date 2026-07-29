/* ─────────────────────────────────────────────────────────────────────────
   A PRAÇA, PIXEL A PIXEL — AGORA EM ESCALA DE CIDADE.

   O mundo cresceu: 1280x480, chão em 408. O pombo continua com 36px — e é
   exatamente isso que o faz virar um bicho pequeno de verdade: pessoas têm
   ~70px, portas ~90px, postes ~180px, o coreto ~200px, prédios de fundo
   250–400px. Tudo que divide o plano com o pombo foi REDESENHADO nessa
   proporção.

   O idioma continua o dos sprites:
     · paleta fechada, cor chapada, zero gradiente, zero dithering;
     · 2 ou 3 tons por material (luz / meio / sombra), sempre em degrau;
     · luz sempre de cima-à-esquerda — e agora TODO objeto de primeiro plano
       projeta sombra longa pra direita no chão (e no muro, quando encosta);
     · contorno #26201c só no mobiliário do plano do pombo;
     · profundidade por VALOR, nunca por desfoque.

   CONTRATO (o que cena.js e o renderer consomem):
     LARG, ALT, CHAO            dimensões do mundo (1280 x 480, chão 408)
     C                          paleta
     pintarCena(g)              desenha o fundo ESTÁTICO em g = {r(x,y,w,h,cor), a(alfa)}
     pintarEmCanvas(ctx)        idem, direto num CanvasRenderingContext2D
     niveisEm(x)                alturas de apoio na coluna x (altitude, 0 = chão)
     FIOS                       fios pousáveis: [{x0,y0,x1,y1,y(x)}] — y(x) devolve
                                a MESMA catenária desenhada, em px de mundo
     desenharAnimados(ctx,t,escala)
                                camada ANIMADA por cima do fundo estático.
                                t em ms; escala = px de tela por px de mundo.
                                Desenha com fillRect em degraus inteiros
                                (x*escala, y*escala, w*escala, h*escala) —
                                nada de suavização. Chamar todo frame, depois
                                do fundo e antes (ou depois) dos sprites.
   ───────────────────────────────────────────────────────────────────────── */

export const LARG = 1280
export const ALT = 480
export const CHAO = 408 // linha dos pés do pombo

const MURO_Y = 285 // topo do capeamento do muro
const CALCADA_Y = 375 // onde a calçada encosta no muro
const GUIA_Y = 440 // meio-fio
const RUA_Y = 446

/* Paleta fechada. Sombra sempre com hue shift (esfria/escurece no matiz do
   material), nunca só "mais preto". */
export const C = {
  K: '#26201c',
  KS: '#453b34',

  ceuA: '#8fb2c9',
  ceuB: '#a3c2d5',
  ceuC: '#b8d2df',
  nuvem: '#eef3f2',
  nuvemS: '#cfe0e7',
  nuvemT: '#fbfefc',
  pombaCeu: '#8195a8',

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
  tijolo: '#b08468',
  tijoloS: '#8f6752',
  tijoloT: '#c39a7e',
  caixa: '#5b7d92',
  caixaL: '#7597a9',
  caixaS: '#41616f',

  arvF: '#8fae8b',
  arvFS: '#75977a',
  arvFL: '#a6c19c',

  fio: '#4a4750',
  fioL: '#5d5a64',
  poste: '#847d72',
  posteS: '#6a6459',

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
  lambe: '#d9cdae',
  lambeV: '#c2b391',
  lambeR: '#a8977a',

  pedra: '#ddd7c7',
  pedraS: '#cbc4b1',
  pedraL: '#e8e2d3',
  pedraEsc: '#6b6672',
  pedraEscL: '#7e7885',
  pedraEscD: '#5a5560',
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
  telhaV: '#6f2b30',
  laranja: '#d8703a',
  laranjaL: '#ee9660',
  laranjaS: '#a94d26',
  laranjaBri: '#f8b57b',
  metal: '#6f6e78',
  metalL: '#8c8b94',
  metalS: '#4f4e58',
  vidro: '#a9c1cf',
  vidroL: '#cbdbe2',
  vidroS: '#7b95a6',
  vidroT: '#dde9ee',
  azul: '#456d99',
  azulL: '#6a8fbb',
  azulS: '#2f4c75',
  ipe: '#8f6fae',
  ipeL: '#ae8ec9',
  ipeS: '#66497f',
  ipeK: '#48345c',
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
  vermelhoL: '#d3766b',
  vermelhoS: '#8a3a33',

  // materiais novos da reforma
  sobrado: '#d9c6a2',
  sobradoL: '#e8d9ba',
  sobradoS: '#b8a37e',
  sobradoT: '#c2ad86',
  janSob: '#6d7a88',
  venez: '#7c9482',
  venezS: '#5c7263',
  marquise: '#9aa5a4',
  marquiseS: '#76827f',
  neonOn: '#f2d16b',
  neonBri: '#fbeaae',
  neonOff: '#6d5f45',
  letreiro: '#3a3f4a',
  letreiroS: '#2b2f38',
  semCx: '#3d4148',
  semVerde: '#5fae6a',
  semVerdeD: '#2f5140',
  semAmar: '#e6c95a',
  semAmarD: '#6b5c33',
  semVerm: '#d05548',
  semVermD: '#5e2f2c',
  fum: '#d3d8da',
  fumS: '#b4bcc1',
  roupaAzul: '#7f9fb8',
  roupaAzulS: '#617f99',
  roupaRosa: '#c98a80',
  roupaRosaS: '#a86a63',
  jeans: '#4f6a8a',
  jeansS: '#3c5370',
  milho: '#e3c25c',
  lona: '#c4574d',
  lonaL: '#dd7a67',
  lonaS: '#94392f',
  plast: '#b8523f',
  plastL: '#d1705a',
  plastS: '#8c3a2c',
  ferr: '#8a5a3c',
}

/* ── superfícies pisáveis ────────────────────────────────────────────────
   `sup(x, larg, y)` marca o topo desenhado como pisável, por coluna. */
let colunas = null
let tetoObj = null // topo do 1º plano por coluna — pra saber onde o muro some

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

/** Alturas de apoio sob `x`, em ALTITUDE (0 = calçada, negativo = mais alto). */
export function niveisEm(x) {
  const i = Math.max(0, Math.min(LARG - 1, Math.round(x)))
  return colunas[i]
}

function fecharSuperficies() {
  for (let i = 0; i < LARG; i++) colunas[i] = colunas[i].map((y) => y - CHAO).sort((a, b) => a - b)
}

/* ── utilidades ──────────────────────────────────────────────────────── */

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
  const cont = (x, y, w, h, cor = C.K) => {
    r(x, y - 1, w, 1, cor)
    r(x, y + h, w, 1, cor)
    r(x - 1, y, 1, h, cor)
    r(x + w, y, 1, h, cor)
  }
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
  r(0, 0, LARG, 112, C.ceuA)
  r(0, 112, LARG, 78, C.ceuB)
  r(0, 190, LARG, MURO_Y - 190, C.ceuC)
}

function nuvem({ r }, x, y, w) {
  const u = w / 12
  r(x, y + 8, w, 3, C.nuvem)
  r(x + u * 0.6, y + 11, w - u * 1.6, 1, C.nuvemS)
  r(x + u * 4.6, y + 9, u * 6.6, 2, C.nuvemS)
  r(x + u * 1.6, y + 4, u * 5.6, 4, C.nuvem)
  r(x + u * 2.2, y + 2, u * 4.2, 2, C.nuvem)
  r(x + u * 2.8, y, u * 2.6, 2, C.nuvemT)
  r(x + u * 2.2, y + 2, u * 2.2, 2, C.nuvemT)
  r(x + u * 1.6, y + 4, u * 1.6, 2, C.nuvemT)
  r(x + u * 6.4, y + 5, u * 0.8, 3, C.nuvemS)
  r(x + u * 7.4, y + 5, u * 3.4, 3, C.nuvem)
  r(x + u * 7.8, y + 3.6, u * 2.2, 2, C.nuvem)
  r(x + u * 8, y + 3.6, u * 1.2, 1, C.nuvemT)
  r(x + u * 9.6, y + 6, u * 1.2, 2, C.nuvemS)
}

function nuvens(f) {
  for (const [x, y, w] of [
    [46, 30, 70],
    [230, 70, 44],
    [388, 20, 56],
    [560, 56, 74],
    [742, 26, 48],
    [900, 74, 62],
    [1058, 34, 52],
    [1196, 88, 40],
    [150, 118, 36],
    [498, 128, 30],
    [828, 130, 34],
    [1130, 138, 30],
    [672, 96, 30],
    [318, 108, 28],
  ])
    nuvem(f, x, y, w)
}

/* Bando de pombas paradas no céu do FUNDO (as que cruzam voando estão na
   camada animada). */
function pombasCeu({ p }) {
  for (const [x, y] of [
    [396, 88],
    [406, 83],
    [414, 91],
    [423, 86],
    [1016, 118],
    [1025, 114],
    [1032, 120],
    [132, 156],
    [141, 152],
  ]) {
    p(x, y, C.pombaCeu)
    p(x + 1, y - 1, C.pombaCeu)
    p(x + 2, y, C.pombaCeu)
  }
}

/* ── skyline ─────────────────────────────────────────────────────────────
   Três planos, resolvidos por VALOR. Agora os prédios do plano perto têm
   250–400px — o pombo de 36px é um bicho pequeno contra eles. */

function faixaPredios(f, cfg) {
  const { r } = f
  const rr = rnd(cfg.semente)
  let x = -16
  while (x < LARG + 16) {
    const w = cfg.wMin + Math.floor(rr() * (cfg.wMax - cfg.wMin + 1))
    const topo = cfg.yMin + Math.floor(rr() * (cfg.yMax - cfg.yMin + 1))
    const s = rr()
    const corpo = cfg.corExtra && s < 0.17 ? cfg.corExtra : s < 0.6 ? cfg.corA : cfg.corB
    const h = MURO_Y - topo
    r(x, topo, w, h, corpo)
    r(x, topo, w, 1, cfg.corTopo)
    r(x + w - 1, topo + 1, 1, h - 1, cfg.corSombra)

    if (cfg.janela) {
      const tipo = rr()
      if (tipo < 0.34) {
        for (let jy = topo + 5; jy < MURO_Y - 5; jy += cfg.passoY)
          for (let jx = x + 4; jx + cfg.jw < x + w - 3; jx += cfg.passoX) {
            r(jx, jy, cfg.jw, cfg.jh, rr() < 0.08 ? C.janelaAcesa : cfg.janela)
            if (cfg.peitoril) r(jx, jy + cfg.jh, cfg.jw, 1, cfg.corTopo)
            if (cfg.arCond && rr() < 0.1) {
              r(jx, jy + cfg.jh + 1, 4, 3, C.metalL)
              r(jx, jy + cfg.jh + 3, 4, 1, C.metalS)
              r(jx + 1, jy + cfg.jh + 4, 1, 2, cfg.corSombra) // escorrido do dreno
            }
          }
      } else if (tipo < 0.56) {
        for (let jy = topo + 6; jy < MURO_Y - 5; jy += cfg.passoY + 1) {
          r(x + 2, jy, w - 4, 1, cfg.corTopo)
          r(x + 2, jy + 1, w - 4, 2, cfg.janela)
          r(x + 2, jy + 3, w - 4, 1, cfg.corSombra)
          if (cfg.arCond) for (let vx = x + 7; vx < x + w - 5; vx += 10) r(vx, jy, 1, 4, cfg.corSombra)
        }
      } else if (tipo < 0.68) {
        for (let jx = x + 6; jx < x + w - 5; jx += 11) r(jx, topo + 4, 1, MURO_Y - topo - 8, cfg.corSombra)
        for (let jy = topo + 8; jy < MURO_Y - 8; jy += cfg.passoY + 4)
          r(x + Math.floor(w / 2), jy, cfg.jw, cfg.jh, cfg.janela)
        const mw = 4 + Math.floor(rr() * 5)
        const mx = x + 3 + Math.floor(rr() * Math.max(1, w - mw - 6))
        r(mx, topo + 1, mw, 7, cfg.corSombra)
        r(mx + 1, topo + 8, mw - 2, 7, cfg.corSombra)
        r(mx + 1, topo + 15, 1, 6 + Math.floor(rr() * 7), cfg.corSombra)
      } else if (cfg.tijolo && tipo < 0.84) {
        r(x, topo + 1, w, h - 1, C.tijolo)
        r(x, topo, w, 1, C.tijoloT)
        r(x + w - 1, topo + 1, 1, h - 1, C.tijoloS)
        for (let jy = topo + 5; jy < MURO_Y - 4; jy += cfg.passoY) {
          r(x + 1, jy - 1, w - 2, 1, C.tijoloT)
          for (let jx = x + 4; jx + cfg.jw < x + w - 3; jx += cfg.passoX)
            r(jx, jy + 1, cfg.jw, cfg.jh, rr() < 0.08 ? C.janelaAcesa : C.tijoloS)
        }
      } else if (cfg.vidroEsp) {
        r(x, topo + 1, w, h - 1, C.vidro)
        r(x, topo, w, 1, C.vidroT)
        const d0 = x + w - 2
        for (let py = topo + 1; py < MURO_Y - 1; py++) {
          const bx = d0 - Math.floor((py - topo) * 0.7)
          const a0 = Math.max(x + 1, bx - 9)
          const a1 = Math.min(x + w - 1, bx + 5)
          if (a1 > a0) r(a0, py, a1 - a0, 1, C.vidroL)
          const b0 = Math.max(x + 1, bx - 4)
          const b1 = Math.min(x + w - 1, bx + 1)
          if (b1 > b0) r(b0, py, b1 - b0, 1, C.vidroT)
        }
        for (let jy = topo + 5; jy < MURO_Y - 2; jy += cfg.passoY - 1) r(x + 1, jy, w - 2, 1, C.vidroS)
        for (let jx = x + 5; jx < x + w - 2; jx += 6) r(jx, topo + 1, 1, h - 1, C.vidroS)
        r(x + w - 1, topo + 1, 1, h - 1, C.vidroS)
      } else {
        for (let jy = topo + 5; jy < MURO_Y - 5; jy += cfg.passoY) {
          r(x + 1, jy, w - 2, 2, cfg.corSombra)
          for (let jx = x + 4; jx + cfg.jw < x + w - 3; jx += cfg.passoX) r(jx, jy, cfg.jw, 2, cfg.janela)
        }
      }
    }
    if (cfg.caixa && rr() < 0.5 && w > 20) {
      const g2 = cfg.grande ? 2 : 1
      const cw = (5 + Math.floor(rr() * 3)) * g2
      const cx = x + 4 + Math.floor(rr() * Math.max(1, w - cw - 8))
      const ch = 6 * g2
      r(cx + 1, topo - ch - 2 * g2, 1, 3 * g2, C.metalS)
      r(cx + cw - 2, topo - ch - 2 * g2, 1, 3 * g2, C.metalS)
      r(cx, topo - ch, cw, ch, C.caixa)
      r(cx, topo - ch, cw, 1, C.caixaL)
      r(cx + 1, topo - ch + 1, 1, ch - 2, C.caixaL)
      r(cx + cw - 1, topo - ch + 1, 1, ch - 1, C.caixaS)
      r(cx, topo - 1, cw, 1, C.caixaS)
      r(cx + 1, topo - ch - 1, cw - 2, 1, C.caixaL)
    }
    if (cfg.sacada && rr() < 0.35) {
      const bw = Math.round(w * 0.45)
      r(x + 4, topo - 10, bw, 10, cfg.corA)
      r(x + 4, topo - 10, bw, 1, cfg.corTopo)
      r(x + 4 + bw - 1, topo - 9, 1, 9, cfg.corSombra)
    }
    if (cfg.antena && rr() < 0.3) {
      const ax = x + 5 + Math.floor(rr() * Math.max(1, w - 10))
      const ah = cfg.grande ? 14 : 9
      r(ax, topo - ah, 1, ah, C.metalS)
      r(ax - 3, topo - ah + 1, 7, 1, C.metalS)
      r(ax - 2, topo - ah + 5, 5, 1, C.metalS)
    }
    x += w + (rr() < (cfg.vaoChance ?? 0) ? 4 + Math.floor(rr() * 14) : 0)
  }
}

/** O prédio do mural — o acento saturado do fundo, agora com 280px. */
function predioMural({ r }) {
  const x = 380
  const w = 64
  const topo = 6
  r(x, topo, w, MURO_Y - topo, C.pertoC)
  r(x, topo, w, 1, C.pertoT)
  r(x + w - 1, topo + 1, 1, MURO_Y - topo - 1, C.pertoS)
  r(x + 19, topo - 9, 15, 9, C.caixa)
  r(x + 19, topo - 9, 15, 1, C.caixaL)
  r(x + 33, topo - 8, 1, 8, C.caixaS)

  const e = 1.55 // o desenho antigo do mural, reescalado em degraus inteiros
  const m = [
    [2, 24, 40, 44, C.ipe],
    [22, 30, 14, 4, C.grafC],
    [20, 34, 18, 10, C.grafC],
    [22, 44, 14, 4, C.grafC],
    [24, 34, 8, 4, C.papel],
    [14, 36, 4, 3, C.grafC],
    [40, 36, 2, 3, C.grafC],
    [24, 22, 6, 3, C.grafC],
    [2, 56, 18, 12, C.grafB],
    [8, 50, 10, 6, C.grafB],
    [24, 58, 18, 10, C.verde],
    [30, 52, 9, 6, C.verde],
    [2, 68, 40, 8, C.azul],
    [2, 76, 40, 6, C.azulL],
    [2, 82, 40, 6, C.azul],
    [0, 88, 44, 34, C.grafA],
    [0, 122, 22, 27, C.grafC],
    [22, 122, 22, 27, C.ipe],
  ]
  for (const [dx, dy, dw, dh, cor] of m)
    r(x + Math.round(dx * e), topo + Math.round(dy * e), Math.round(dw * e), Math.round(dh * e), cor)
  r(x + 15, topo + 149, 37, 9, C.papel)
  r(x + 9, topo + 143, 16, 6, C.papel)
  r(x + 43, topo + 143, 16, 6, C.papel)
  r(x + 3, topo + 136, 12, 6, C.papel)
  r(x + 53, topo + 136, 12, 6, C.papel)
  r(x + 28, topo + 158, 12, 6, C.papel)
  r(x + 31, topo + 164, 6, 5, C.grafC)
  r(x + 3, topo + 31, 62, 3, C.papel)
  for (let i = 0; i < 5; i++) {
    r(x + 6 + i * 12, topo + 201, 6, 6, C.papel)
    r(x + 12 + i * 12, topo + 207, 6, 6, C.papel)
  }
  r(x + 6, topo + 177, 56, 3, C.papel)
}

/* Copas de fundo: massa lavada atrás do muro — mais árvore na praça sem
   disputar com o jacarandá do primeiro plano. Sem contorno, sem sup. */
function arvoresFundo({ r }) {
  for (const [cx, topo, w] of [
    [82, 242, 64],
    [300, 252, 48],
    [658, 246, 58],
    [1100, 250, 52],
    [1252, 244, 56],
  ]) {
    const h = MURO_Y + 6 - topo
    const rr = rnd(cx * 7)
    r(cx - w / 2, topo + 6, w, h - 6, C.arvF)
    r(cx - w / 2 + 5, topo + 2, w - 10, 4, C.arvF)
    r(cx - w / 2 + 10, topo, w - 20, 2, C.arvFL)
    r(cx - w / 2 + 4, topo + 3, Math.round(w * 0.34), 3, C.arvFL)
    r(cx - w / 2 + 2, topo + 6, Math.round(w * 0.26), 4, C.arvFL)
    r(cx + w * 0.16, topo + h - 12, w * 0.34, 8, C.arvFS)
    r(cx - w * 0.1, topo + h - 8, w * 0.42, 6, C.arvFS)
    for (let i = 0; i < 10; i++) {
      const bx = cx - w / 2 + 3 + Math.floor(rr() * (w - 8))
      const by = topo + 3 + Math.floor(rr() * (h - 8))
      r(bx, by, 2 + Math.floor(rr() * 3), 2, rr() < 0.4 ? C.arvFL : C.arvFS)
    }
  }
}

function skyline(f) {
  faixaPredios(f, {
    semente: 7,
    wMin: 26,
    wMax: 54,
    yMin: 96,
    yMax: 152,
    corA: C.longeA,
    corB: C.longeB,
    corTopo: C.longeT,
    corSombra: C.longeB,
    janela: C.janelaL,
    jw: 1,
    jh: 1,
    passoX: 5,
    passoY: 6,
    vaoChance: 0.3,
  })
  faixaPredios(f, {
    semente: 23,
    wMin: 34,
    wMax: 72,
    yMin: 44,
    yMax: 112,
    corA: C.medioA,
    corB: C.medioB,
    corTopo: C.medioT,
    corSombra: C.medioS,
    corExtra: '#b6bec4',
    janela: C.janelaM,
    jw: 2,
    jh: 2,
    passoX: 5,
    passoY: 8,
    caixa: true,
    vaoChance: 0.35,
  })
  pombasCeu(f)
  faixaPredios(f, {
    semente: 61,
    wMin: 40,
    wMax: 104,
    yMin: -34,
    yMax: 84,
    corA: C.pertoA,
    corB: C.pertoB,
    corTopo: C.pertoT,
    corSombra: C.pertoS,
    corExtra: '#a98a7a',
    janela: C.janelaP,
    jw: 3,
    jh: 4,
    passoX: 8,
    passoY: 11,
    peitoril: true,
    caixa: true,
    grande: true,
    antena: true,
    sacada: true,
    arCond: true,
    tijolo: true,
    vidroEsp: true,
    vaoChance: 0.85,
  })
  predioMural(f)
  arvoresFundo(f)
}

/* ── fiação ──────────────────────────────────────────────────────────────
   Postes de madeira ATRÁS do muro, fiação GROSSA (2px no fio principal),
   transformador, isoladores, emendas e gambiarras. A catenária que desenha
   é a MESMA exportada em FIOS — o pombo pousa exatamente no pixel do fio. */

const POSTES_FIO = [150, 490, 706]
const FIO_Y = 158 // altura do fio principal nos isoladores

function catenaria(x0, y0, x1, y1, barriga) {
  return (x) => {
    const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)))
    return Math.round(y0 + (y1 - y0) * t + barriga * Math.sin(Math.PI * t))
  }
}

/* Os DOIS vãos principais — largos, bem visíveis, pousáveis. Nenhum deles
   cruza atrás do jacarandá nem do sobrado: fio pousável tem que ficar à
   vista o tempo todo. */
const VAOS_FIO = [
  { x0: POSTES_FIO[0], y0: FIO_Y, x1: POSTES_FIO[1], y1: FIO_Y, barriga: 14 },
  { x0: POSTES_FIO[1], y0: FIO_Y, x1: POSTES_FIO[2], y1: FIO_Y, barriga: 12 },
]

/** Fios pousáveis: cada segmento traz a função y(x) da PRÓPRIA catenária
    desenhada. O renderer usa pra pousar pombo no fio. */
export const FIOS = VAOS_FIO.map((v) => ({
  x0: v.x0,
  y0: v.y0,
  x1: v.x1,
  y1: v.y1,
  y: catenaria(v.x0, v.y0, v.x1, v.y1, v.barriga),
}))

function fioGrosso({ p }, x0, y0, x1, y1, barriga, cor, grosso) {
  const f = catenaria(x0, y0, x1, y1, barriga)
  for (let x = Math.round(x0); x <= Math.round(x1); x++) {
    const y = f(x)
    p(x, y, cor)
    if (grosso) p(x, y + 1, cor)
  }
}

function fiacao(f) {
  const { r, p } = f
  for (const x of POSTES_FIO) {
    // poste de madeira: 5px, lado da luz claro, veio escuro descendo
    r(x - 2, 120, 5, MURO_Y + 8 - 120, C.poste)
    r(x - 2, 120, 2, MURO_Y + 8 - 120, '#958d80')
    r(x + 1, 121, 2, MURO_Y + 8 - 121, C.posteS)
    r(x - 2, 120, 5, 2, '#5e574d') // topo serrado
    for (let vy = 132; vy < MURO_Y; vy += 17) p(x, vy, C.posteS)
    // cruzetas (duas) com mão-francesa e isoladores
    for (const [cy, cw] of [
      [150, 34],
      [168, 26],
    ]) {
      r(x - cw / 2, cy, cw, 3, C.posteS)
      r(x - cw / 2, cy, cw, 1, '#958d80')
      r(x - 5, cy + 3, 2, 5, C.posteS)
      r(x + 3, cy + 3, 2, 5, C.posteS)
      for (const ix of [-cw / 2 + 3, -6, 4, cw / 2 - 5]) {
        r(x + ix, cy - 4, 3, 4, '#7a8a94') // isolador de porcelana
        r(x + ix, cy - 4, 3, 1, '#9db0ba')
        p(x + ix + 1, cy - 5, C.metalS)
      }
    }
    // plaquinha amarela e mancha de piche no pé
    r(x - 1, 210, 5, 6, C.amarelo)
    r(x - 1, 215, 5, 1, C.amareloS)
    r(x - 2, 262, 5, 14, '#4f4a42')
    p(x + 1, 240, C.tijoloS)
  }
  // transformador no poste do meio: tambor com aletas, buchas e ferrugem
  {
    const x = POSTES_FIO[1]
    r(x + 3, 174, 12, 17, C.metal)
    r(x + 3, 174, 12, 1, C.metalL)
    r(x + 14, 175, 1, 16, C.metalS)
    r(x + 2, 177, 1, 11, C.metalS)
    for (const ay of [178, 182, 186]) r(x + 4, ay, 10, 1, C.metalS)
    for (const bx of [5, 9, 13]) {
      r(x + bx, 171, 2, 3, '#7a8a94')
      p(x + bx, 170, C.metalS)
    }
    r(x + 12, 189, 1, 5, C.ferr) // ferrugem escorrendo do tambor
    p(x + 13, 195, C.ferr)
  }
  // fios principais (grossos, 2px) — os DOIS vãos pousáveis + rabicho
  for (const v of VAOS_FIO) fioGrosso(f, v.x0, v.y0, v.x1, v.y1, v.barriga, C.fio, true)
  fioGrosso(f, -30, FIO_Y + 2, POSTES_FIO[0], FIO_Y, 8, C.fio, true)
  // fios secundários finos, penca desigual — o macarrão paulistano
  fioGrosso(f, -30, 165, POSTES_FIO[0], 164, 10, C.fio)
  fioGrosso(f, POSTES_FIO[0], 164, POSTES_FIO[1], 164, 19, C.fio)
  fioGrosso(f, POSTES_FIO[1], 164, POSTES_FIO[2], 164, 16, C.fio)
  fioGrosso(f, -30, 172, POSTES_FIO[0], 171, 13, C.fioL)
  fioGrosso(f, POSTES_FIO[0], 171, POSTES_FIO[1], 171, 24, C.fioL)
  fioGrosso(f, POSTES_FIO[1], 171, POSTES_FIO[2], 171, 20, C.fioL)
  // ramal de entrada: do último poste até o gancho na empena do sobrado
  fioGrosso(f, POSTES_FIO[2], 168, SOB_X + 6, 206, 10, C.fioL)
  fioGrosso(f, POSTES_FIO[2], 172, SOB_X + 6, 210, 13, C.fioL)
  // emendas: nó de 2x3 onde o fio foi remendado
  for (const ex of [312, 598]) {
    const v = ex < POSTES_FIO[1] ? VAOS_FIO[0] : VAOS_FIO[1]
    const y = catenaria(v.x0, v.y0, v.x1, v.y1, v.barriga)(ex)
    r(ex, y - 1, 2, 4, C.fio)
  }
  // rabicho de gambiarra descendo do vão 1 até sumir atrás do muro
  {
    const yv = FIOS[0].y
    for (let i = 0; i < 60; i++) p(430 + Math.round(i * 0.2), yv(430) + i, C.fioL)
  }

  // tênis pendurado no vão 1 — rito de passagem
  {
    const v = VAOS_FIO[0]
    const tx = 372
    const ty = catenaria(v.x0, v.y0, v.x1, v.y1, v.barriga)(tx)
    r(tx, ty + 1, 1, 6, C.fio)
    r(tx + 4, ty + 1, 1, 7, C.fio)
    r(tx - 4, ty + 7, 7, 4, C.papel)
    r(tx - 6, ty + 8, 3, 3, C.papel)
    r(tx - 4, ty + 10, 7, 1, C.vermelho)
    r(tx + 3, ty + 8, 5, 4, C.papel)
    r(tx + 7, ty + 9, 3, 3, C.papel)
    r(tx + 3, ty + 11, 6, 1, C.vermelho)
  }

  // pombos decorativos no fio: SÓ nas pontas dos vãos — o meio fica livre
  // pro pombo de verdade pousar.
  const y1 = FIOS[0].y
  const y2 = FIOS[1].y
  for (const px of [188, 203, 214]) {
    r(px - 1, y1(px) - 4, 4, 3, C.fio)
    p(px + 1, y1(px) - 5, C.fio)
    p(px - 2, y1(px) - 2, C.fio)
  }
  for (const px of [676, 688]) {
    r(px - 1, y2(px) - 4, 4, 3, C.fio)
    p(px + 1, y2(px) - 5, C.fio)
    p(px - 2, y2(px) - 2, C.fio)
  }
}

/* ── muro ────────────────────────────────────────────────────────────────
   O fundo claro do retrato do pombo — agora com 90px de altura e camadas de
   história: lambe-lambe sobreposto, cartaz rasgado, reboco caído, escorrido,
   hera, placas. Cada superfície com pelo menos 2–3 clusters de desgaste. */

function muro(f) {
  const { r, p } = f
  const base = CALCADA_Y + 8

  const tons = [C.muro, C.muroL, '#d7d0be']
  const rp = rnd(5)
  for (let x = 0; x < LARG; x += 64) {
    r(x, MURO_Y + 5, 64, base - MURO_Y - 5, tons[Math.floor(rp() * tons.length)])
    r(x + 63, MURO_Y + 6, 1, base - MURO_Y - 6, C.muroS)
  }
  r(0, MURO_Y, LARG, 1, C.capa)
  r(0, MURO_Y + 1, LARG, 4, C.muroL)
  r(0, MURO_Y + 5, LARG, 1, C.capaS)
  r(0, 322, LARG, 1, C.muroS) // junta horizontal

  const rr = rnd(9)
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(rr() * LARG)
    const w = 3 + Math.floor(rr() * 8)
    const h = 7 + Math.floor(rr() * 22)
    r(x, MURO_Y + 6, w, h, C.muroS)
    r(x + 1, MURO_Y + 6, 1, h + 6, C.muroS)
  }
  const re = rnd(13)
  for (let ex = 11; ex < LARG; ex += 17 + Math.floor(re() * 20)) {
    const comp = 4 + Math.floor(re() * 13)
    r(ex, MURO_Y + 6, 1, comp, C.capaS)
    if (re() < 0.45) r(ex + 1, MURO_Y + 6, 1, Math.max(2, comp - 4), C.muroS)
  }
  r(0, base - 9, LARG, 8, C.muroS)
  r(0, base - 1, LARG, 1, C.muroBase)

  // reboco descascado — 5 feridas, tijolo com fiada marcada
  for (const [px, py, pw] of [
    [214, 322, 16],
    [451, 330, 13],
    [716, 318, 18],
    [1146, 326, 14],
    [58, 334, 12],
  ]) {
    r(px, py, pw, 12, C.tijolo)
    r(px + 3, py - 3, pw - 6, 3, C.tijolo)
    r(px - 3, py + 4, 3, 6, C.tijolo)
    for (let fy = py + 2; fy < py + 12; fy += 3) r(px, fy, pw, 1, C.tijoloS)
    p(px + 5, py + 1, C.tijoloT)
    p(px + pw - 5, py + 5, C.tijoloT)
    r(px + 1, py - 4, pw - 3, 1, C.muroL)
    r(px + pw, py + 1, 1, 11, C.muroS)
    r(px, py + 12, pw, 1, C.muroS)
  }

  // mancha de umidade subindo do rodapé
  for (const [mx, mw] of [
    [140, 34],
    [335, 22],
    [560, 18],
    [742, 26],
    [1075, 30],
    [1240, 14],
  ]) {
    r(mx, 366, mw, 6, C.muroS)
    r(mx + 4, 362, mw - 9, 4, C.muroS)
    r(mx + Math.floor(mw * 0.55), 359, 6, 3, C.muroS)
    r(mx + 3, 369, mw - 6, 3, C.muroBase)
  }

  /* LAMBE-LAMBE em camadas — o coração da densidade do muro, como a
     referência japonesa: cartaz sobre cartaz, canto rasgado, cola escorrida. */
  const lambes = [
    [66, 300, 22, 30, C.lambe, 0],
    [80, 306, 20, 27, C.papel, 1],
    [94, 298, 18, 24, C.lambeV, 2],
    [252, 302, 24, 32, C.papel, 1],
    [270, 310, 18, 22, C.lambe, 0],
    [404, 296, 20, 30, C.lambeV, 2],
    [419, 304, 22, 28, C.papel, 0],
    [700, 300, 22, 30, C.papel, 2],
    [714, 306, 20, 26, C.lambe, 1],
    [1088, 298, 22, 32, C.lambe, 0],
    [1102, 306, 20, 24, C.papel, 2],
    [1210, 300, 20, 28, C.lambeV, 1],
    [1224, 308, 18, 22, C.papel, 0],
  ]
  for (const [lx, ly, lw, lh, cor, tipo] of lambes) {
    r(lx, ly, lw, lh, cor)
    r(lx, ly + lh, lw, 1, C.muroS) // sombra do papel
    r(lx + lw, ly + 1, 1, lh, C.muroS)
    // conteúdo: manchete gorda + mancha de figura + linhas
    r(lx + 2, ly + 2, lw - 4, 3, tipo === 0 ? C.KS : tipo === 1 ? C.vermelho : C.azul)
    r(lx + 2, ly + 7, lw - 6, Math.floor(lh * 0.35), tipo === 0 ? C.grafA : tipo === 1 ? C.grafB : C.grafC)
    for (let ty = ly + 9 + Math.floor(lh * 0.35); ty < ly + lh - 3; ty += 3) r(lx + 2, ty, lw - 5, 1, C.KS)
    // canto rasgado: dente branco-sujo + o muro aparecendo
    if (tipo !== 1) {
      r(lx + lw - 5, ly + lh - 4, 5, 4, C.muro)
      r(lx + lw - 5, ly + lh - 4, 3, 2, C.lambeR)
      p(lx + lw - 6, ly + lh - 2, C.lambeR)
    } else {
      r(lx, ly, 4, 3, C.muro)
      p(lx + 3, ly + 2, C.lambeR)
    }
    if (tipo === 2) r(lx + 3, ly + lh, 1, 4, C.lambeV) // cola escorrida
  }

  // "PROIBIDO COLAR CARTAZ" — estêncil irônico entre os lambes
  r(288, 304, 30, 10, C.muroL)
  for (const [tx, tw] of [
    [290, 10],
    [302, 7],
    [311, 5],
  ])
    r(tx, 306, tw, 2, C.vermelhoS)
  r(290, 310, 24, 2, C.vermelhoS)

  // placa esmaltada de rua — maior, com parafusos
  r(150, 296, 46, 16, C.azul)
  r(150, 296, 46, 1, C.azulL)
  r(151, 311, 45, 1, C.azulS)
  r(195, 297, 1, 14, C.azulS)
  for (const [tx, tw] of [
    [155, 11],
    [168, 7],
    [177, 10],
  ])
    r(tx, 300, tw, 2, C.papel)
  r(158, 305, 30, 3, C.papel)
  p(152, 298, C.vidroL)
  p(193, 309, C.azulS)
  r(150, 312, 46, 1, C.muroS)

  // pichações — traço fino, lavado
  for (const [tx, ty, cor] of [
    [230, 336, C.pich],
    [340, 344, C.pich],
    [480, 338, C.grafA],
    [610, 342, C.pich],
    [760, 334, C.grafB],
    [1120, 344, C.pich],
    [1190, 336, C.grafC],
    [30, 342, C.pich],
  ]) {
    const r2 = rnd(tx)
    let x = tx
    let y = ty
    for (let i = 0; i < 9; i++) {
      const nx = x + 1 + Math.floor(r2() * 4)
      const ny = ty + (i % 2 ? -1 : 1) * (2 + Math.floor(r2() * 5))
      const passo = Math.max(1, Math.abs(nx - x), Math.abs(ny - y))
      for (let s = 0; s <= passo; s++)
        r(x + ((nx - x) * s) / passo, y + ((ny - y) * s) / passo, 2, 2, cor)
      x = nx
      y = ny
    }
  }

  // hera: gavinhas descendo do capeamento + moitas por cima do muro
  for (const hx of [356, 362, 368, 374, 850, 856, 862, 1160, 1166, 1172, 1178]) {
    const r3 = rnd(hx * 3)
    const comp = 10 + Math.floor(r3() * 34)
    let x = hx
    for (let i = 0; i < comp; i++) {
      const y = MURO_Y + 6 + i
      p(x, y, i % 5 === 0 ? C.heraS : C.hera)
      if (i % 4 === 1) r(x - 2, y, 2, 2, C.heraL)
      if (i % 4 === 3) r(x + 1, y, 2, 2, C.hera)
      if (r3() < 0.22) x += r3() < 0.5 ? 1 : -1
    }
  }
  for (const [hx, hw] of [
    [352, 34],
    [846, 24],
    [1156, 30],
  ])
    for (let i = 0; i < hw; i++) {
      const alt = 5 + Math.round(2 * Math.sin(i / 2.2))
      r(hx + i, MURO_Y - alt, 1, alt + 4, i % 3 === 0 ? C.heraS : C.hera)
      p(hx + i, MURO_Y - alt, C.heraL)
    }

  // caco de vidro e arame no topo do muro (trechos), como todo muro de SP
  for (let x = 186; x < 330; x += 7) {
    p(x, MURO_Y - 1, C.vidroS)
    p(x + 2, MURO_Y - 2, C.vidroL)
  }
  for (let x = 1212; x < 1274; x += 7) {
    p(x, MURO_Y - 1, C.vidroS)
    p(x + 2, MURO_Y - 2, C.vidroL)
  }
}

/* ── sobrado da padaria ──────────────────────────────────────────────────
   Um sobrado interrompe o muro: padaria no térreo (letreiro que pisca na
   camada animada), morada em cima — janelas com veneziana, AC pingando,
   canos com ferrugem escorrida, varal (roupa na camada animada), marquise
   pisável. O plano é o do MURO: sem contorno preto, valores um degrau
   abaixo do mobiliário. */

const SOB_X = 880
const SOB_W = 170
const SOB_TOPO = 128
const MARQUISE_Y = 330

function sobradoPadaria(f) {
  const { r, p } = f
  const x = SOB_X
  const w = SOB_W
  const base = CALCADA_Y + 8
  tapa(x - 2, w + 4, SOB_TOPO)

  // platibanda e corpo
  r(x, SOB_TOPO, w, base - SOB_TOPO, C.sobrado)
  r(x, SOB_TOPO, w, 2, C.sobradoL)
  r(x, SOB_TOPO + 2, w, 1, C.sobradoT)
  r(x + w - 2, SOB_TOPO + 2, 2, base - SOB_TOPO - 2, C.sobradoS)
  r(x, SOB_TOPO + 26, w, 2, C.sobradoT) // cinta da laje
  sup(x, w, SOB_TOPO) // topo da platibanda: poleiro alto
  // sombra que o sobrado joga no muro vizinho (luz de cima-esquerda)
  f.a(0.12)
  r(x + w, MURO_Y + 5, 14, base - MURO_Y - 5, '#2b2a3e')
  f.a(1)

  // desgaste do reboco do sobrado: 3 clusters + escorridos da platibanda
  const rs = rnd(414)
  for (const [dx, dy, dw, dh] of [
    [12, 168, 10, 14],
    [128, 210, 13, 10],
    [58, 150, 8, 8],
  ]) {
    r(x + dx, dy, dw, dh, C.sobradoS)
    r(x + dx + 2, dy + dh, dw - 4, 3, C.sobradoS)
    r(x + dx + 1, dy + 1, 3, 2, C.sobradoT)
  }
  for (let ex = x + 9; ex < x + w - 6; ex += 21 + Math.floor(rs() * 14))
    r(ex, SOB_TOPO + 3, 1, 5 + Math.floor(rs() * 9), C.sobradoT)

  // caixa d'água e antena espiando atrás da platibanda
  r(x + 118, SOB_TOPO - 14, 20, 14, C.caixa)
  r(x + 118, SOB_TOPO - 14, 20, 1, C.caixaL)
  r(x + 119, SOB_TOPO - 13, 1, 12, C.caixaL)
  r(x + 137, SOB_TOPO - 13, 1, 13, C.caixaS)
  r(x + 120, SOB_TOPO - 15, 16, 1, C.caixaL)
  r(x + 24, SOB_TOPO - 12, 1, 12, C.metalS)
  r(x + 21, SOB_TOPO - 11, 7, 1, C.metalS)
  r(x + 22, SOB_TOPO - 7, 5, 1, C.metalS)

  // ── pavimento de cima: 3 janelas com veneziana + sacadinha
  for (const jx of [16, 68, 120]) {
    const wx = x + jx
    const wy = 152
    r(wx - 2, wy - 2, 26, 40, C.sobradoS) // moldura rebaixada
    r(wx, wy, 22, 36, C.janSob)
    r(wx, wy, 22, 2, '#4e5a66') // verga em sombra
    r(wx + 10, wy, 2, 36, C.sobradoT) // montante
    r(wx, wy + 16, 22, 1, C.sobradoT)
    // vidro com reflexo diagonal chapado
    for (let i = 0; i < 8; i++) p(wx + 2 + i, wy + 12 - i, '#8b98a6')
    // veneziana meio fechada na janela do meio
    if (jx === 68) {
      r(wx, wy, 22, 14, C.venez)
      for (let vy2 = wy + 2; vy2 < wy + 14; vy2 += 3) r(wx, vy2, 22, 1, C.venezS)
    }
    r(wx - 2, wy + 38, 26, 2, C.sobradoT) // peitoril
    r(wx - 2, wy + 40, 26, 1, C.sobradoS)
    // vaso de planta no peitoril da terceira
    if (jx === 120) {
      r(wx + 3, wy + 33, 6, 5, C.plast)
      r(wx + 3, wy + 33, 6, 1, C.plastL)
      p(wx + 4, wy + 31, C.folha)
      p(wx + 6, wy + 30, C.folhaL)
      p(wx + 8, wy + 32, C.folha)
    }
  }

  // ── AC na fachada, pingando (o pingo é animado; a mancha fica aqui)
  const acx = x + 126
  const acy = 250
  r(acx, acy, 18, 12, C.metalL)
  r(acx, acy, 18, 1, '#a6a5ae')
  r(acx, acy + 10, 18, 2, C.metalS)
  for (let gx = acx + 2; gx < acx + 16; gx += 2) r(gx, acy + 3, 1, 6, C.metal)
  r(acx + 2, acy + 12, 14, 2, C.metalS) // suporte
  r(acx + 2, acy + 14, 1, 3, C.metalS)
  r(acx + 15, acy + 14, 1, 3, C.metalS)
  r(acx + 15, acy + 12, 1, 26, C.sobradoS) // escorrido antigo do dreno
  r(acx + 16, acy + 30, 1, 14, C.sobradoS)

  // ── canos externos com ferrugem escorrida
  for (const [cx2, ctop] of [
    [x + 6, 148],
    [x + w - 10, 168],
  ]) {
    r(cx2, ctop, 3, base - ctop, C.metalL)
    r(cx2 + 2, ctop, 1, base - ctop, C.metalS)
    for (const by of [ctop + 14, ctop + 66, ctop + 130]) {
      r(cx2 - 1, by, 5, 3, C.metal) // braçadeira
      r(cx2 - 1, by + 3, 5, 1, C.metalS)
      r(cx2 + 3, by + 4, 1, 8, C.ferr) // ferrugem escorrida da braçadeira
      p(cx2 + 4, by + 12, C.ferr)
    }
    r(cx2, base - 8, 4, 8, C.metal) // curva pro chão
  }

  // ── marquise da padaria (pisável) — laje saliente com testeira e mãos-
  //    francesas, passando 6px das quinas da fachada
  r(x - 6, MARQUISE_Y, w + 12, 3, C.marquise)
  r(x - 6, MARQUISE_Y, w + 12, 1, '#c3cbc9')
  r(x - 6, MARQUISE_Y + 3, w + 12, 3, C.marquiseS)
  r(x - 6, MARQUISE_Y + 6, w + 12, 1, '#5f6a68')
  r(x + w + 5, MARQUISE_Y + 1, 1, 6, C.marquiseS)
  for (const mx of [x + 2, x + 82, x + w - 6]) {
    r(mx, MARQUISE_Y + 7, 2, 4, C.marquiseS) // mão-francesa
    p(mx + 1, MARQUISE_Y + 11, C.marquiseS)
  }
  r(x + 30, MARQUISE_Y - 1, 8, 1, C.ferr) // ferrugem empoçada na laje
  sup(x - 6, w + 12, MARQUISE_Y)
  tapa(x - 6, w + 12, MARQUISE_Y)
  // sombra da marquise na fachada
  f.a(0.14)
  r(x + 4, MARQUISE_Y + 8, w - 8, 5, '#2b2a3e')
  f.a(1)

  // ── placa pendurada sob a marquise, com suportes e correntinha
  {
    const px = x + 148
    r(px + 2, MARQUISE_Y + 6, 1, 4, C.metalS) // correntes
    r(px + 14, MARQUISE_Y + 6, 1, 4, C.metalS)
    r(px, MARQUISE_Y + 10, 17, 12, C.madeira)
    r(px, MARQUISE_Y + 10, 17, 1, C.madeiraL)
    r(px + 16, MARQUISE_Y + 11, 1, 11, C.madeiraS)
    r(px + 2, MARQUISE_Y + 13, 13, 2, C.papel) // "PÃO"
    r(px + 3, MARQUISE_Y + 17, 11, 2, C.papel) // "QUENTE"
    p(px + 5, MARQUISE_Y + 13, C.madeira)
    p(px + 9, MARQUISE_Y + 17, C.madeira)
  }

  // ── letreiro PADARIA: caixa escura fixa; as letras acesas piscam na
  //    camada animada (desenhadas apagadas aqui por baixo)
  r(x + 22, 302, 126, 22, C.letreiro)
  r(x + 22, 302, 126, 1, '#4c525e')
  r(x + 22, 322, 126, 2, C.letreiroS)
  r(x + 146, 303, 2, 21, C.letreiroS)
  letreiroPadaria({ r, p }, 0, C.neonOff, C.neonOff)

  // ── térreo: vitrine, porta (90px, escala gente) e cartazes
  const vy = MARQUISE_Y + 11
  // porta dupla da padaria
  r(x + 62, base - 68, 34, 68, C.madeiraS)
  r(x + 63, base - 67, 15, 67, C.madeira)
  r(x + 80, base - 67, 15, 67, C.madeira)
  r(x + 63, base - 67, 15, 1, C.madeiraL)
  r(x + 80, base - 67, 15, 1, C.madeiraL)
  r(x + 65, base - 62, 11, 30, C.janSob) // bandeira de vidro
  r(x + 82, base - 62, 11, 30, C.janSob)
  for (let i = 0; i < 6; i++) {
    p(x + 66 + i, base - 40 - i, '#8b98a6')
    p(x + 83 + i, base - 40 - i, '#8b98a6')
  }
  p(x + 77, base - 30, C.amarelo) // maçaneta
  p(x + 81, base - 30, C.amarelo)
  // vitrines dos lados com prateleira de pão
  for (const vx of [x + 8, x + 104]) {
    r(vx, vy, 48, base - vy, C.vidro)
    r(vx, vy, 48, 1, C.vidroL)
    r(vx + 46, vy + 1, 2, base - vy - 1, C.vidroS)
    for (let i = 0; i < 12; i++) p(vx + 4 + i, vy + 18 - i, C.vidroL)
    // prateleiras com fila de pães
    for (const py2 of [vy + 12, vy + 24]) {
      r(vx + 4, py2, 40, 2, C.madeiraS)
      for (let bx = vx + 6; bx < vx + 42; bx += 7) {
        r(bx, py2 - 4, 5, 4, C.grafC)
        r(bx, py2 - 4, 5, 1, '#e0c887')
        p(bx + 2, py2 - 3, C.amareloS)
      }
    }
    // cartaz de promoção colado no vidro
    r(vx + 30, vy + 4, 14, 18, C.papel)
    r(vx + 32, vy + 6, 10, 3, C.vermelho)
    r(vx + 32, vy + 11, 10, 2, C.KS)
    r(vx + 32, vy + 15, 7, 2, C.KS)
    r(vx + 34, vy + 18, 6, 3, C.vermelho)
  }
  // rodapé azulejado do térreo
  r(x + 4, base - 6, w - 8, 6, C.azulejoAzul)
  r(x + 4, base - 6, w - 8, 1, C.azulejoAzulL)

  // ── varal entre o cano esquerdo e a janela: só a corda é estática
  for (let i = 0; i <= 46; i++) p(x + 10 + i, Math.round(222 + 4 * Math.sin((Math.PI * i) / 46)), C.fioL)
  r(x + 9, 220, 2, 3, C.metalS) // ganchos
  r(x + 56, 220, 2, 3, C.metalS)
}

/* Letras do PADARIA — compartilhadas entre o estático (apagado) e o
   animado (aceso piscando). Cada letra 12px de altura, grade 3x5 gorda. */
function letreiroPadaria(f2, t, corOn, corOff) {
  const { r } = f2
  const L = {
    P: [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0],
    A: [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1],
    D: [1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0],
    R: [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1],
    I: [1, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1],
  }
  const texto = 'PADARIA'
  const x0 = SOB_X + 30
  const y0 = 306
  for (let li = 0; li < texto.length; li++) {
    const g = L[texto[li]]
    const aceso = corOn === corOff ? false : !(li === 2 && Math.floor(t / 260) % 7 === 3) // o D falha
    const cor = corOn === corOff ? corOff : aceso ? corOn : corOff
    for (let gy = 0; gy < 5; gy++)
      for (let gx = 0; gx < 3; gx++)
        if (g[gy * 3 + gx]) r(x0 + li * 16 + gx * 4, y0 + gy * 3, 4, 3, cor)
  }
}

/* ── calçada portuguesa e rua ─────────────────────────────────────────── */

function calcada(f) {
  const { r, p } = f
  r(0, CALCADA_Y, LARG, GUIA_Y - CALCADA_Y, C.pedra)
  r(0, CALCADA_Y, LARG, 1, C.pedraS)

  const rm = rnd(41)
  for (let x = 3; x < LARG; x += 5 + Math.floor(rm() * 10)) {
    p(x, CALCADA_Y - 1, C.folha)
    p(x + 1, CALCADA_Y - 2, C.folhaL)
    if (rm() < 0.4) {
      p(x - 1, CALCADA_Y - 1, C.folhaL)
      p(x + 1, CALCADA_Y - 3, C.folha)
    }
  }

  // as ondas de pedra portuguesa — três faixas no calçadão mais fundo
  for (let x = 0; x < LARG; x += 2) {
    const t = (x >> 1) % 2 === 0
    const yA = 394 + Math.round(5 * Math.sin(x / 9))
    r(x, yA, 2, 2, t ? C.pedraEscL : C.pedraEsc)
    r(x, yA + 2, 2, 2, t ? C.pedraEsc : C.pedraEscD)
    r(x, yA + 4, 2, 1, t ? C.pedraEscD : C.pedraEsc)
    p(x, yA - 1, C.pedraS)
    const yB = 416 + Math.round(4 * Math.sin((x + 30) / 9))
    r(x, yB, 2, 2, t ? C.pedraEsc : C.pedraEscL)
    r(x, yB + 2, 2, 2, t ? C.pedraEscD : C.pedraEsc)
    p(x, yB - 1, C.pedraS)
    const yC = 430 + Math.round(3 * Math.sin((x + 64) / 9))
    r(x, yC, 2, 2, t ? C.pedraEscL : C.pedraEscD)
    p(x, yC - 1, C.pedraS)
  }

  const rr = rnd(17)
  for (let y = CALCADA_Y + 2; y < GUIA_Y; y += 3)
    for (let x = y % 6 === 0 ? 0 : 2; x < LARG; x += 4) {
      const s = rr()
      if (s < 0.3) p(x, y, C.pedraS)
      else if (s < 0.42) r(x, y, 2, 1, C.pedraL)
    }

  r(0, GUIA_Y, LARG, 1, C.pedra)
  r(0, GUIA_Y + 1, LARG, 4, C.guia)
  r(0, GUIA_Y + 4, LARG, 1, C.guiaF)
  for (let jx = 20; jx < LARG; jx += 38) r(jx, GUIA_Y + 1, 1, 4, C.guiaF)
  for (const bx of [420, 940]) {
    r(bx, GUIA_Y + 1, 26, 4, C.asfaltoS)
    r(bx + 1, GUIA_Y + 2, 24, 3, '#3a3840')
    r(bx, GUIA_Y + 1, 26, 1, C.guiaF)
  }
  for (const gx of [128, 508, 780, 1054, 1240]) {
    p(gx, GUIA_Y, C.folha)
    p(gx + 1, GUIA_Y - 1, C.folhaL)
    p(gx - 1, GUIA_Y + 1, C.folha)
  }
  r(0, RUA_Y, LARG, ALT - RUA_Y, C.asfalto)
  r(0, RUA_Y, LARG, 2, C.asfaltoS)
  for (let x = 0; x < LARG; x += 3) if (rnd(x + 5)() < 0.28) p(x, RUA_Y + 6 + (x % 11), C.asfaltoL)
  r(150, RUA_Y + 6, 48, 10, C.asfaltoS) // remendo
  r(151, RUA_Y + 7, 46, 8, C.asfaltoL)
  r(700, RUA_Y + 14, 40, 8, C.asfaltoS)
  r(701, RUA_Y + 15, 38, 6, C.asfaltoL)
  r(0, RUA_Y + 13, LARG, 1, C.asfaltoS)
  // faixa de pedestres na frente do semáforo
  for (let i = 0; i < 6; i++) {
    r(1174 + i * 16, RUA_Y + 4, 10, ALT - RUA_Y - 6, '#c9c6bb')
    r(1174 + i * 16, RUA_Y + 4, 10, 2, '#dad7cc')
    r(1176 + i * 16, RUA_Y + 24, 7, 3, C.asfaltoL) // desgaste da tinta
  }
}

/* ── sombras ─────────────────────────────────────────────────────────────
   Luz de cima-à-esquerda ⇒ toda coisa em pé joga sombra pra DIREITA no
   chão, comprimento ~metade da altura, em degraus que afinam. */

function sombraChao({ r, a }, x, w) {
  a(0.2)
  r(x, CHAO - 1, w, 2, '#2b2a2e')
  r(x + 2, CHAO + 1, w - 4, 1, '#2b2a2e')
  a(1)
}

function sombraLonga({ r, a }, x, w, alt) {
  const comp = Math.round(alt * 0.5)
  a(0.14)
  r(x + w - 2, CHAO - 1, comp, 3, '#2b2a2e')
  r(x + w + Math.round(comp * 0.45), CHAO + 2, Math.round(comp * 0.55), 2, '#2b2a2e')
  r(x + w + comp - 4, CHAO + 4, 6, 1, '#2b2a2e')
  a(1)
}

/** Sombra que um objeto encostado joga no MURO, deslocada pra direita. */
function sombraMuro({ r, a }, x, w, topo) {
  const y0 = Math.max(MURO_Y + 5, topo + 4)
  a(0.1)
  r(x + w + 2, y0, Math.max(4, Math.round(w * 0.14)), CALCADA_Y + 8 - y0, '#2b2a3e')
  a(1)
}

/* ── mobiliário ──────────────────────────────────────────────────────────
   Daqui pra baixo tudo divide o plano com o pombo: contorno #26201c,
   sombra própria no chão + sombra LONGA pra direita + sombra no muro. */

function banca(f) {
  const { r, p, cont, bloco } = f
  const x = 30
  const w = 150
  const topo = 322
  sombraMuro(f, x, w, topo)
  sombraChao(f, x - 3, w + 8)
  sombraLonga(f, x, w, CHAO - topo)

  bloco(x + 3, topo + 8, w - 6, CHAO - topo - 8, C.verde, C.verdeL, C.verdeS)
  cont(x + 3, topo + 8, w - 6, CHAO - topo - 8)
  bloco(x, topo, w, 8, C.verde, C.verdeL, C.verdeS)
  cont(x, topo, w, 8)
  r(x, topo + 7, w, 1, C.verdeS)
  sup(x, w, topo)
  // rádio de pilha e antena em cima da banca
  r(x + 116, topo - 8, 12, 8, C.metal)
  r(x + 116, topo - 8, 12, 1, C.metalL)
  r(x + 126, topo - 7, 1, 7, C.metalS)
  p(x + 118, topo - 6, C.amarelo)
  r(x + 121, topo - 6, 5, 4, C.metalS)
  r(x + 127, topo - 14, 1, 6, C.metalS)
  cont(x + 116, topo - 8, 12, 8, C.KS)
  sup(x + 116, 12, topo - 8)

  // tinta descascada e remendo no corpo da banca
  p(x + 22, topo + 30, C.madeiraL)
  r(x + 23, topo + 31, 2, 1, C.madeira)
  r(x + 96, topo + 52, 3, 2, C.verdeS)
  p(x + 97, topo + 53, C.madeira)
  r(x + 58, topo + 74, 4, 2, C.verdeS)

  // vitrine de revistas: 3 prateleiras x 8 capas
  const vx = x + 12
  const vy = topo + 20
  const vw = 86
  const vh = 58
  r(vx, vy, vw, vh, C.vidro)
  cont(vx, vy, vw, vh)
  r(vx, vy, vw, 1, C.vidroL)
  r(vx + vw - 1, vy + 1, 1, vh - 1, C.vidroS)
  const rr = rnd(31)
  for (let lin = 0; lin < 3; lin++)
    for (let col = 0; col < 8; col++) {
      const cx = vx + 4 + col * 10
      const cy = vy + 5 + lin * 18
      r(cx, cy, 8, 13, [C.grafA, C.grafC, C.azul, C.ipe, C.verdeL, C.vermelho][Math.floor(rr() * 6)])
      r(cx, cy, 8, 3, C.papel)
      r(cx + 1, cy + 5, 5, 4, rr() < 0.5 ? C.papel : C.amarelo) // figura da capa
      r(cx + 7, cy + 3, 1, 10, C.KS)
      r(cx, cy + 13, 8, 1, C.madeiraS) // prateleira
    }
  for (let i = 0; i < 17; i++) r(vx + 4 + i, vy + 20 - i, 2, 1, C.vidroL)
  for (let i = 0; i < 10; i++) r(vx + 30 + i, vy + 24 - i, 2, 1, C.vidroL)

  // toldo listrado com barra recortada
  r(x + 6, topo + 10, 108, 7, C.verde)
  r(x + 6, topo + 10, 108, 1, C.verdeL)
  for (let i = 0; i < 9; i++) r(x + 12 + i * 12, topo + 10, 6, 7, C.papel)
  for (let i = 0; i < 18; i++) p(x + 9 + i * 6, topo + 17, i % 2 ? C.papel : C.verdeS)
  cont(x + 6, topo + 10, 108, 7, C.KS)
  r(x + 7, topo + 18, 106, 1, C.verdeS)

  // varal de jornais na lateral direita
  r(x + 104, topo + 24, 38, 50, C.verdeS)
  cont(x + 104, topo + 24, 38, 50)
  r(x + 106, topo + 26, 34, 1, C.madeiraS)
  r(x + 106, topo + 48, 34, 1, C.madeiraS)
  for (let lin = 0; lin < 2; lin++)
    for (let i = 0; i < 4; i++) {
      const jx = x + 107 + i * 9
      const jy = topo + 27 + lin * 22
      r(jx, jy, 7, 16, C.papel)
      p(jx + 3, jy - 1, C.madeira)
      r(jx, jy + 2, 7, 2, C.KS)
      r(jx + 1, jy + 6, 5, 4, i % 2 ? C.azul : C.grafA)
      r(jx, jy + 12, 7, 1, C.KS)
      r(jx, jy + 14, 4, 1, C.KS)
    }
  r(x + 6, CHAO - 6, w - 12, 4, C.verdeS)
  // pilha de jornal amarrado esperando na porta
  r(x + 34, CHAO - 9, 16, 9, C.papel)
  r(x + 34, CHAO - 9, 16, 1, '#f7f4ea')
  r(x + 34, CHAO - 6, 16, 1, C.capaS)
  r(x + 34, CHAO - 3, 16, 1, C.capaS)
  r(x + 41, CHAO - 9, 2, 9, C.madeiraS) // barbante
  cont(x + 34, CHAO - 9, 16, 9, C.KS)
  sup(x + 34, 16, CHAO - 9)
  // balde de plástico ao lado do banquinho
  r(x + 79, CHAO - 9, 8, 9, C.azulL)
  r(x + 79, CHAO - 9, 8, 1, C.vidroT)
  r(x + 80, CHAO - 8, 2, 7, '#87a8cf')
  r(x + 85, CHAO - 8, 1, 8, C.azulS)
  r(x + 78, CHAO - 10, 10, 1, C.KS)
  r(x + 80, CHAO - 12, 6, 1, C.metalS) // alça
  p(x + 79, CHAO - 11, C.metalS)
  p(x + 86, CHAO - 11, C.metalS)
  // banquinho do jornaleiro
  r(x + 62, CHAO - 14, 12, 3, C.madeira)
  r(x + 62, CHAO - 14, 12, 1, C.madeiraL)
  r(x + 63, CHAO - 11, 2, 11, C.madeiraS)
  r(x + 71, CHAO - 11, 2, 11, C.madeiraS)
  cont(x + 62, CHAO - 14, 12, 3, C.KS)
}

/* Engradados e caixotes empilhados ao lado da banca — a bagunça boa. */
function engradados(f) {
  const { r, p, cont } = f
  const x = 190
  sombraChao(f, x - 2, 44)
  sombraLonga(f, x, 40, 42)
  // dois engradados plásticos empilhados
  for (const [ex, ey, cor, corL, corS] of [
    [x, CHAO - 16, C.plast, C.plastL, C.plastS],
    [x + 2, CHAO - 31, C.caixa, C.caixaL, C.caixaS],
  ]) {
    r(ex, ey, 26, 15, cor)
    r(ex, ey, 26, 1, corL)
    r(ex + 25, ey + 1, 1, 14, corS)
    for (let gx = ex + 3; gx < ex + 24; gx += 4) r(gx, ey + 3, 2, 9, corS)
    r(ex, ey + 12, 26, 1, corS)
    cont(ex, ey, 26, 15)
  }
  sup(x + 2, 26, CHAO - 31)
  // caixote de feira de madeira encostado, meio torto
  r(x + 28, CHAO - 13, 20, 13, C.madeira)
  r(x + 28, CHAO - 13, 20, 1, C.madeiraL)
  for (let gy = CHAO - 10; gy < CHAO; gy += 4) r(x + 28, gy, 20, 1, C.madeiraS)
  r(x + 33, CHAO - 13, 1, 13, C.madeiraS)
  r(x + 42, CHAO - 13, 1, 13, C.madeiraS)
  cont(x + 28, CHAO - 13, 20, 13)
  sup(x + 28, 20, CHAO - 13)
  // alface esquecida saindo do caixote
  p(x + 31, CHAO - 15, C.folhaL)
  r(x + 32, CHAO - 14, 3, 1, C.folha)
  // vassoura de garrafa PET apoiada na pilha
  r(x - 5, CHAO - 44, 2, 40, C.madeiraL)
  r(x - 5, CHAO - 44, 1, 40, C.madeira)
  r(x - 8, CHAO - 6, 7, 4, C.grafC)
  r(x - 8, CHAO - 2, 7, 2, C.amareloS)
  cont(x - 8, CHAO - 6, 7, 6, C.KS)
}

function orelhao(f) {
  const { r, p, cont } = f
  const cx = 262
  const topo = 330
  sombraChao(f, cx - 13, 26)
  sombraLonga(f, cx - 11, 22, CHAO - topo)

  r(cx - 3, topo + 34, 6, CHAO - topo - 34, C.metal)
  cont(cx - 3, topo + 34, 6, CHAO - topo - 34)
  r(cx - 3, topo + 34, 2, CHAO - topo - 34, C.metalL)
  r(cx - 7, CHAO - 4, 14, 4, C.metalS)
  cont(cx - 7, CHAO - 4, 14, 4)

  // casulo laranja — capacete de fibra em degraus, topo achatado (poleiro)
  const meia = [12, 15, 17, 18, 19, 20, 20, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 20, 20, 20, 19, 19, 18, 17, 15]
  for (let i = 0; i < meia.length; i++) {
    const hw = meia[i]
    const y = topo + i
    r(cx - hw, y, hw * 2, 1, C.laranja)
    r(cx - hw, y, Math.max(1, Math.round(hw * 0.45)), 1, C.laranjaL)
    r(cx + hw - 3, y, 3, 1, C.laranjaS)
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
  r(cx - 12, topo - 1, 24, 1, C.K)
  r(cx - 12, topo, 24, 1, C.laranjaL)
  r(cx - 15, topo + meia.length, 30, 1, C.K)
  r(cx - 15, topo + meia.length - 3, 30, 3, C.laranjaS)
  sup(cx - 12, 24, topo)

  // boca do casulo com telefone e fone no gancho
  r(cx - 18, topo + 6, 25, 22, C.laranjaS)
  r(cx - 17, topo + 7, 23, 20, C.KS)
  r(cx - 14, topo + 10, 16, 15, C.metal)
  r(cx - 14, topo + 10, 16, 1, C.metalL)
  r(cx - 12, topo + 13, 8, 6, C.vidroS)
  r(cx - 11, topo + 13, 3, 2, C.vidro)
  r(cx - 12, topo + 21, 8, 3, C.metalS)
  p(cx - 11, topo + 21, C.metalL)
  p(cx - 8, topo + 21, C.metalL)
  p(cx - 6, topo + 22, C.metalL)
  r(cx - 2, topo + 12, 3, 10, C.KS)
  r(cx - 5, topo + 12, 3, 2, C.KS)
  r(cx - 5, topo + 20, 3, 2, C.KS)
  p(cx, topo + 24, C.KS)
  p(cx - 1, topo + 25, C.KS)
  p(cx, topo + 26, C.KS)

  // brilho de fibra no ombro iluminado
  r(cx - 16, topo + 5, 3, 6, C.laranjaBri)
  r(cx - 13, topo + 3, 3, 3, C.laranjaBri)
  r(cx - 10, topo + 2, 2, 2, C.laranjaBri)

  // adesivos e figurinhas coladas na lateral direita
  r(cx + 9, topo + 12, 5, 5, C.papel)
  p(cx + 11, topo + 14, C.grafA)
  r(cx + 6, topo + 20, 6, 3, C.azulL)
  r(cx + 12, topo + 26, 5, 3, C.amarelo)
  p(cx + 13, topo + 27, C.KS)
  // ferrugem na haste
  p(cx + 1, topo + 44, C.ferr)
  r(cx + 1, topo + 58, 1, 4, C.ferr)
}

function posteLuz(f) {
  const { r, p, cont } = f
  const x = 318
  const topoLum = 222
  sombraChao(f, x - 4, 12)
  // sombra COMPRIDA do poste tombada pra direita — 180px de poste, 90 de sombra
  f.a(0.1)
  f.r(x + 4, CHAO + 1, 52, 2, '#2b2a2e')
  f.r(x + 50, CHAO + 3, 34, 2, '#2b2a2e')
  f.r(x + 80, CHAO + 5, 14, 1, '#2b2a2e')
  f.a(1)
  r(x, 232, 1, CHAO - 232, C.metalL)
  r(x + 1, 232, 2, CHAO - 232, C.metal)
  r(x + 3, 232, 1, CHAO - 232, C.metalS)
  r(x - 4, CHAO - 7, 12, 7, C.metalS)
  cont(x - 4, CHAO - 7, 12, 7)
  // braço e luminária — o poleiro alto
  r(x + 4, 226, 8, 3, C.metal)
  r(x + 4, 226, 8, 1, C.metalL)
  cont(x + 4, 226, 8, 3)
  r(x + 8, topoLum, 22, 6, C.metal)
  r(x + 8, topoLum, 22, 1, C.metalL)
  r(x + 8, topoLum + 5, 22, 1, C.metalS)
  cont(x + 8, topoLum, 22, 6)
  r(x + 11, topoLum + 6, 16, 3, C.amarelo)
  r(x + 12, topoLum + 9, 14, 1, C.amareloS)
  sup(x + 8, 22, topoLum)
  // plaquinha, patrimônio, ferrugem
  r(x - 1, 310, 6, 8, C.azul)
  r(x - 1, 310, 6, 1, C.azulL)
  r(x, 313, 4, 2, C.papel)
  p(x + 2, 322, C.ferr)
  r(x + 2, 356, 1, 6, C.ferr)
  p(x + 1, 380, C.ferr)
  // fita de "cuidado" esquecida enrolada no poste
  r(x - 1, 340, 6, 2, C.amarelo)
  r(x - 1, 344, 6, 2, C.amarelo)
  p(x + 1, 341, C.KS)
  p(x + 3, 345, C.KS)

  // bicicleta acorrentada no poste
  const bx = x - 28
  const by = CHAO - 1
  f.a(0.14)
  f.r(bx - 2, by - 1, 46, 2, '#2b2a2e')
  f.a(1)
  // rodas: aro em degraus
  for (const wx of [bx, bx + 26]) {
    for (const [dx, dy, dw] of [
      [3, -12, 6],
      [1, -11, 2],
      [9, -11, 2],
      [0, -9, 2],
      [10, -9, 2],
      [-1, -7, 2],
      [11, -7, 2],
      [0, -5, 2],
      [10, -5, 2],
      [1, -3, 2],
      [9, -3, 2],
      [3, -2, 6],
    ])
      r(wx + dx, by + dy, dw, 1, C.metalS)
    p(wx + 5, by - 7, C.metal) // cubo
    r(wx + 5, by - 11, 1, 4, C.metalL) // raio
    r(wx + 2, by - 7, 3, 1, C.metalL)
  }
  // quadro
  r(bx + 6, by - 13, 16, 2, C.vermelho)
  r(bx + 10, by - 10, 10, 2, C.vermelho)
  r(bx + 8, by - 12, 2, 4, C.vermelhoS)
  r(bx + 20, by - 16, 2, 5, C.metalS) // canote e selim
  r(bx + 18, by - 18, 6, 2, C.KS)
  r(bx + 4, by - 17, 2, 5, C.metalS) // guidão
  r(bx + 2, by - 18, 6, 2, C.metalS)
  p(bx + 13, by - 9, C.K) // pedivela
  r(bx + 12, by - 8, 3, 1, C.metalS)
  // corrente até o poste
  for (let i = 0; i < 9; i++) p(bx + 24 + i, by - 14 + (i % 2), '#3f3d46')
}

/* Banco de praça: 110px, ripas de madeira + pés de concreto, com ENCOSTO —
   dois níveis pousáveis (encosto e assento). */
function banco(f, x) {
  const { r, p, cont, bloco } = f
  const w = 110
  const yEnc = 360
  const yAss = 380
  sombraChao(f, x - 3, w + 6)
  sombraLonga(f, x, w, CHAO - yEnc)
  // pés de concreto
  for (const px of [x + 10, x + 86]) {
    bloco(px, yAss + 8, 12, CHAO - yAss - 8, C.conc, C.concL, C.concS)
    cont(px, yAss + 8, 12, CHAO - yAss - 8)
    bloco(px - 2, CHAO - 5, 16, 5, C.conc, C.concL, C.concS)
    cont(px - 2, CHAO - 5, 16, 5)
  }
  // montantes do encosto (curvinha de concreto)
  for (const px of [x + 13, x + 89]) {
    r(px, yEnc + 2, 5, yAss - yEnc - 2, C.conc)
    r(px, yEnc + 2, 1, yAss - yEnc - 2, C.concL)
    r(px + 4, yEnc + 3, 1, yAss - yEnc - 3, C.concS)
    cont(px, yEnc + 2, 5, yAss - yEnc - 2)
  }
  const rv = rnd(x * 13)
  // encosto: 2 ripas
  for (let i = 0; i < 2; i++) {
    const y = yEnc + i * 7
    r(x, y, w, 4, C.madeira)
    r(x, y, w, 1, C.madeiraL)
    r(x, y + 3, w, 1, C.madeiraS)
    for (let vx = x + 4 + Math.floor(rv() * 8); vx < x + w - 6; vx += 12 + Math.floor(rv() * 9))
      r(vx, y + 2, 3 + Math.floor(rv() * 3), 1, C.madeiraS)
    cont(x, y, w, 4)
  }
  // sombra do assento nos pés
  f.a(0.13)
  f.r(x + 2, yAss + 10, w - 4, 3, '#2b2a3e')
  f.a(1)
  // assento: 3 ripas
  for (let i = 0; i < 3; i++) {
    const y = yAss + i * 3
    r(x, y, w, 2, C.madeira)
    r(x, y, w, 1, C.madeiraL)
    for (let vx = x + 5 + Math.floor(rv() * 8); vx < x + w - 7; vx += 11 + Math.floor(rv() * 8))
      r(vx, y + 1, 3 + Math.floor(rv() * 3), 1, C.madeiraS)
    if (i < 2) r(x, y + 2, w, 1, C.madeiraS)
  }
  cont(x, yAss, w, 8)
  // parafusos e nó
  for (const px of [x + 15, x + 91]) {
    p(px, yAss + 1, C.metalS)
    p(px, yAss + 7, C.metalS)
  }
  p(x + 30 + Math.floor(rv() * 40), yAss + 4, C.madeiraS)
  // iniciais gravadas no encosto
  r(x + 44, yEnc + 1, 1, 2, C.madeiraS)
  r(x + 46, yEnc + 1, 2, 1, C.madeiraS)
  p(x + 46, yEnc + 2, C.madeiraS)
  sup(x, w, yEnc)
  sup(x, w, yAss)
}

/* Coreto de ~200px: telhado telha a telha, lanterna no topo, colunas,
   guarda-corpo, piso de tábua e escadaria — o coração da praça. */
function coreto(f) {
  const { r, p, cont, bloco } = f
  const cx = 580
  const topoLan = 205
  const yTelhado = 216
  const yEave = 278

  sombraChao(f, cx - 126, 252)
  sombraLonga(f, cx - 120, 244, 140)

  // base de concreto em dois degraus
  bloco(cx - 120, 394, 240, 8, C.conc, C.concL, C.concS)
  cont(cx - 120, 394, 240, 8)
  bloco(cx - 36, 402, 72, 6, C.conc, C.concL, C.concS)
  cont(cx - 36, 402, 72, 6)
  sup(cx - 120, 240, 394)
  // rachadura e musgo na base
  r(cx - 80, 398, 8, 1, C.concS)
  p(cx - 74, 399, C.concS)
  r(cx + 60, 396, 5, 2, C.hera)
  r(cx + 96, 400, 4, 1, C.heraS)

  // fundo do vão: piso de tábua e guarda-corpo de trás
  r(cx - 114, 382, 228, 12, C.madeira)
  r(cx - 114, 382, 228, 1, C.madeiraL)
  for (let bx = cx - 114; bx < cx + 114; bx += 12) r(bx, 383, 1, 11, C.madeiraS)
  r(cx - 114, 360, 228, 2, C.verdeS)
  for (let bx = cx - 110; bx < cx + 112; bx += 9) r(bx, 362, 1, 20, C.verdeS)

  // meia-luz do vão
  f.a(0.16)
  f.r(cx - 114, 282, 228, 112, '#2b2a3a')
  f.a(1)
  f.a(0.14)
  f.r(cx - 114, 283, 228, 7, '#2b2a3a')
  f.a(1)

  // colunas
  for (const dx of [-114, -69, -24, 21, 66, 108]) {
    r(cx + dx, 282, 6, 112, C.verde)
    r(cx + dx, 282, 2, 112, C.verdeL)
    r(cx + dx + 5, 283, 1, 111, C.verdeS)
    cont(cx + dx, 282, 6, 112)
    // capitel e base simples
    r(cx + dx - 1, 282, 8, 3, C.verde)
    r(cx + dx - 1, 282, 8, 1, C.verdeL)
    r(cx + dx - 1, 390, 8, 4, C.verdeS)
    // tinta lascada
    p(cx + dx + 2, 300 + ((dx * 7) % 41 + 41) % 41, C.madeiraL)
    p(cx + dx + 3, 372 - ((dx * 5) % 29 + 29) % 29, C.madeira)
    p(cx + dx + 1, 340 + ((dx * 11) % 23 + 23) % 23, C.madeira)
  }
  // corrimão da frente com balaústres
  for (const dx of [-108, -63, -18, 27, 72]) {
    r(cx + dx, 356, 36, 4, C.madeira)
    r(cx + dx, 356, 36, 1, C.madeiraL)
    r(cx + dx + 6, 358, 8, 1, C.madeiraS)
    r(cx + dx + 22, 357, 7, 1, C.madeiraS)
    r(cx + dx, 386, 36, 3, C.verde)
    r(cx + dx, 386, 36, 1, C.verdeL)
    for (let i = 0; i < 9; i++) r(cx + dx + 2 + i * 4, 360, 2, 26, C.verdeS)
  }

  // telhado: cone em degraus, telha a telha
  const linhas = yEave - yTelhado
  const hwDe = (i) => Math.round(22 + 96 * Math.pow(i / linhas, 1.35))
  for (let i = 0; i <= linhas; i++) {
    const hw = hwDe(i)
    const y = yTelhado + i
    tapa(cx - hw - 1, hw * 2 + 2, y)
    const fiada = Math.floor(i / 4)
    const separo = i % 4 === 3
    const fundo = i > 46 ? C.telhaS : C.telha
    r(cx - hw, y, hw * 2, 1, separo ? (i > 44 ? C.telhaV : C.telhaS) : fundo)
    if (!separo) {
      r(cx - hw + 1, y, Math.max(1, Math.round(hw * (i < 22 ? 0.5 : 0.32))), 1, i > 46 ? C.telha : C.telhaL)
      for (let tx = cx - hw + 4 + (fiada % 2) * 4; tx < cx + hw - 2; tx += 8)
        p(tx, y, i > 46 ? C.telhaV : C.telhaS)
      r(cx + hw - 3, y, 3, 1, i > 44 ? C.telhaV : C.telhaS)
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
  // telha quebrada: duas falhas escuras no pano
  r(cx - 40, yTelhado + 26, 5, 2, C.telhaV)
  p(cx - 36, yTelhado + 25, C.KS)
  r(cx + 58, yTelhado + 44, 6, 2, C.telhaV)
  // musgo no beiral
  r(cx - 96, yEave - 2, 7, 1, C.heraS)
  r(cx + 30, yEave - 1, 5, 1, C.heraS)
  r(cx - 122, yEave + 1, 244, 2, C.telhaS)
  r(cx - 122, yEave + 3, 244, 1, C.telhaV)
  cont(cx - 122, yEave + 1, 244, 3)
  r(cx - 118, yEave + 5, 236, 1, C.verdeS)
  // lambrequim: barrado recortado pendurado no beiral
  for (let lx = cx - 118; lx < cx + 118; lx += 6) {
    r(lx, yEave + 6, 4, 3, C.verde)
    p(lx + 1, yEave + 9, C.verdeS)
  }

  // lanterna do topo — o poleiro nobre
  tapa(cx - 21, 42, topoLan)
  r(cx - 20, topoLan + 1, 40, 5, C.telha)
  r(cx - 20, topoLan + 1, 40, 1, C.telhaL)
  r(cx - 20, topoLan + 5, 40, 1, C.telhaS)
  cont(cx - 20, topoLan + 1, 40, 5)
  r(cx - 15, topoLan + 7, 30, 8, C.verde)
  r(cx - 15, topoLan + 7, 30, 1, C.verdeL)
  for (let i = 0; i < 7; i++) r(cx - 13 + i * 4, topoLan + 8, 2, 6, C.verdeS)
  cont(cx - 15, topoLan + 7, 30, 8)
  sup(cx - 20, 40, topoLan + 1)
}

/* ── jacarandá ─────────────────────────────────────────────────────────── */

function copaJacaranda(f, cxT) {
  const { r } = f
  const X0 = 722
  const X1 = 902
  const Y0 = 138
  const Y1 = 292
  const W = X1 - X0
  const H = Y1 - Y0
  const masc = new Uint8Array(W * H)
  const lobos = [
    [cxT - 3, 194, 44, 1.45],
    [cxT - 40, 200, 30, 1.2],
    [cxT + 36, 194, 31, 1.25],
    [cxT - 22, 172, 27, 1.4],
    [cxT + 16, 168, 26, 1.5],
    [cxT - 58, 210, 20, 1.1],
    [cxT + 60, 208, 19, 1.15],
    [cxT + 4, 218, 36, 1.05],
    [cxT - 50, 182, 15, 1.2],
    [cxT + 48, 178, 14, 1.25],
  ]
  for (const [lx, ly, lr, sq] of lobos)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const dx = X0 + x - lx
        const dy = (Y0 + y - ly) * sq
        if (dx * dx + dy * dy <= lr * lr) masc[y * W + x] = 1
      }

  const rr = rnd(77)
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
  for (let i = 0; i < 150; i++) {
    const px = Math.round(cxT - 70 + rr() * 140)
    const py = Math.round(Y0 + 10 + rr() * 104)
    const mx = px - X0
    const my = py - Y0
    if (mx < 1 || mx >= W - 4 || my < 1 || my >= H - 4) continue
    if (!masc[my * W + mx] || !masc[my * W + mx + 3] || !masc[(my + 2) * W + mx]) continue
    const t = rr()
    const cor = t < 0.36 ? C.ipeL : t < 0.6 ? C.ipeS : t < 0.86 ? C.flor : C.ceuC
    r(px, py, 2 + Math.floor(rr() * 3), t < 0.86 ? 2 : 1, cor)
  }
  for (const [bx, by] of [
    [cxT - 30, 182],
    [cxT + 10, 176],
    [cxT - 8, 198],
    [cxT + 36, 192],
    [cxT - 46, 202],
    [cxT + 22, 210],
    [cxT - 16, 214],
  ]) {
    r(bx, by, 6, 3, C.flor)
    r(bx + 1, by - 1, 4, 1, C.flor)
    r(bx - 1, by + 2, 3, 1, C.ipeL)
    r(bx + 5, by + 3, 3, 1, C.ipeL)
  }
}

function jacaranda(f) {
  const { r, p, cont, bloco } = f
  const x = 756
  const w = 112
  const topo = 372
  const cxT = 812
  const rr = rnd(99)

  // tronco cônico com casca marcada, e galhos por baixo da copa
  for (let y = 246; y < topo + 3; y++) {
    const hw = 5 + Math.floor((y - 246) / 22)
    r(cxT - hw, y, hw * 2, 1, C.tronco)
    r(cxT - hw, y, 3, 1, C.troncoL)
    r(cxT + hw - 2, y, 2, 1, C.troncoS)
    if (y % 5 === 2) p(cxT + hw - 4, y, C.troncoS)
    if (y % 7 === 3) p(cxT - hw + 3, y, C.troncoL)
    if (y > 288) {
      p(cxT - hw - 1, y, C.K)
      p(cxT + hw, y, C.K)
    }
  }
  r(cxT - 3, 322, 4, 6, C.troncoS) // oco
  p(cxT - 2, 324, C.K)
  r(cxT + 2, 300, 3, 3, C.troncoS)
  r(cxT - 6, 350, 3, 2, C.troncoS) // cicatriz de poda
  for (const [gx, gy, gw] of [
    [cxT - 26, 252, 24],
    [cxT + 5, 244, 24],
    [cxT - 16, 236, 15],
    [cxT + 9, 258, 16],
    [cxT - 34, 262, 12],
  ]) {
    r(gx, gy, gw, 3, C.tronco)
    r(gx, gy, gw, 1, C.troncoL)
  }
  copaJacaranda(f, cxT)
  for (const [ax, ay] of [
    [cxT - 22, 208],
    [cxT + 18, 212],
    [cxT - 4, 220],
    [cxT + 34, 200],
  ]) {
    r(ax, ay, 4, 2, C.troncoS)
    r(ax + 1, ay - 1, 3, 1, C.troncoS)
    p(ax + 4, ay - 2, C.tronco)
    p(ax - 1, ay + 2, C.ipeK)
  }

  sombraChao(f, x - 3, w + 6)
  sombraLonga(f, x, w, CHAO - topo + 60)
  bloco(x, topo, w, CHAO - topo, C.azulejo, '#f4f2eb', C.azulejoS)
  cont(x, topo, w, CHAO - topo)
  r(x, topo + 4, w, 1, C.azulejoS)
  r(x, CHAO - 6, w, 6, C.azulejoAzul)
  r(x, CHAO - 6, w, 1, C.azulejoAzulL)
  for (let gy = topo + 9; gy < CHAO - 8; gy += 8)
    for (let gx = x + 6; gx < x + w - 6; gx += 9) {
      p(gx + 1, gy, C.azulejoAzul)
      r(gx, gy + 1, 3, 1, C.azulejoAzul)
      p(gx + 1, gy + 2, C.azulejoAzul)
      p(gx + 1, gy + 1, C.azulejoAzulL)
    }
  // azulejo rachado e remendado
  r(x + 30, topo + 12, 1, 8, C.azulejoS)
  p(x + 31, topo + 16, C.azulejoS)
  r(x + 84, topo + 20, 6, 5, C.conc)
  r(x + 3, topo + 5, w - 6, 4, C.terra)
  for (let i = 0; i < 34; i++) r(x + 5 + Math.floor(rr() * (w - 10)), topo + 3, 1, 4, rr() < 0.5 ? C.folha : C.folhaL)
  sup(x, w, topo)

  // tapete roxo de flor caída
  for (let i = 0; i < 60; i++) {
    const fx = Math.round(cxT - 70 + rr() * 140)
    const fy = CHAO + 1 + Math.floor(rr() * 22)
    p(fx, fy, rr() < 0.5 ? C.ipe : C.ipeL)
    if (rr() < 0.3) p(fx + 1, fy, C.ipeS)
  }
  for (let i = 0; i < 40; i++) {
    const fx = Math.round(cxT - 36 + rr() * 72)
    const fy = CHAO + 1 + Math.floor(rr() * 12)
    r(fx, fy, rr() < 0.4 ? 2 : 1, 1, rr() < 0.55 ? C.flor : C.ipeL)
  }
  for (const [fx, fy] of [
    [x + 18, topo - 1],
    [x + 47, topo - 1],
    [x + 80, topo - 1],
    [x + 62, topo + 2],
    [942, 358],
    [949, 359],
    [935, 360],
  ])
    p(fx, fy, C.flor)
  p(x + 48, topo - 1, C.ipeL)
}

/* Carrocinha de milho verde — panela fumegando (fumaça na camada animada). */
function carrocinha(f) {
  const { r, p, cont, bloco } = f
  const x = 698
  const w = 54
  sombraChao(f, x - 3, w + 8)
  sombraLonga(f, x, w, 70)

  // rodas de madeira: aro cheio de 3px, raios em cruz, cubo de metal
  for (const wx of [x + 6, x + 34]) {
    const meia = [4, 6, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7, 6, 4]
    for (let i = 0; i < meia.length; i++) {
      const hw = meia[i]
      const y = CHAO - 20 + i
      r(wx + 8 - hw, y, hw * 2, 1, C.madeiraS)
    }
    const meiaIn = [0, 0, 2, 4, 5, 5, 6, 6, 6, 6, 5, 5, 4, 2, 0, 0]
    for (let i = 0; i < meiaIn.length; i++) {
      const hw = meiaIn[i]
      if (!hw) continue
      r(wx + 8 - hw, CHAO - 20 + i, hw * 2, 1, C.madeira)
    }
    r(wx + 7, CHAO - 18, 2, 13, C.madeiraS) // raios
    r(wx + 2, CHAO - 13, 12, 2, C.madeiraS)
    r(wx + 6, CHAO - 14, 4, 4, C.metalS) // cubo
    p(wx + 7, CHAO - 13, C.metalL)
    p(wx + 3, CHAO - 18, C.madeiraL) // brilho do aro
    p(wx + 5, CHAO - 19, C.madeiraL)
  }
  // caixa da carroça
  bloco(x + 2, 356, w - 4, 34, C.papel, '#f7f4ea', C.capaS)
  cont(x + 2, 356, w - 4, 34)
  r(x + 2, 372, w - 4, 3, C.vermelho) // faixa vermelha
  // "MILHO" rústico pintado
  for (const [tx, tw] of [
    [x + 8, 4],
    [x + 14, 3],
    [x + 19, 4],
    [x + 25, 4],
    [x + 31, 4],
  ])
    r(tx, 380, tw, 2, C.verdeS)
  r(x + 8, 384, 27, 1, C.verdeS)
  // vitrine com espigas
  r(x + 8, 359, 30, 10, C.vidroS)
  r(x + 9, 360, 28, 8, C.KS)
  for (let mx = x + 10; mx < x + 36; mx += 5) {
    r(mx, 362, 4, 2, C.milho)
    r(mx, 364, 4, 1, C.amareloS)
    p(mx + 3, 361, C.folha)
  }
  // panela no tampo, com tampa e cabo
  r(x + 40, 348, 12, 8, C.metal)
  r(x + 40, 348, 12, 1, C.metalL)
  r(x + 51, 349, 1, 7, C.metalS)
  r(x + 41, 346, 10, 2, C.metalL)
  p(x + 45, 344, C.metalS)
  cont(x + 40, 348, 12, 8, C.KS)
  // toldo listrado em duas hastes
  for (const hx of [x + 4, x + 44]) r(hx, 340, 2, 16, C.metalS)
  r(x, 336, 50, 6, C.lona)
  r(x, 336, 50, 1, C.lonaL)
  for (let i = 0; i < 4; i++) r(x + 5 + i * 12, 336, 6, 6, C.papel)
  for (let i = 0; i < 8; i++) p(x + 2 + i * 6, 342, i % 2 ? C.papel : C.lonaS)
  cont(x, 336, 50, 6, C.KS)
  r(x + 1, 343, 48, 1, C.lonaS)
  sup(x, 50, 336)
  // remendo na lona
  r(x + 28, 338, 4, 3, C.lonaS)
  // chaminé de lata da fornalha, com fuligem (fumaça animada sai daqui)
  r(x + 47, 332, 3, 14, C.metal)
  r(x + 47, 332, 1, 14, C.metalL)
  r(x + 46, 330, 5, 2, C.metalS)
  p(x + 48, 336, C.KS)
  // alças de empurrar
  r(x - 8, 366, 10, 2, C.madeira)
  r(x - 8, 366, 10, 1, C.madeiraL)
  cont(x - 8, 366, 10, 2, C.KS)
  // caixa de isopor no chão, do lado da alça
  r(x - 14, CHAO - 11, 12, 11, C.azulL)
  r(x - 14, CHAO - 11, 12, 2, C.vidroT)
  r(x - 3, CHAO - 10, 1, 10, C.azulS)
  r(x - 14, CHAO - 6, 12, 1, C.azulS)
  cont(x - 14, CHAO - 11, 12, 11, C.KS)
  sup(x - 14, 12, CHAO - 11)
}

function hidrante(f) {
  const { r, p, cont } = f
  const x = 636
  const topo = 378
  sombraChao(f, x - 5, 20)
  sombraLonga(f, x, 10, CHAO - topo)
  r(x, topo + 5, 10, CHAO - topo - 5, C.vermelho)
  r(x, topo + 5, 3, CHAO - topo - 5, C.vermelhoL)
  r(x + 9, topo + 6, 1, CHAO - topo - 6, C.vermelhoS)
  cont(x, topo + 5, 10, CHAO - topo - 5)
  r(x - 4, topo + 9, 4, 5, C.vermelhoS)
  cont(x - 4, topo + 9, 4, 5)
  p(x - 3, topo + 10, C.vermelho)
  r(x + 10, topo + 9, 4, 5, C.vermelhoS)
  cont(x + 10, topo + 9, 4, 5)
  r(x + 1, topo + 1, 8, 4, C.vermelho)
  r(x + 2, topo, 6, 1, C.vermelhoL)
  r(x + 1, topo + 1, 3, 2, C.vermelhoL)
  r(x + 8, topo + 2, 1, 3, C.vermelhoS)
  r(x + 2, topo - 1, 6, 1, C.K)
  r(x + 1, topo, 1, 1, C.K)
  r(x + 8, topo, 1, 1, C.K)
  r(x, topo + 1, 1, 4, C.K)
  r(x + 9, topo + 1, 1, 4, C.K)
  p(x + 4, topo + 1, C.vermelhoS)
  p(x + 7, topo + 12, C.ferr)
  r(x + 7, topo + 16, 1, 3, C.ferr)
  r(x - 1, CHAO - 4, 12, 4, C.vermelhoS)
  cont(x - 1, CHAO - 4, 12, 4)
  sup(x + 1, 8, topo)
}

function lixeira(f) {
  const { r, p, cont, bloco } = f
  const x = 1038
  const w = 24
  const topo = 366
  sombraChao(f, x - 3, w + 6)
  sombraLonga(f, x, w, CHAO - topo)
  bloco(x + 1, topo + 6, w - 2, CHAO - topo - 6, C.verde, C.verdeL, C.verdeS)
  cont(x + 1, topo + 6, w - 2, CHAO - topo - 6)
  for (let i = 0; i < 5; i++) r(x + 4 + i * 4, topo + 11, 2, CHAO - topo - 18, C.verdeS)
  r(x + 6, topo + 20, 5, 4, C.papel)
  p(x + 7, topo + 21, C.grafB)
  p(x + 17, topo + 30, C.metal)
  r(x + 4, topo + 14, 2, 2, C.madeiraL) // tinta lascada
  bloco(x, topo, w, 6, C.verde, C.verdeL, C.verdeS)
  cont(x, topo, w, 6)
  r(x + 8, topo + 1, 8, 2, C.verdeS)
  r(x + 16, topo + 5, 5, 2, C.papel)
  p(x + 20, topo + 6, C.KS)
  sup(x, w, topo)
  // saco de lixo estufado ao lado + sujeirinha
  r(x + 27, CHAO - 9, 10, 9, C.pedraEscD)
  r(x + 28, CHAO - 11, 7, 3, C.pedraEscD)
  r(x + 28, CHAO - 10, 3, 3, C.pedraEscL)
  p(x + 31, CHAO - 12, C.KS) // nó
  cont(x + 27, CHAO - 9, 10, 9, C.KS)
  p(x - 4, CHAO + 2, C.papel)
  r(x + 39, CHAO + 1, 2, 1, C.papel)
  p(x + 40, CHAO + 3, C.capaS)
}

/* Abrigo de ônibus: 124px, vidro, banco interno, painel de propaganda,
   totem — teto e totem pisáveis. */
function pontoOnibus(f) {
  const { r, p, cont, bloco } = f
  const x = 1078
  const w = 124
  const topo = 318
  sombraMuro(f, x, w - 30, topo)
  sombraChao(f, x - 3, w + 8)
  sombraLonga(f, x, w, CHAO - topo)

  for (const px of [x + 4, x + w - 10]) {
    r(px, topo + 8, 6, CHAO - topo - 8, C.azul)
    r(px, topo + 8, 2, CHAO - topo - 8, C.azulL)
    r(px + 5, topo + 9, 1, CHAO - topo - 9, C.azulS)
    cont(px, topo + 8, 6, CHAO - topo - 8)
    r(px - 2, CHAO - 4, 10, 4, C.azulS)
    cont(px - 2, CHAO - 4, 10, 4)
  }
  // parede de vidro do fundo
  r(x + 12, topo + 14, w - 26, 62, C.vidro)
  cont(x + 12, topo + 14, w - 26, 62)
  r(x + 12, topo + 14, w - 26, 1, C.vidroL)
  for (let i = 0; i < 20; i++) r(x + 16 + i, topo + 46 - i, 2, 1, C.vidroL)
  for (let i = 0; i < 12; i++) r(x + 52 + i, topo + 38 - i, 2, 1, C.vidroL)
  r(x + 48, topo + 14, 2, 62, C.vidroS) // montante
  // painel de propaganda retroiluminado
  r(x + 56, topo + 18, 34, 44, C.papel)
  cont(x + 56, topo + 18, 34, 44, C.KS)
  r(x + 59, topo + 21, 28, 20, C.grafA)
  r(x + 63, topo + 25, 10, 6, C.papel) // figura
  r(x + 75, topo + 28, 8, 8, C.amarelo)
  r(x + 59, topo + 44, 28, 3, C.KS)
  r(x + 59, topo + 50, 20, 2, C.KS)
  r(x + 59, topo + 55, 24, 2, C.KS)
  // pichação no vidro
  r(x + 18, topo + 60, 3, 3, C.pich)
  r(x + 23, topo + 57, 3, 3, C.pich)
  r(x + 21, topo + 60, 2, 1, C.pich)
  r(x + 28, topo + 61, 3, 2, C.pich)
  // banco interno de metal
  bloco(x + 18, topo + 68, 44, 4, C.metal, C.metalL, C.metalS)
  cont(x + 18, topo + 68, 44, 4)
  r(x + 21, topo + 72, 3, CHAO - topo - 72, C.metalS)
  r(x + 55, topo + 72, 3, CHAO - topo - 72, C.metalS)
  // teto
  bloco(x, topo, w, 8, C.azul, C.azulL, C.azulS)
  cont(x, topo, w, 8)
  r(x, topo + 7, w, 1, C.azulS)
  sup(x, w, topo)
  // folha e ferrugem no teto
  p(x + 30, topo - 1, C.folha)
  r(x + 84, topo + 1, 4, 1, C.ferr)
  // totem da parada
  r(x + 130, 302, 3, CHAO - 302, C.metal)
  r(x + 130, 302, 1, CHAO - 302, C.metalL)
  cont(x + 130, 302, 3, CHAO - 302)
  bloco(x + 124, 288, 16, 14, C.azul, C.azulL, C.azulS)
  cont(x + 124, 288, 16, 14)
  r(x + 127, 291, 10, 6, C.papel) // ônibus desenhado
  r(x + 128, 292, 8, 3, C.azulS)
  p(x + 128, 296, C.KS)
  p(x + 135, 296, C.KS)
  sup(x + 124, 16, 288)
}

function placaPare(f) {
  const { r, cont } = f
  const x = 1216
  const topo = 330
  sombraChao(f, x + 4, 12)
  sombraLonga(f, x + 6, 6, CHAO - topo)
  r(x + 9, topo + 22, 3, CHAO - topo - 22, C.metal)
  r(x + 9, topo + 22, 1, CHAO - topo - 22, C.metalL)
  cont(x + 9, topo + 22, 3, CHAO - topo - 22)
  r(x + 7, CHAO - 4, 8, 4, C.metalS)
  cont(x + 7, CHAO - 4, 8, 4)
  // octógono PARE em degraus
  r(x + 4, topo, 14, 22, C.vermelho)
  r(x, topo + 4, 22, 14, C.vermelho)
  r(x + 2, topo + 2, 18, 18, C.vermelho)
  r(x + 4, topo, 14, 1, C.vermelhoL)
  r(x + 2, topo + 2, 3, 2, C.vermelhoL)
  r(x + 18, topo + 18, 2, 2, C.vermelhoS)
  r(x + 4, topo + 21, 14, 1, C.vermelhoS)
  // contorno em degraus
  r(x + 4, topo - 1, 14, 1, C.K)
  r(x + 4, topo + 22, 14, 1, C.K)
  r(x - 1, topo + 4, 1, 14, C.K)
  r(x + 22, topo + 4, 1, 14, C.K)
  for (const [ox, oy] of [
    [x + 1, topo],
    [x + 18, topo],
    [x + 1, topo + 19],
    [x + 18, topo + 19],
  ]) {
    r(ox, oy + 1, 3, 1, C.K)
    r(ox + 1, oy, 2, 1, C.K)
  }
  // PARE
  for (const [tx, tw] of [
    [x + 4, 3],
    [x + 8, 3],
    [x + 12, 3],
    [x + 16, 3],
  ])
    r(tx, topo + 9, tw, 4, C.papel)
  r(x + 4, topo + 8, 15, 1, C.papel)
  sup(x + 4, 14, topo)
}

/* Semáforo: a caixa é estática; as LUZES acendem na camada animada. */
const SEM_X = 1240
const SEM_CY = 288

function semaforo(f) {
  const { r, p, cont, bloco } = f
  sombraChao(f, SEM_X - 2, 16)
  sombraLonga(f, SEM_X + 2, 6, CHAO - SEM_CY)
  r(SEM_X + 5, SEM_CY + 36, 4, CHAO - SEM_CY - 36, C.metal)
  r(SEM_X + 5, SEM_CY + 36, 1, CHAO - SEM_CY - 36, C.metalL)
  r(SEM_X + 8, SEM_CY + 37, 1, CHAO - SEM_CY - 37, C.metalS)
  cont(SEM_X + 5, SEM_CY + 36, 4, CHAO - SEM_CY - 36)
  r(SEM_X + 2, CHAO - 5, 10, 5, C.metalS)
  cont(SEM_X + 2, CHAO - 5, 10, 5)
  // caixa das luzes
  bloco(SEM_X, SEM_CY, 14, 36, C.semCx, '#4c525c', '#2e3138')
  cont(SEM_X, SEM_CY, 14, 36)
  sup(SEM_X, 14, SEM_CY)
  // viseiras
  for (const vy of [SEM_CY + 2, SEM_CY + 13, SEM_CY + 24]) {
    r(SEM_X + 2, vy, 10, 1, '#22252b')
    r(SEM_X + 1, vy + 1, 1, 2, '#22252b')
  }
  // luzes apagadas (as acesas piscam na camada animada)
  r(SEM_X + 3, SEM_CY + 4, 8, 7, C.semVermD)
  r(SEM_X + 3, SEM_CY + 15, 8, 7, C.semAmarD)
  r(SEM_X + 3, SEM_CY + 26, 8, 7, C.semVerdeD)
  // botoeira e adesivo
  r(SEM_X + 4, SEM_CY + 70, 6, 8, C.amarelo)
  r(SEM_X + 4, SEM_CY + 77, 6, 1, C.amareloS)
  p(SEM_X + 6, SEM_CY + 73, C.KS)
  cont(SEM_X + 4, SEM_CY + 70, 6, 8, C.KS)
  r(SEM_X + 5, SEM_CY + 92, 5, 4, C.papel)
  p(SEM_X + 6, SEM_CY + 93, C.grafA)
  p(SEM_X + 6, SEM_CY + 56, C.ferr)
}

/* O capeamento do muro só é poleiro onde ele APARECE. */
function supMuro() {
  for (let x = 0; x < LARG; x++) if (tetoObj[x] > MURO_Y + 3) sup(x, 1, MURO_Y)
}

function detalhes(f) {
  const { r, p } = f
  const rr = rnd(101)
  for (let i = 0; i < 48; i++) {
    const x = Math.floor(rr() * LARG)
    const y = CHAO - 8 + Math.floor(rr() * 30)
    const t = rr()
    if (t < 0.5) r(x, y, 2, 1, C.folha)
    else if (t < 0.8) p(x, y, C.troncoS)
    else r(x, y, 2, 1, C.papel)
  }
  // poça grande refletindo o céu, com nuvem dentro
  r(346, CHAO + 14, 38, 5, C.ceuC)
  r(352, CHAO + 13, 24, 1, C.ceuC)
  r(353, CHAO + 19, 22, 2, C.ceuC)
  r(358, CHAO + 15, 10, 1, C.nuvem)
  r(349, CHAO + 16, 4, 1, C.ceuB)
  r(372, CHAO + 18, 7, 1, C.ceuB)
  r(350, CHAO + 21, 26, 1, C.pedraEscD)
  r(345, CHAO + 14, 1, 5, C.pedraS)
  // poça do AC da padaria (o pingo animado cai aqui)
  r(1008, 378, 26, 4, C.ceuC)
  r(1012, 377, 16, 1, C.ceuC)
  r(1013, 382, 14, 1, C.ceuB)
  r(1010, 383, 20, 1, C.pedraEscD)
  // tampas de poço de visita
  for (const [tx, ty] of [
    [604, CHAO + 12],
    [1150, CHAO + 18],
  ]) {
    r(tx + 4, ty, 12, 1, C.metalL)
    r(tx, ty + 1, 20, 3, C.metal)
    r(tx + 4, ty + 4, 12, 1, C.metalS)
    r(tx + 1, ty + 4, 3, 1, C.KS)
    r(tx + 16, ty + 4, 3, 1, C.KS)
    for (let i = 0; i < 5; i++) p(tx + 4 + i * 3, ty + 2, C.metalS)
    p(tx + 7, ty + 3, C.metalS)
    p(tx + 12, ty + 3, C.metalS)
  }
  // chicletes e manchas
  const rg = rnd(203)
  for (let i = 0; i < 30; i++) {
    const gx = Math.floor(rg() * LARG)
    const gy = CALCADA_Y + 6 + Math.floor(rg() * 52)
    r(gx, gy, rg() < 0.4 ? 2 : 1, 1, rg() < 0.5 ? C.capaS : C.guiaF)
  }
  // bueiros na rua
  for (const bx of [480, 1020]) {
    r(bx, RUA_Y + 16, 30, 8, C.asfaltoS)
    r(bx, RUA_Y + 16, 30, 1, C.asfaltoL)
    for (let i = 0; i < 6; i++) r(bx + 4 + i * 4, RUA_Y + 19, 2, 3, C.asfalto)
  }
  // cone de trânsito esquecido perto da faixa
  {
    const cx2 = 1160
    r(cx2 + 3, CHAO - 14, 4, 3, C.laranja)
    r(cx2 + 2, CHAO - 11, 6, 3, C.laranja)
    r(cx2 + 2, CHAO - 8, 6, 2, C.papel)
    r(cx2 + 1, CHAO - 6, 8, 3, C.laranja)
    r(cx2 - 1, CHAO - 3, 12, 3, C.laranjaS)
    r(cx2 + 3, CHAO - 14, 1, 11, C.laranjaL)
    r(cx2 + 6, CHAO - 13, 1, 10, C.laranjaS)
    f.a(0.14)
    r(cx2 + 10, CHAO - 1, 8, 2, '#2b2a2e')
    f.a(1)
  }
  // sarjeta: folha, pétala, guimba
  for (const [sx, cor] of [
    [220, C.folha],
    [402, C.troncoS],
    [548, C.folha],
    [788, C.ipe],
    [809, C.flor],
    [836, C.ipeL],
    [1116, C.folha],
    [1198, C.troncoS],
  ]) {
    p(sx, RUA_Y + 2, cor)
    if (sx % 2) p(sx + 1, RUA_Y + 3, cor)
  }
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
  sobradoPadaria(f)
  calcada(f)

  banca(f)
  engradados(f)
  orelhao(f)
  posteLuz(f)
  banco(f, 340)
  coreto(f)
  carrocinha(f)
  jacaranda(f)
  hidrante(f)
  banco(f, 896)
  lixeira(f)
  pontoOnibus(f)
  placaPare(f)
  semaforo(f)
  detalhes(f)

  supMuro()
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

/* ── camada animada ──────────────────────────────────────────────────────
   desenharAnimados(ctx, t, escala): chamar TODO frame por cima do fundo
   estático (t em ms). Desenha no mesmo idioma pixel — coordenadas de mundo
   inteiras multiplicadas por `escala`, sem suavização. Anima:
     · letreiro PADARIA piscando (o D falha de vez em quando)
     · semáforo em ciclo verde → amarelo → vermelho
     · roupa no varal do sobrado balançando (3 quadros)
     · fumaça da chaminé da carrocinha subindo em espiral
     · bandeirinhas juninas tremulando em dois vãos do coreto
     · pétalas do jacarandá caindo
     · pingo do ar-condicionado na poça (com respingo)
     · bando de pombas cruzando o céu de tempos em tempos            */

export function desenharAnimados(ctx, t, escala = 1) {
  const R = (x, y, w, h, cor) => {
    ctx.fillStyle = cor
    ctx.fillRect(Math.round(x) * escala, Math.round(y) * escala, Math.round(w) * escala, Math.round(h) * escala)
  }
  const P = (x, y, cor) => R(x, y, 1, 1, cor)

  // ── letreiro PADARIA aceso, piscando
  letreiroPadaria({ r: R, p: P }, t, C.neonOn, C.neonOff)
  // halo dos vidros quando aceso: um degrau de luz sob o letreiro
  if (Math.floor(t / 260) % 7 !== 3) R(SOB_X + 26, 323, 118, 1, C.neonBri)

  // ── semáforo em ciclo (3.6s verde, 0.9s amarelo, 3.9s vermelho)
  {
    const fase = t % 8400
    const cor = fase < 3600 ? 0 : fase < 4500 ? 1 : 2
    if (cor === 0) {
      R(SEM_X + 3, SEM_CY + 26, 8, 7, C.semVerde)
      R(SEM_X + 5, SEM_CY + 27, 3, 2, '#a8d9ae')
    } else if (cor === 1) {
      R(SEM_X + 3, SEM_CY + 15, 8, 7, C.semAmar)
      R(SEM_X + 5, SEM_CY + 16, 3, 2, '#f4e5a4')
    } else {
      R(SEM_X + 3, SEM_CY + 4, 8, 7, C.semVerm)
      R(SEM_X + 5, SEM_CY + 5, 3, 2, '#eda99e')
    }
  }

  // ── roupa no varal do sobrado (3 quadros de balanço)
  {
    const q = [0, 1, 0, -1][Math.floor(t / 450) % 4]
    const vx = SOB_X + 10
    const yFio = (i) => Math.round(222 + 4 * Math.sin((Math.PI * i) / 46))
    // camisa azul
    R(vx + 6 + 0, yFio(6) + 1, 10, 6, C.roupaAzul)
    R(vx + 6 + q, yFio(6) + 7, 10, 6, C.roupaAzul)
    R(vx + 6 + q, yFio(6) + 11, 10, 2, C.roupaAzulS)
    R(vx + 4 + 0, yFio(6) + 2, 3, 5, C.roupaAzul) // manga
    R(vx + 15 + q, yFio(6) + 2, 3, 5, C.roupaAzulS)
    P(vx + 8, yFio(6), C.madeira)
    P(vx + 13, yFio(6), C.madeira)
    // calça jeans
    R(vx + 22, yFio(22) + 1, 8, 7, C.jeans)
    R(vx + 22 + q, yFio(22) + 8, 3, 9, C.jeans)
    R(vx + 27 + q, yFio(22) + 8, 3, 9, C.jeansS)
    P(vx + 23, yFio(22), C.madeira)
    P(vx + 28, yFio(22), C.madeira)
    // toalha rosa
    R(vx + 34, yFio(34) + 1, 12, 5, C.roupaRosa)
    R(vx + 34 + q, yFio(34) + 6, 12, 5, C.roupaRosa)
    R(vx + 34 + q, yFio(34) + 9, 12, 2, C.roupaRosaS)
    P(vx + 36, yFio(34), C.madeira)
    P(vx + 43, yFio(34), C.madeira)
    // meia solitária
    R(vx + 1, yFio(1) + 1, 3, 5, C.papel)
    R(vx + 1 + q, yFio(1) + 5, 3, 2, C.capaS)
  }

  // ── fumaça da carrocinha: novelos subindo em espiral, crescendo e
  //    clareando até dissipar
  {
    const bx = 748 // boca da chaminé
    const by = 328
    for (let k = 0; k < 9; k++) {
      const idade = (t / 220 + k * 2.9) % 26
      if (idade > 23) continue
      const y = by - Math.round(idade * 2.4)
      const x = bx + Math.round(4 * Math.sin(idade * 0.5 + k * 2.1)) + Math.round(idade * 0.2)
      const s = idade < 4 ? 2 : idade < 11 ? 3 : idade < 18 ? 4 : 5
      const cor = idade < 9 ? C.fum : C.fumS
      // novelo: bloco principal + barriga larga + coroa acesa em cima
      R(x, y, s, s - 1, cor)
      R(x - 1, y + 1, s + 2, 2, cor)
      R(x, y - 1, s - 1, 1, idade < 12 ? '#e4e8e9' : C.fum)
      P(x - 1, y, idade < 12 ? '#e4e8e9' : C.fum)
      P(x + s, y + s, C.fumS)
      P(x - 2, y + 2, cor)
    }
  }

  // ── bandeirinhas juninas em dois vãos, tremulando
  {
    const vaos = [
      [330, 226, 562, 213, 9],
      [598, 213, 702, 194, 7],
    ]
    for (const [x0, y0, x1, y1, barriga] of vaos) {
      const yv = (x) => {
        const tt = (x - x0) / (x1 - x0)
        return Math.round(y0 + (y1 - y0) * tt + barriga * Math.sin(Math.PI * tt))
      }
      for (let x = x0; x <= x1; x++) P(x, yv(x), C.fioL)
      const cores = [C.vermelho, C.amarelo, C.azulL, C.verdeL, C.flor, C.laranja]
      let i = 0
      for (let x = x0 + 7; x < x1 - 6; x += 14, i++) {
        const y = yv(x)
        const q = Math.floor(t / 300 + i) % 3
        const cor = cores[i % cores.length]
        R(x - 3, y + 1, 7, 3, cor)
        R(x - 2, y + 4, 5, 2, cor)
        if (q === 0) R(x - 1, y + 6, 3, 2, cor)
        else if (q === 1) R(x - 1 + 1, y + 6, 3, 1, cor)
        else R(x - 1 - 1, y + 6, 3, 1, cor)
      }
    }
  }

  // ── pétalas do jacarandá caindo
  for (let i = 0; i < 6; i++) {
    const per = 5200 + i * 340
    const ph = ((t + i * 870) % per) / per
    const x = 752 + i * 21 + Math.round(6 * Math.sin(ph * 7 + i * 2))
    const y = 208 + Math.round(ph * (CHAO + 4 - 208))
    if (y < 236 && i % 2) continue // nasce dentro da copa: só aparece saindo
    P(x, y, ph % 0.3 < 0.15 ? C.flor : C.ipeL)
    if (i % 3 === 0) P(x + 1, y, C.ipeL)
  }

  // ── pingo do ar-condicionado do sobrado
  {
    const acX = SOB_X + 126 + 15
    const fase = t % 1700
    if (fase < 380) {
      P(acX, 266, C.vidroL) // gota crescendo no dreno
      if (fase > 200) P(acX, 267, C.vidroT)
    } else if (fase < 1400) {
      const y = 267 + Math.round(((fase - 380) / 1020) * (378 - 267))
      P(acX, y, C.vidroT)
      P(acX, y - 2, C.vidroL)
    } else {
      P(acX - 2, 377, C.vidroT) // respingo na poça
      P(acX + 2, 377, C.vidroT)
      if (fase < 1550) P(acX, 376, C.vidroL)
    }
  }

  // ── bando de pombas cruzando o céu (a cada ~17s)
  {
    const ciclo = Math.floor(t / 17000)
    const fase = (t % 17000) / 6000
    if (fase < 1) {
      const dir = ciclo % 2 === 0 ? 1 : -1
      const yBase = dir > 0 ? 84 : 122
      const x0 = dir > 0 ? -24 + fase * (LARG + 48) : LARG + 24 - fase * (LARG + 48)
      const bat = Math.floor(t / 180) % 2
      for (const [dx, dy] of [
        [0, 0],
        [11, -4],
        [20, 2],
      ]) {
        const px = Math.round(x0 + dx * dir)
        const py = yBase + dy + (bat ? 0 : -1)
        if (bat) {
          P(px, py, C.pombaCeu)
          P(px + 1, py - 1, C.pombaCeu)
          P(px + 2, py, C.pombaCeu)
        } else {
          R(px, py, 3, 1, C.pombaCeu)
        }
      }
    }
  }
}
