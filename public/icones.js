/* Ícones pixel art da interface — mesmo esquema do sprites.js:
   mapas de caracteres (1 char = 1 pixel), paleta fechada por ícone,
   cores chapadas, contorno #26201c, luz de cima-esquerda.
   Este arquivo NÃO mexe no sprites.js — é a caixa de ícones da UI.

   Grades: 12×12 (controles e miúdos), 14×14 (objetos e emotes),
   16×16 (o pombo do título). Exibir sempre em múltiplo inteiro. */

const K = '#26201c'

export const ICONES = {
  /* ─── o pombo (título, favicon, modal de ciclo) ─────────── */
  pombo: {
    cores: {
      K, D: '#5f5f70', L: '#c9c9d2', W: '#f6f4ee', E: '#1c1710',
      B: '#e8920e', b: '#b56f08', V: '#3f7d6e',
    },
    mapa: [
      '................',
      '......KKKKK.....',
      '.....KDDDDDK....',
      '....KDDWWWDDK...',
      '..BBKDWWEWDDK...',
      '..bBKDDWWWDDK...',
      '....KDDDDDDDK...',
      '....KDDDDDDDDK..',
      '...KDVVVDDDDDK..',
      '...KLVVVVDDDDK..',
      '..KLLVVVVDDDDK..',
      '..KLLLVVDDDDK...',
      '..KLLLLLDDDK....',
      '...KLLLLDDK.....',
      '....KKKKKK......',
      '................',
    ],
  },

  /* ─── construção (criar praça) ──────────────────────────── */
  martelo: {
    cores: { K, A: '#cdd6e0', B: '#8fa0b5', C: '#5a6a80', W: '#c98b4a', w: '#8a5526' },
    mapa: [
      '..............',
      '..KKKKKKK.....',
      '.KAAAAAABK....',
      '.KABBBBBBK....',
      '.KCBBBBBCK....',
      '..KKKWwKKK....',
      '.....KWwK.....',
      '.....KWwK.....',
      '......KWwK....',
      '......KWwK....',
      '.......KWwK...',
      '.......KWwK...',
      '........KK....',
      '..............',
    ],
  },

  /* ─── corrente (convite): dois elos entrelaçados ────────── */
  link: {
    cores: { K, L: '#cdd6e0', A: '#8fa0b5' },
    mapa: [
      '.KKKK.......',
      'KLLLLK......',
      'KL..LK......',
      'KL..LK......',
      'KAAAAKKKK...',
      '.KKKKLLLLK..',
      '....KL..LK..',
      '....KL..LK..',
      '....KAAAAK..',
      '.....KKKK...',
      '............',
      '............',
    ],
  },

  /* ─── dado (nova praça / sorteio) ───────────────────────── */
  dado: {
    cores: { K, W: '#f6f4ee', M: '#c9c4b4', E: '#26201c' },
    mapa: [
      '............',
      '.KKKKKKKKKK.',
      '.KWWWWWWWMK.',
      '.KWEEWWEEMK.',
      '.KWEEWWEEMK.',
      '.KWWWEEWWMK.',
      '.KWWWEEWWMK.',
      '.KWEEWWEEMK.',
      '.KWEEWWEEMK.',
      '.KMMMMMMMMK.',
      '.KKKKKKKKKK.',
      '............',
    ],
  },

  /* ─── porta (sair) ──────────────────────────────────────── */
  porta: {
    cores: { K, A: '#c98b4a', B: '#a86a3a', c: '#7d4c28', C: '#5c3419', Y: '#f5c518' },
    mapa: [
      '..............',
      '..KKKKKKKKK...',
      '..KAABBBBCK...',
      '..KABccccCK...',
      '..KABccccCK...',
      '..KABccccCK...',
      '..KAABBBBCK...',
      '..KAABBBYCK...',
      '..KABccccCK...',
      '..KABccccCK...',
      '..KABccccCK...',
      '..KAABBBBCK...',
      '..KKKKKKKKK...',
      '..............',
    ],
  },

  /* ─── transporte do player (mesma caixa 12×12) ──────────── */
  play: {
    cores: { K, L: '#f6f4ee', M: '#d5d0c2', S: '#a09a89' },
    mapa: [
      '............',
      '..KK........',
      '..KLLK......',
      '..KLLMMK....',
      '..KLLMMMMK..',
      '..KLLMMMMMMK',
      '..KLMMMMMMSK',
      '..KLMMMSSK..',
      '..KMSSSK....',
      '..KSSK......',
      '..KK........',
      '............',
    ],
  },

  pausa: {
    cores: { K, L: '#f6f4ee', M: '#d5d0c2', S: '#a09a89' },
    mapa: [
      '............',
      '.KKKK..KKKK.',
      '.KLMK..KLMK.',
      '.KLMK..KLMK.',
      '.KLMK..KLMK.',
      '.KLMK..KLMK.',
      '.KLMK..KLMK.',
      '.KLMK..KLMK.',
      '.KLMK..KLMK.',
      '.KSSK..KSSK.',
      '.KKKK..KKKK.',
      '............',
    ],
  },

  prox: {
    cores: { K, L: '#f6f4ee', M: '#d5d0c2', S: '#a09a89' },
    mapa: [
      '.........LS.',
      '.KK......LS.',
      '.KLLK....LS.',
      '.KLLMMK..LS.',
      '.KLLMMMK.LS.',
      '.KLLMMMK.LS.',
      '.KLMMMSK.LS.',
      '.KLMSSK..LS.',
      '.KSSK....LS.',
      '.KK......LS.',
      '.........LS.',
      '............',
    ],
  },

  som: {
    cores: { K, L: '#f6f4ee', M: '#d5d0c2', S: '#a09a89', C: '#f6f4ee' },
    mapa: [
      '............',
      '.....KKK....',
      '....KLLK....',
      '.KKKKLMK.C..',
      '.KLLLLMK..C.',
      '.KLMMMMK.C.C',
      '.KLMMMMK.C.C',
      '.KSMMMMK..C.',
      '.KKKKSMK.C..',
      '....KSMK....',
      '.....KKK....',
      '............',
    ],
  },

  mudo: {
    cores: { K, L: '#f6f4ee', M: '#d5d0c2', S: '#a09a89', R: '#e0405a', r: '#9c1f30' },
    mapa: [
      '............',
      '.....KKK....',
      '....KLLK....',
      '.KKKKLMK....',
      '.KLLLLMKR..R',
      '.KLMMMMK.RR.',
      '.KLMMMMK.rr.',
      '.KSMMMMKr..r',
      '.KKKKSMK....',
      '....KSMK....',
      '.....KKK....',
      '............',
    ],
  },

  /* ─── mural (prancheta) ─────────────────────────────────── */
  mural: {
    cores: { K, M: '#b8c0cc', A: '#c98b4a', B: '#7d4c28', W: '#f6f4ee', g: '#9aa3b5' },
    mapa: [
      '..............',
      '.....KMMK.....',
      '..KKKKMMKKKK..',
      '..KAWWWWWWBK..',
      '..KAWggggWBK..',
      '..KAWWWWWWBK..',
      '..KAWggggWBK..',
      '..KAWWWWWWBK..',
      '..KAWggggWBK..',
      '..KAWWWWWWBK..',
      '..KAWWWWWWBK..',
      '..KABBBBBBBK..',
      '..KKKKKKKKKK..',
      '..............',
    ],
  },

  /* ─── painel de controles (mixer) ───────────────────────── */
  painel: {
    cores: { K, P: '#3a3a52', L: '#565678', g: '#14141f', F: '#e0405a', Y: '#f5c518', C: '#22d3ee' },
    mapa: [
      '..............',
      '..KKKKKKKKKK..',
      '..KLLLLLLLLK..',
      '..KPgPPPPgPK..',
      '..KPgPPPPgPK..',
      '..KFFFPPPgPK..',
      '..KPgPPPPgPK..',
      '..KPgPPPFFFK..',
      '..KPPPPPPPPK..',
      '..KPYYPPCCPK..',
      '..KPYYPPCCPK..',
      '..KPPPPPPPPK..',
      '..KKKKKKKKKK..',
      '..............',
    ],
  },

  /* ─── rádio retrô ───────────────────────────────────────── */
  radio: {
    cores: { K, A: '#c98b4a', B: '#8a5526', g: '#4a3a28', Y: '#f5c518', C: '#e0405a' },
    mapa: [
      '..............',
      '...........K..',
      '..........K...',
      '.........K....',
      '.KKKKKKKKKK...',
      '.KAAAAAAABK...',
      '.KAgggAYYBK...',
      '.KAgggAYYBK...',
      '.KAgggAAABK...',
      '.KAgggACABK...',
      '.KABBBBBBBK...',
      '.KKKKKKKKKK...',
      '..............',
      '..............',
    ],
  },

  /* ─── nota musical (fila) ───────────────────────────────── */
  nota: {
    cores: { K, L: '#f6f4ee', S: '#a09a89' },
    mapa: [
      '............',
      '..LLLLLLLL..',
      '..LSSSSSSL..',
      '..LS....LS..',
      '..LS....LS..',
      '..LS....LS..',
      '..LS....LS..',
      '.LLS...LLS..',
      'LLLS..LLLS..',
      'LLSS..LLSS..',
      '.SS....SS...',
      '............',
    ],
  },

  /* ─── cronômetro (fim do foco) ──────────────────────────── */
  relogio: {
    cores: { K, M: '#b8c0cc', m: '#8a93a3', W: '#f6f4ee', S: '#c9c4b4', E: '#26201c' },
    mapa: [
      '..............',
      '.....KMMK.....',
      '.....KMmK.....',
      '....KKKKKK....',
      '...KWWWWWWK...',
      '..KWWWEWWWWK..',
      '..KWWWEWWWWK..',
      '..KWWWEEEWWK..',
      '..KWWWWWWWSK..',
      '..KWWWWWWWSK..',
      '...KWWWWWSK...',
      '....KKKKKK....',
      '..............',
      '..............',
    ],
  },

  /* ─── check (concluí) ───────────────────────────────────── */
  check: {
    cores: { K, G: '#8fe06a', g: '#4a9c38' },
    mapa: [
      '............',
      '.........KK.',
      '........KGgK',
      '.......KGgK.',
      '.KK...KGgK..',
      '.KGK.KGgK...',
      '.KgGKGgK....',
      '..KgGgK.....',
      '...KgK......',
      '....K.......',
      '............',
      '............',
    ],
  },

  /* ─── aviso ─────────────────────────────────────────────── */
  aviso: {
    cores: { K, Y: '#ffd23e', y: '#d8a018', E: '#26201c' },
    mapa: [
      '............',
      '.....KK.....',
      '....KYYK....',
      '....KYYK....',
      '...KYEEYK...',
      '...KYEEYK...',
      '..KYYEEYYK..',
      '..KYYYYYYK..',
      '.KYYYEEYYYK.',
      '.KYyyyyyyYK.',
      '.KKKKKKKKKK.',
      '............',
    ],
  },

  /* ─── pão (migalhas + emote) ────────────────────────────── */
  pao: {
    cores: { K, A: '#e8b46a', B: '#c9843a', C: '#9c5e24', F: '#f2dcae', f: '#dfc28a' },
    mapa: [
      '..............',
      '....KKKKKK....',
      '..KKABBBBBK...',
      '.KAABBBBBBBK..',
      '.KABBBBBBBBBK.',
      '.KAFFFFFFKBBK.',
      '.KFFfffFFKBBK.',
      '.KFFfffFFKBCK.',
      '.KFFFFFFFKBCK.',
      '.KFFFFFFFKCCK.',
      '.KFFFFFFFKCK..',
      '..KKKKKKKKK...',
      '..............',
      '..............',
    ],
  },

  /* ─── emotes ────────────────────────────────────────────── */
  joia: {
    cores: { K, Y: '#ffd23e', y: '#e0a93a', W: '#f6f4ee', S: '#a09a89' },
    mapa: [
      '..............',
      '.....KKK......',
      '....KYyK......',
      '....KYyK......',
      '....KYyK......',
      '..KKKYyKKKKK..',
      '.KWKYYYYYYYyK.',
      '.KWKYYYYYYYyK.',
      '.KWKYYKKKKKK..',
      '.KWKYYYYYYyK..',
      '.KWKYYKKKKKK..',
      '.KWKYYYYYyK...',
      '..KKKKKKKK....',
      '..............',
    ],
  },

  fogo: {
    cores: { K, O: '#f5651f', R: '#c1272d', Y: '#ffb42a', y: '#ffe066' },
    mapa: [
      '..............',
      '......KK......',
      '.....KOK......',
      '....KOOK.K....',
      '...KOOOKKOK...',
      '..KOOOOKOOK...',
      '..KOOYYOOOOK..',
      '.KOOYyyYOOOK..',
      '.KOYyyyyYOOK..',
      '.KOYyyyyYORK..',
      '..KOYyyYORK...',
      '...KKYYKK.....',
      '.....KK.......',
      '..............',
    ],
  },

  cafe: {
    cores: { K, X: '#f2efe7', x: '#c9c4b4', J: '#6b4423', j: '#8a5c34', S: '#b9b9c4' },
    mapa: [
      '...S....S.....',
      '...S....S.....',
      '....S..S......',
      '..............',
      '..KKKKKKKK....',
      '.KjJJJJJJJK...',
      '.KXXXXXXXXKK..',
      '.KXXXXXXXXKXK.',
      '.KXXXXXXXXKXK.',
      '.KxXXXXXXxKK..',
      '..KXXXXXXK....',
      '...KKKKKK.....',
      '..............',
      '..............',
    ],
  },

  tonto: {
    cores: { K, Y: '#ffd23e', y: '#e0a93a', E: '#26201c' },
    mapa: [
      '..............',
      '....KKKKKK....',
      '..KKYYYYYYKK..',
      '.KYYYYYYYYYYK.',
      '.KYEYEYYEYEYK.',
      '.KYYEYYYYEYYK.',
      '.KYEYEYYEYEYK.',
      '.KYYYYYYYYYYK.',
      '.KyYYYEEYYYyK.',
      '.KyYYYEEYYYyK.',
      '..KKyyyyyyKK..',
      '....KKKKKK....',
      '..............',
      '..............',
    ],
  },

  /* estrelinha do tonto (💫): estrela dourada com trilho de giro */
  estrelinha: {
    cores: { K, Y: '#ffe066', G: '#f5c518', S: '#c28f0e', T: '#cdd6e0' },
    mapa: [
      '..............',
      '.......K......',
      '..T...KYK.....',
      '.....KYYGK....',
      '..KKKKYYGKKK..',
      '.KYYYYYYGGGGK.',
      '..KKKKYGGKKK..',
      '.....KYGGK....',
      '.T....KGK.....',
      '..T....K......',
      '...TT.....TT..',
      '.....TTTTT....',
      '..............',
      '..............',
    ],
  },

  /* cocô (💩): três voltas de casquinho, rampa quente */
  coco: {
    cores: { K, A: '#a8703c', B: '#7d4c28', C: '#56311a' },
    mapa: [
      '..............',
      '......KK......',
      '.....KABK.....',
      '.....KABK.....',
      '....KAABBK....',
      '...KKAABBKK...',
      '..KAABBBBBBK..',
      '..KABBBBBBCK..',
      '.KKAABBBBBCKK.',
      '.KAABBBBBBCCK.',
      '.KABBBBCCCCCK.',
      '..KKKKKKKKKKK.',
      '..............',
      '..............',
    ],
  },

  fone: {
    cores: { K, H: '#23232e', h: '#4a4a5e', C: '#3a3a4c', W: '#f6f4ee' },
    mapa: [
      '..............',
      '....KKKKKK....',
      '..KKhhhhhhKK..',
      '..KhhKKKKhhK..',
      '.KhhK....KhhK.',
      '.KhK......KhK.',
      '.KHK......KHK.',
      'KKHHK....KHHKK',
      'KWhHK....KHhCK',
      'KWhHK....KHhCK',
      'KChHK....KHhCK',
      'KKHHK....KHHKK',
      '.KKK......KKK.',
      '..............',
    ],
  },
}

/* "anterior" é o espelho exato de "próxima" — mesma caixa, mesmo peso. */
function espelharMapa(mapa) {
  return mapa.map((linha) => [...linha].reverse().join(''))
}
/* Espelhar o mapa inverteria a luz junto — a paleta troca L↔S de volta,
   então a luz continua vindo de cima-esquerda no ícone espelhado. */
ICONES.ant = {
  cores: { K, L: '#a09a89', M: '#d5d0c2', S: '#f6f4ee' },
  mapa: espelharMapa(ICONES.prox.mapa),
}

/* Emote (string do protocolo) → ícone. A cena desenha o balão; enquanto o
   balão ainda usa fillText (cena.js), estes mapas ficam prontos pra troca. */
export const EMOTE_ICONES = {
  '👍': 'joia',
  '🔥': 'fogo',
  '☕': 'cafe',
  '😵': 'tonto',
  '🍞': 'pao',
  '🎧': 'fone',
  '💫': 'estrelinha', // interno da cena: quem leva soco
  '💩': 'coco', // interno da cena: quem leva o cocô
}

/* ─── renderização ─────────────────────────────────────────── */

const cacheCanvas = new Map()

/** Canvas do ícone em `escala` (1 char = `escala` px). */
export function iconeCanvas(nome, escala = 1) {
  const chave = `${nome}|${escala}`
  if (cacheCanvas.has(chave)) return cacheCanvas.get(chave)
  const ic = ICONES[nome]
  if (!ic) throw new Error(`ícone desconhecido: ${nome}`)
  const alt = ic.mapa.length
  const larg = Math.max(...ic.mapa.map((l) => l.length))
  const cv = document.createElement('canvas')
  cv.width = larg * escala
  cv.height = alt * escala
  const ctx = cv.getContext('2d')
  for (let y = 0; y < alt; y++) {
    const linha = ic.mapa[y]
    for (let x = 0; x < linha.length; x++) {
      const cor = ic.cores[linha[x]]
      if (!cor) continue
      ctx.fillStyle = cor
      ctx.fillRect(x * escala, y * escala, escala, escala)
    }
  }
  cacheCanvas.set(chave, cv)
  return cv
}

const cacheURI = new Map()

/** Data-URI PNG do ícone (2×, pra ficar nítido em tela retina). */
export function iconeDataURI(nome) {
  if (!cacheURI.has(nome)) cacheURI.set(nome, iconeCanvas(nome, 2).toDataURL('image/png'))
  return cacheURI.get(nome)
}

/** Tamanho natural do mapa (pra escolher múltiplos inteiros na exibição). */
export function iconeTamanho(nome) {
  return Math.max(...ICONES[nome].mapa.map((l) => l.length))
}

/** `<img>` inline pronto pra innerHTML. `px` deve ser múltiplo do mapa. */
export function iconeHtml(nome, px, alt = '') {
  const tam = px ?? iconeTamanho(nome) * 2
  return `<img class="icone" src="${iconeDataURI(nome)}" width="${tam}" height="${tam}" alt="${alt}" draggable="false">`
}

/* ═══════════════════════════════════════════════════════════════════════
   PLAQUINHA DE TAREFA — moldura de LARGURA VARIÁVEL

   A tarefa que o pombo pegou no mural fica pendurada acima dele o SPRINT
   INTEIRO. Por isso ela não podia ser o balão de fala (branco liso, rabinho,
   some em 3s): balão é conversa passageira, isto aqui é um objeto afixado.

   É uma TABUINHA DE MADEIRA com a folha do mural presa por um CLIPE DE
   METAL — a mesma prancheta do ícone `mural`, só que a lasca que o pombo
   arrancou dela. Três materiais com rampa própria (madeira 5 tons, papel 4,
   metal 4), luz de cima-esquerda, contorno K de 1px, zero gradiente.
   Combina com a praça: a madeira é a MESMA rampa da banca de jornal e do
   coreto (C.madeira/madeiraL/madeiraS do cenario.js), o papel é o mesmo
   C.papel dos lambe-lambes do muro.

   ── LARGURA VARIÁVEL ─────────────────────────────────────────────────
   Nada aqui é mapa de tamanho fixo: a moldura é pintada em BANDAS (9-slice
   feito à mão) e os detalhes são ANCORADOS —

     · cantos    parafusos 2x2 nos quatro cantos da madeira;
     · topo      presilha de metal (mapa de chars, 13x7) centrada, subindo
                 2px acima da tábua e mordendo a primeira linha do papel;
     · bandas    4px de madeira em cada lado, com veio pseudoaleatório
                 DETERMINÍSTICO por coluna (mesma largura = mesmo veio) e um
                 nó na tábua de baixo;
     · miolo     papel REBAIXADO: sombra no alto/esquerda, luz embaixo/à
                 direita, pauta de caderno atrás de cada linha de texto.

   A altura é fixa por número de linhas (1 ou 2). O texto NÃO é desenhado
   aqui — `desenharPlaquinha` devolve a caixa de texto pra quem chamou.
   ═══════════════════════════════════════════════════════════════════════ */

export const PLAQUINHA = {
  BORDA: 4, // banda de madeira em cada lado da tábua
  PAD: 1, // respiro entre a borda do papel e o texto
  ALTURA_LINHA: 6, // altura de uma linha de texto, em px de arte
  ACIMA: 2, // quanto o clipe sobe acima da tábua
  SOBRA: 2, // sombra projetada: 2px pra baixo e pra direita
  MIN_COLUNAS: 17, // campo de texto mínimo (senão o clipe não cabe na tábua)
}

/* Rampas. A madeira tem 5 tons e a sombra profunda desliza pro vinho
   (madV), não pro preto — igual às referências. */
const CP = {
  K,
  madBri: '#cfa87a', // aresta de cima pegando sol
  madL: '#b58f65',
  mad: '#9a7550',
  madS: '#6b4f36',
  madV: '#4a3324', // nó e desgaste: sombra profunda, matiz vinho
  papL: '#f8f5ec',
  pap: '#ece8dc',
  papS: '#d9d3c0',
  papV: '#c2bba4',
  pauta: '#e2ddcd', // pauta do caderno: 1 degrau abaixo do papel, quase nada
  metL: '#eaf0f8', // highlight duro do metal (chapinha estampada)
  met: '#b6bfd0',
  metM: '#828da0',
  metS: '#525b68',
}

/* Presilha de metal (13x7). Só ela é mapa de chars: é a peça que tem forma,
   e forma se desenha à mão. Chapinha estampada e ACHATADA (a primeira versão
   era abaulada e virou um pão cinza), com vinco fundo atravessando e uma
   LINGUETA central que desce e morde a primeira linha do papel — sem a
   lingueta ela parecia pintada na madeira, não presa. Nada de dois rebites
   simétricos: com a lingueta embaixo, viravam dois olhos e uma boca.
   As duas primeiras linhas ficam ACIMA da tábua (PLAQUINHA.ACIMA). */
const CLIPE = [
  '.KKKKKKKKKKK.',
  'KLLSSSSSSSShK',
  'KLSSSSSSSSShK',
  'KmmmmmmmmmmmK',
  'KhhhhhhhhhhhK',
  '.KKKKKKKKKKK.',
  '....KmmmK....',
]
const CLIPE_CORES = { K: CP.K, L: CP.metL, S: CP.met, h: CP.metM, m: CP.metS }

/* Ruído estável por coluna: o veio da madeira precisa parecer sorteado mas
   NÃO pode dançar entre um quadro e outro (a placa é cacheada por largura). */
function ruido(n) {
  let h = (n * 2654435761) >>> 0
  h ^= h >>> 15
  h = (h * 2246822519) >>> 0
  return (h >>> 8) / 16777216
}

function tingir(hex, f) {
  const n = parseInt(hex.slice(1), 16)
  const canal = (d) => Math.max(0, Math.min(255, Math.round(((n >> d) & 255) * f)))
  return `#${[16, 8, 0].map((d) => canal(d).toString(16).padStart(2, '0')).join('')}`
}

/** Altura da tábua (px de arte) pra N linhas de texto. */
export function alturaPlaquinha(linhas = 2) {
  return PLAQUINHA.BORDA * 2 + Math.max(1, linhas) * PLAQUINHA.ALTURA_LINHA + 2
}

/** Largura da tábua (px de arte) pro campo de texto pedido, em colunas. */
export function larguraPlaquinha(colunas) {
  return Math.max(PLAQUINHA.MIN_COLUNAS, Math.round(colunas)) + (PLAQUINHA.BORDA + PLAQUINHA.PAD) * 2
}

/**
 * Pinta a plaquinha pixel a pixel, em px de ARTE, no mesmo contrato do
 * cenario.js: g = { r(x,y,w,h,cor), a(alfa) }. Serve tanto pro canvas do
 * jogo quanto pro preview headless.
 * A tábua ocupa (0, ACIMA) até (larg, ACIMA+alt); o clipe sobe até y=0 e a
 * sombra projetada vaza 2px pra direita e pra baixo.
 * @param {object} g destino
 * @param {number} larg largura da tábua em px de arte
 * @param {number} alt altura da tábua em px de arte
 * @param {string} [cor] cor da crista do dono — vira uma faixa pintada na
 *                       madeira da esquerda (mesma pista do rótulo de nome)
 */
export function pintarPlaquinha(g, larg, alt, cor = null) {
  const W = Math.max(PLAQUINHA.MIN_COLUNAS + 10, Math.round(larg))
  const H = Math.round(alt)
  const O = PLAQUINHA.ACIMA // deslocamento vertical da tábua no canvas
  const r = (x, y, w, h, c) => {
    if (w > 0 && h > 0) g.r(Math.round(x), Math.round(y) + O, Math.round(w), Math.round(h), c)
  }
  const p = (x, y, c) => r(x, y, 1, 1, c)

  /* 1. sombra projetada — a placa flutua, então precisa de peso. Alfa é o
        mesmo recurso que o cenário usa nas sombras longas. */
  if (g.a) {
    g.a(0.22)
    r(2, 2, W, H, CP.K)
    g.a(1)
  }

  /* 2. tábua: contorno fechado + miolo de madeira */
  r(0, 0, W, H, CP.K)
  r(1, 1, W - 2, H - 2, CP.mad)

  /* 3. bandas horizontais (a junta do "quadro" é de topo, como marcenaria
        tosca de verdade): em cima a aresta pega sol, embaixo some. */
  r(1, 1, W - 2, 1, CP.madBri) // aresta de cima: a rampa começa no brilho
  r(1, 2, W - 2, 1, CP.mad) // corpo da tábua: o degrau tem que ser sentido
  r(1, 3, W - 2, 1, CP.madS) // lábio interno de cima: vira sombra pro rebaixo
  r(1, H - 4, W - 2, 1, CP.madL) // lábio interno de baixo: pega a luz que volta
  r(1, H - 2, W - 2, 1, CP.madS)

  /* 4. bandas laterais, só na altura do papel (senão comem as juntas) */
  const yPap = PLAQUINHA.BORDA
  const hPap = H - PLAQUINHA.BORDA * 2
  r(1, yPap, 1, hPap, CP.madL)
  r(3, yPap, 1, hPap, CP.madS)
  r(W - 4, yPap, 1, hPap, CP.madL)
  r(W - 2, yPap, 1, hPap, CP.madS)
  r(W - 3, yPap, 1, hPap, CP.mad)

  /* 5. veio: RISCOS de 2 a 4px deitados no sentido da tábua (ponto solto
        vira sujeira; risco vira madeira), com uma segunda camada rala mais
        escura. Comprimento e intervalo saem do mesmo ruído estável. */
  const veio = (y, cor, semente, corte) => {
    for (let x = 2; x < W - 3; ) {
      if (ruido(x * 7 + semente) > corte) {
        const len = 2 + Math.floor(ruido(x * 3 + semente) * 3)
        r(x, y, Math.min(len, W - 3 - x), 1, cor)
        x += len + 2 + Math.floor(ruido(x * 5 + semente) * 4)
      } else x += 1 + Math.floor(ruido(x * 13 + semente) * 3)
    }
  }
  veio(2, CP.madL, 13, 0.74) // tábua de cima: veio CLARO sobre o corpo
  veio(2, CP.madS, 57, 0.88) // veio fundo, bem ralo
  veio(H - 3, CP.madS, 91, 0.7) // tábua de baixo
  veio(H - 4, CP.mad, 29, 0.9)
  // nó da tábua de baixo, sempre à direita do centro
  const xNo = W - 11
  if (xNo > 6) {
    r(xNo, H - 3, 4, 1, CP.madS)
    r(xNo + 1, H - 3, 2, 1, CP.madV)
    p(xNo + 1, H - 4, CP.madS)
    p(xNo + 2, H - 2, CP.madS)
  }
  // desgaste: a quina de baixo-direita bateu em muita coisa
  p(W - 2, H - 2, CP.madV)
  p(W - 3, H - 2, CP.madV)
  p(W - 2, H - 3, CP.madS)

  /* 6. faixa da crista do dono (opcional): tinta velha na madeira esquerda */
  if (cor) {
    r(1, yPap, 1, hPap, tingir(cor, 1.22))
    r(2, yPap, 1, hPap, cor)
    p(1, yPap, tingir(cor, 1.45)) // ponta de cima pegando sol
    p(2, yPap + hPap - 1, tingir(cor, 0.6))
  }

  /* 7. papel REBAIXADO na madeira: sombra em cima/esquerda, luz embaixo/à
        direita. É esse par que faz o papel afundar em vez de flutuar. */
  const xPap = PLAQUINHA.BORDA
  const wPap = W - PLAQUINHA.BORDA * 2
  r(xPap, yPap, wPap, hPap, CP.pap)
  r(xPap, yPap + hPap - 1, wPap, 1, CP.papL)
  r(xPap + wPap - 1, yPap, 1, hPap, CP.papL)
  r(xPap, yPap, wPap, 1, CP.papS)
  r(xPap, yPap, 1, hPap, CP.papS)
  p(xPap, yPap, CP.papV)
  p(xPap, yPap + hPap - 1, CP.papS)

  /* 8. pauta: um risco por linha de texto, atrás do que o chamador escreve */
  const linhas = Math.round((hPap - 2) / PLAQUINHA.ALTURA_LINHA)
  for (let i = 0; i < linhas; i++) {
    const y = yPap + 1 + i * PLAQUINHA.ALTURA_LINHA + (PLAQUINHA.ALTURA_LINHA - 1)
    r(xPap + 1, y, wPap - 2, 1, CP.pauta)
  }

  /* 9. parafusos 2x2 nos quatro cantos da madeira */
  const parafuso = (x, y) => {
    p(x, y, CP.metL)
    p(x + 1, y, CP.metM)
    p(x, y + 1, CP.metM)
    p(x + 1, y + 1, CP.metS)
  }
  parafuso(2, 1)
  parafuso(W - 4, 1)
  parafuso(2, H - 3)
  parafuso(W - 4, H - 3)

  /* 10. presilha de metal no topo, mordendo a primeira linha do papel.
         A sombra vem ANTES, senão o metal ficaria por baixo dela. */
  const x0 = Math.round((W - CLIPE[0].length) / 2)
  r(x0 + 1, yPap, CLIPE[0].length - 2, 1, CP.papV)
  for (let y = 0; y < CLIPE.length; y++)
    for (let x = 0; x < CLIPE[y].length; x++) {
      const c = CLIPE_CORES[CLIPE[y][x]]
      if (c) p(x0 + x, y - PLAQUINHA.ACIMA, c)
    }
}

const cachePlaq = new Map()

/** Canvas da plaquinha em `fator` (1 px de arte = `fator` px de tela). */
export function plaquinhaCanvas(larg, alt, fator = 1, cor = null) {
  const chave = `${larg}x${alt}|${fator}|${cor || '-'}`
  if (cachePlaq.has(chave)) return cachePlaq.get(chave)
  const cv = document.createElement('canvas')
  cv.width = (larg + PLAQUINHA.SOBRA) * fator
  cv.height = (PLAQUINHA.ACIMA + alt + PLAQUINHA.SOBRA) * fator
  const c2 = cv.getContext('2d')
  pintarPlaquinha(
    {
      r: (x, y, w, h, cor2) => {
        c2.fillStyle = cor2
        c2.fillRect(x * fator, y * fator, w * fator, h * fator)
      },
      a: (v) => (c2.globalAlpha = v),
    },
    larg,
    alt,
    cor,
  )
  // cache modesto: as larguras se repetem (tarefas parecidas, zoom estável)
  if (cachePlaq.size > 120) cachePlaq.clear()
  cachePlaq.set(chave, cv)
  return cv
}

/**
 * Desenha a plaquinha CENTRADA em `cx`, com a base da tábua em `baseY`
 * (ambos em px de TELA, como o rótulo de nome e o balão).
 *
 *   const cx0 = desenharPlaquinha(ctx, cx, topoRotulo - 4, largTexto, 2, escala, cor)
 *
 * Devolve a caixa pra quem chamou escrever o texto por cima:
 *   { x, y, larg, alt, topo, textoX, textoLarg, textoTopo, altLinha, fator }
 * — `textoTopo` é o topo da PRIMEIRA linha (use textBaseline='top'),
 *   `altLinha` é o passo entre linhas, `topo` é o topo do clipe (pra
 *   empilhar outra coisa acima).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx centro horizontal, em px de tela
 * @param {number} baseY base da tábua, em px de tela
 * @param {number} larguraTexto largura do texto medida com ctx.measureText
 * @param {number} linhas 1 ou 2
 * @param {number} escala px de tela por px de mundo (a mesma do rótulo)
 * @param {string} [cor] cor da crista do dono, opcional
 */
export function desenharPlaquinha(ctx, cx, baseY, larguraTexto, linhas = 2, escala = 4, cor = null) {
  // Fator INTEIRO, igual aos emotes: o drawImage sai 1:1 e o pixel não borra.
  const fator = Math.max(1, Math.round(escala))
  const colunas = Math.max(PLAQUINHA.MIN_COLUNAS, Math.ceil(larguraTexto / fator))
  const larg = larguraPlaquinha(colunas)
  const alt = alturaPlaquinha(linhas)
  const img = plaquinhaCanvas(larg, alt, fator, cor)

  // Presa na janela, igual ao balão: placa cortada pela borda é pior que
  // placa 10px fora do lugar. Só desloca se ela couber na tela.
  const limite = ctx.canvas.width - larg * fator - 4
  let x = Math.round(cx - (larg * fator) / 2)
  if (limite > 4) x = Math.max(4, Math.min(limite, x))
  const y = Math.round(baseY) - (PLAQUINHA.ACIMA + alt) * fator
  ctx.drawImage(img, x, y)

  const dentro = (PLAQUINHA.BORDA + PLAQUINHA.PAD) * fator
  return {
    x,
    y,
    larg: larg * fator,
    alt: (PLAQUINHA.ACIMA + alt) * fator,
    topo: y,
    textoX: x + dentro,
    textoLarg: (larg - (PLAQUINHA.BORDA + PLAQUINHA.PAD) * 2) * fator,
    textoTopo: y + (PLAQUINHA.ACIMA + PLAQUINHA.BORDA + 1) * fator,
    altLinha: PLAQUINHA.ALTURA_LINHA * fator,
    fator,
  }
}

/** Troca todo `<i data-icone="nome" data-tam="24">` do documento pelo ícone. */
export function montarIcones(root = document) {
  for (const el of root.querySelectorAll('[data-icone]')) {
    const nome = el.dataset.icone
    const px = el.dataset.tam ? +el.dataset.tam : undefined
    el.outerHTML = iconeHtml(nome, px)
  }
}
