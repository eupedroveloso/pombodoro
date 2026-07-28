/* Pixel art como mapa de caracteres. Cada char é um pixel.
   Sprites olham para a ESQUERDA; o renderer espelha quando precisa.

   .  transparente          K  contorno
   D  plumagem escura (cabeça/asa)   P  plumagem média   L  peito claro
   C  penacho (cor do jogador)       W  branco do olho   E  pupila
   B  bico                O  patas         H  fone de ouvido
   M  tela   F  moldura   T  "código" na tela                              */

export const PALETA = {
  K: '#26201c',
  W: '#f6f4ee',
  E: '#1c1710',
  B: '#e8920e',
  O: '#e8920e',
  H: '#23232e', // escuro de verdade, senão some contra a cabeça
  M: '#232338',
  F: '#2b2b3a',
  T: '#4d5f85',
}

/* Cada plumagem tem três tons: peito (l), corpo (m), cabeça/asa (d). */
export const CORPOS = [
  { l: '#c9c9d2', m: '#9a9aa8', d: '#5f5f70' }, // pombo urbano
  { l: '#d6bfa3', m: '#9c8065', d: '#664e38' }, // rolinha marrom
  { l: '#f2efe7', m: '#d5d0c2', d: '#a09a89' }, // branco
  { l: '#adb8ca', m: '#75839c', d: '#485266' }, // ardósia
  { l: '#cfc0dd', m: '#9d88b5', d: '#66557d' }, // lilás
  { l: '#b9cfc0', m: '#84a68f', d: '#52705c' }, // verde-chá
]

export const CRISTAS = ['#e0405a', '#f5a623', '#5ab0e0', '#7ed957', '#b06be0', '#ff8fc7']

export const CENARIO = {
  ceu: '#d8d0c3',
  chao: '#b3a794',
  chaoLuz: '#c2b6a4',
}

export const SPRITES = {
  // Em pé, patas juntas. É o sprite de referência dos demais.
  parado: [
    '........................',
    '.......C.C..............',
    '......KCCCK.............',
    '.....KDDDDDK............',
    '....KDDWWWDDK...........',
    '..BBKDWWEWDDK...........',
    '..BBKDDWWWDDK...........',
    '....KDDDDDDDK...........',
    '....KDDDDDDDDKK....KKK..',
    '....KLPPDDDDDDDKK.KDDK..',
    '...KLLPPPDDDDDDDDKDDK...',
    '...KLLPPAAAAADDDDDDK....',
    '...KLLPAAAAAAADDDDK.....',
    '...KLLPAAAAAAAADDK......',
    '...KLLLPAAAAAADDK.......',
    '....KLLLPPAADDDK........',
    '.....KKLLLPPKKK.........',
    '.......KKKKK............',
    '........O..O............',
    '.......OO..OO...........',
  ],

  // Passo: patas abertas, corpo 1px mais baixo (gingado).
  passo: [
    '........................',
    '........................',
    '.......C.C..............',
    '......KCCCK.............',
    '.....KDDDDDK............',
    '....KDDWWWDDK...........',
    '..BBKDWWEWDDK...........',
    '..BBKDDWWWDDK...........',
    '....KDDDDDDDK...........',
    '....KDDDDDDDDKK....KKK..',
    '....KLPPDDDDDDDKK.KDDK..',
    '...KLLPPPDDDDDDDDKDDK...',
    '...KLLPPAAAAADDDDDDK....',
    '...KLLPAAAAAAADDDDK.....',
    '...KLLPAAAAAAAADDK......',
    '...KLLLPAAAAAADDK.......',
    '.....KKLLPPAADDKK.......',
    '......O.KKKKK.O.........',
    '.....OO........OO.......',
    '........................',
  ],

  // Bicando o chão: cabeça baixa, rabo levantado.
  bicando: [
    '........................',
    '..................KKK...',
    '.................KDDK...',
    '................KDDDK...',
    '.....KKKKK....KKDDDDK...',
    '....KDDDDDKKKKDDDDDK....',
    '...KDDWWWDDDDDDDDDDK....',
    '.BBKDWWEWDDDDDDDDDK.....',
    '.BBKDDWWWDAAAAADDDK.....',
    '...KDDDDDPAAAAAADDK.....',
    '...KKLLLPLAAAAAADK......',
    '....KLLLLLLAAAADDK......',
    '.....KLLLLLLPPDDK.......',
    '......KKKKKKKKKK........',
    '........O...O...........',
    '.......OO..OO...........',
  ],

  // Offline: cabeça encolhida nos ombros, olho fechado, empufado.
  dormindo: [
    '........................',
    '........................',
    '.......C.C..............',
    '......KCCCK.............',
    '.....KDDDDDK............',
    '....KDDDDDDDK...........',
    '..BBKDDKKDDDK...........',
    '..BBKDDDDDDDKK.....KKK..',
    '....KDDDDDDDDDKK..KDDK..',
    '...KLLPPDDDDDDDDKKDDK...',
    '...KLLPPPAAAADDDDDDK....',
    '..KLLLPAAAAAAADDDDK.....',
    '..KLLLPAAAAAAAADDK......',
    '..KLLLLPAAAAAADDK.......',
    '...KLLLLPPAADDDK........',
    '....KKLLLLPPKKK.........',
    '......KKKKKK............',
    '........................',
  ],

  // No monitor, de fone: o modo foco. Sem patas — está empoleirado.
  // O arco HH sobre a cabeça é o que faz o fone ler como fone.
  sentado: [
    '........................',
    '.......C.C..............',
    '......KCCCK.............',
    '.....KHHHHHK............',
    '....KDDWWWDHHK..........',
    '..BBKDWWEWDDHHK.........',
    '..BBKDDWWWDDHHK.........',
    '....KDDDDDDDHHK.........',
    '....KDDDDDDDDKK....KKK..',
    '....KLPPDDDDDDDKK.KDDK..',
    '...KLLPPPDDDDDDDDKDDK...',
    '...KLLPPAAAAADDDDDDK....',
    '...KLLPAAAAAAADDDDK.....',
    '...KLLPAAAAAAAADDK......',
    '...KLLLPAAAAAADDK.......',
    '....KLLLLPPAADDK........',
    '.....KKKKKKKKKK.........',
  ],

  // Soco: asa esticada pra frente. Curto e grosso, como pombo brigaria.
  soco: [
    '........................',
    '.......C.C..............',
    '......KCCCK.............',
    '.....KDDDDDK............',
    '....KDDWWWDDK...........',
    '..BBKDWWEWDDK...........',
    '..BBKDDWWWDDK...........',
    '....KDDDDDDDK...........',
    '....KDDDDDDDDKK....KKK..',
    '.KKKKLPPDDDDDDDKK.KDDK..',
    'KAAAAKLPPDDDDDDDDKDDK...',
    'KAAAAAKPPAAAADDDDDDK....',
    '.KKKKLPAAAAAAADDDDK.....',
    '...KLLPAAAAAAAADDK......',
    '...KLLLPAAAAAADDK.......',
    '....KLLLPPAADDDK........',
    '.....KKLLLPPKKK.........',
    '.......KKKKK............',
    '........O..O............',
    '.......OO..OO...........',
  ],

  // Levou soco: olho em X, penas arrepiadas. O 💫 vem por cima via emote.
  tonto: [
    '........................',
    '......C.K.C.............',
    '......KCKCK.............',
    '.....KDDDDDK............',
    '....KDDEWEDDK...........',
    '..BBKDWWEWDDK...........',
    '..BBKDDEWEDDK...........',
    '....KDDDDDDDK...........',
    '....KDDDDDDDDKK....KKK..',
    '....KLPPDDDDDDDKK.KDDK..',
    '...KLLPPPDDDDDDDDKDDK...',
    '...KLLPPAAAAADDDDDDK....',
    '...KLLPAAAAAAADDDDK.....',
    '...KLLPAAAAAAAADDK......',
    '...KLLLPAAAAAADDK.......',
    '....KLLLPPAADDDK........',
    '.....KKLLLPPKKK.........',
    '.......KKKKK............',
    '........O..O............',
    '.......OO..OO...........',
  ],

  // Voo, asa pra cima. Alterna com vooBaixo enquanto está no ar.
  vooCima: [
    '..............KKKK......',
    '.......C.C...KAAAAK.....',
    '......KCCCK.KAAAAK......',
    '.....KDDDDDKKAAAK.......',
    '....KDDWWWDDKAAK........',
    '..BBKDWWEWDDAAK.........',
    '..BBKDDWWWDDAK..........',
    '....KDDDDDDDDK.....KKK..',
    '....KLPPDDDDDDDKK.KDDK..',
    '...KLLPPPDDDDDDDDKDDK...',
    '...KLLPPDDDDDDDDDDDK....',
    '...KLLPDDDDDDDDDDK......',
    '...KLLLPDDDDDDDDK.......',
    '....KLLLPPDDDDK.........',
    '.....KKLLLPPKKK.........',
    '.......KKKKK............',
    '........O.O.............',
    '........................',
  ],

  // Voo, asa pra baixo.
  vooBaixo: [
    '........................',
    '.......C.C..............',
    '......KCCCK.............',
    '.....KDDDDDK............',
    '....KDDWWWDDK...........',
    '..BBKDWWEWDDK...........',
    '..BBKDDWWWDDK...........',
    '....KDDDDDDDK...........',
    '....KDDDDDDDDKK....KKK..',
    '....KLPPDDDDDDDKK.KDDK..',
    '...KLLPPPDDDDDDDDKDDK...',
    '...KLAAAAADDDDDDDDDK....',
    '..KAAAAAAAADDDDDDDK.....',
    '..KAAAAAAAAADDDDDK......',
    '...KKAAAAAKLPPDDK.......',
    '.....KKKKK.KKKKK........',
    '........O.O.............',
    '........................',
  ],

  monitor: [
    'KKKKKKKKKKKKKKK.',
    'KFFFFFFFFFFFFFK.',
    'KFMTTMMMMMMMMFK.',
    'KFMMMMTTTMMMMFK.',
    'KFMTTTMMMMMMMFK.',
    'KFMMMMMTTMMMMFK.',
    'KFMTTMMMMMMMMFK.',
    'KFMMMMMMMMMMMFK.',
    'KFFFFFFFFFFFFFK.',
    'KKKKKKKKKKKKKKK.',
    '......KKK.......',
    '......KKK.......',
    '....KKKKKKK.....',
  ],
}

/** Média de dois hex — dá o 4º tom (asa) sem tabelar mais cores. */
export function misturar(a, b) {
  const c = (h, i) => parseInt(h.slice(i, i + 2), 16)
  const m = (i) => Math.round((c(a, i) + c(b, i)) / 2)
  return `#${[1, 3, 5].map((i) => m(i).toString(16).padStart(2, '0')).join('')}`
}

/* Cada sprite vira um canvas uma vez só. Depois é só drawImage —
   desenhar centenas de fillRects por pombo a 60fps derreteria o notebook. */
const cache = new Map()

export function spriteCanvas(nome, iCorpo = 0, iCrista = 0) {
  const chave = `${nome}|${iCorpo}|${iCrista}`
  if (cache.has(chave)) return cache.get(chave)

  const mapa = SPRITES[nome]
  const corpo = CORPOS[iCorpo % CORPOS.length]
  const cores = {
    ...PALETA,
    L: corpo.l,
    P: corpo.m,
    D: corpo.d,
    A: misturar(corpo.m, corpo.d), // asa: meio-termo, destaca sem contorno
    C: CRISTAS[iCrista % CRISTAS.length],
  }

  const alt = mapa.length
  const larg = Math.max(...mapa.map((l) => l.length))
  const cv = document.createElement('canvas')
  cv.width = larg
  cv.height = alt
  const ctx = cv.getContext('2d')

  for (let y = 0; y < alt; y++) {
    const linha = mapa[y]
    for (let x = 0; x < linha.length; x++) {
      const cor = cores[linha[x]]
      if (!cor) continue
      ctx.fillStyle = cor
      ctx.fillRect(x, y, 1, 1)
    }
  }

  cache.set(chave, cv)
  return cv
}
