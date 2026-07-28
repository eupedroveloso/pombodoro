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
  { l: '#8e8e9a', m: '#565664', d: '#2e2e3a' }, // carvão
  { l: '#f0d9b8', m: '#d8a55c', d: '#9c6b2e' }, // caramelo
  { l: '#d8e4f0', m: '#8fb4d8', d: '#4f7ba6' }, // azul-céu
  { l: '#f0c9c9', m: '#d88f8f', d: '#a65454' }, // rosé
]

export const CRISTAS = [
  '#e0405a', '#f5a623', '#5ab0e0', '#7ed957', '#b06be0',
  '#ff8fc7', '#2ec4b6', '#ffe066', '#f97316', '#22d3ee',
]

/* Acessórios: desenhados POR CIMA do sprite, ancorados na cabeça.
   Cada pose desloca a cabeça um pouco — a tabela CABECA compensa. */
export const ACESSORIOS = [
  { nome: 'nada', mapa: null, cores: {} },
  {
    nome: 'boné',
    cores: { c: '#d63031', s: '#9c1f20', k: '#26201c' },
    mapa: [
      '........................',
      '.....kccccck............',
      '....kcccccccck..........',
      '..kkccss................',
    ],
  },
  {
    nome: 'cartola',
    cores: { c: '#23232e', f: '#d63031', k: '#101018' },
    mapa: [
      '.....kcccck.............',
      '.....kcccck.............',
      '.....kffffk.............',
      '....kcccccck............',
    ],
  },
  {
    nome: 'óculos',
    cores: { c: '#1c1c24', v: '#3d4a6b', w: '#8fa8d8' },
    mapa: [
      '........................',
      '........................',
      '........................',
      '........................',
      '...ccccccccc............',
      '....cvwvc.vc............',
      '....cvvvc.cc............',
    ],
  },
  {
    nome: 'laço',
    cores: { c: '#e0405a', s: '#9c1f30' },
    mapa: [
      '......c.c...............',
      '.....ccscc..............',
      '......c.c...............',
    ],
  },
  {
    nome: 'coroa',
    cores: { c: '#f5c518', s: '#c28f0e', j: '#e0405a' },
    mapa: [
      '.....c.j.c..............',
      '.....ccccc..............',
      '.....sssss..............',
    ],
  },
]

/** Deslocamento (dx,dy) da cabeça por pose, pra ancorar o acessório. */
export const CABECA = {
  parado: [0, 0],
  passo: [0, 1],
  sentado: [0, 0],
  sentado2: [0, 0],
  soco: [0, 0],
  tonto: [0, 0],
  dormindo: [0, 2],
  caido: [-2, 1],
  vooCima: [0, 0],
  vooBaixo: [0, 0],
  bicando: [-1, 4],
  bicando2: [-3, 7],
}

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
    '...KLLPAAKAAAADDDDK.....',
    '...KLLPAAAAKAAADDK......',
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
    '...KLLPAAKAAAADDDDK.....',
    '...KLLPAAAAKAAADDK......',
    '...KLLLPAAAAAADDK.......',
    '.....KKLLPPAADDKK.......',
    '......O.KKKKK.O.........',
    '.....OO........OO.......',
  ],

  // Bicando, quadro 1: cabeça baixa, rabo levantado (a "arma engatilhada").
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

  // Bicando, quadro 2: o GOLPE — bico cravado no chão, rabo empinado.
  // Alterna com o quadro 1 pra bicada parecer bicada, não agachamento.
  bicando2: [
    '................KKK.....',
    '...............KDDK.....',
    '..............KDDDK.....',
    '............KKDDDDK.....',
    '..........KKDDDDDDK.....',
    '.........KDDDDDDDDK.....',
    '........KDDDDDDDDK......',
    '......KKDDDAAADDDK......',
    '.....KDDDDAAAAADDK......',
    '....KDDDDDAAAAADK.......',
    '...KDDWWDDLAAADK........',
    '...KDWEWDDLLLDK.........',
    '...KDWWWDLLLKK..........',
    '..BKDDDDDKKK.O..........',
    '.BB.KKKKK...OO..........',
    '.BB.....O...............',
  ],

  // Derrubado pelo soco: de costas no chão, patas pro alto, olho em X.
  caido: [
    '........................',
    '..........O...O.........',
    '..........O...O.........',
    '.....KKKKKKKKKKKKK......',
    '....KLLLPPPAAAADDDKK....',
    '...KDEWEDDPPAAAADDDDK...',
    '..BBKWEWDDDDDDDDDDKK....',
    '...KKDWWDDDDDDDDDK......',
    '.....KKKKKKKKKKKK.......',
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

  // Notebook de pombo: tela à esquerda, teclado se estendendo pro pombo.
  // Dois quadros — o "código" na tela muda enquanto ele digita.
  notebook: [
    'KKKKKKK......',
    'KMTTMMK......',
    'KMMMTTK......',
    'KMTMMMK......',
    'KMMMMMK......',
    'KKKKKKKKKKKK.',
    '.KFFFFFFFFFK.',
    '.KKKKKKKKKKK.',
  ],
  notebook2: [
    'KKKKKKK......',
    'KMTTMMK......',
    'KMTTMTK......',
    'KMMMTMK......',
    'KMTMMMK......',
    'KKKKKKKKKKKK.',
    '.KFFFFFFFFFK.',
    '.KKKKKKKKKKK.',
  ],

  // Quadro 2 do foco: a asa desce pro teclado. Alterna com "sentado"
  // pra digitação infinita.
  sentado2: [
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
    '...KLLPPDDAAADDDDDDK....',
    '...KLAAAAAAAAADDDDK.....',
    '..KAAAAAAAAAAAADDK......',
    '..KAAKLLPAAAAAADDK......',
    '....KLLLLPPAADDK........',
    '.....KKKKKKKKKK.........',
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

export function spriteCanvas(nome, iCorpo = 0, iCrista = 0, iAcess = 0) {
  const chave = `${nome}|${iCorpo}|${iCrista}|${iAcess}`
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

  // Acessório por cima, ancorado na cabeça da pose.
  const acess = ACESSORIOS[iAcess % ACESSORIOS.length]
  if (acess?.mapa) {
    const [dx, dy] = CABECA[nome] || [0, 0]
    for (let y = 0; y < acess.mapa.length; y++) {
      const linha = acess.mapa[y]
      for (let x = 0; x < linha.length; x++) {
        const cor = acess.cores[linha[x]]
        if (!cor) continue
        const px = x + dx
        const py = y + dy
        if (px >= 0 && py >= 0 && px < larg && py < alt) {
          ctx.fillStyle = cor
          ctx.fillRect(px, py, 1, 1)
        }
      }
    }
  }

  cache.set(chave, cv)
  return cv
}
