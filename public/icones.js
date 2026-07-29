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

/** Troca todo `<i data-icone="nome" data-tam="24">` do documento pelo ícone. */
export function montarIcones(root = document) {
  for (const el of root.querySelectorAll('[data-icone]')) {
    const nome = el.dataset.icone
    const px = el.dataset.tam ? +el.dataset.tam : undefined
    el.outerHTML = iconeHtml(nome, px)
  }
}
