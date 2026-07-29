/* Renderiza a PRAÇA REAL (cenario.js, 1280x480) num PNG sem abrir o
   navegador — o mesmo pintarCena/desenharAnimados que o jogo usa, mais
   pombos de sprites.js e pedestres de pessoas.js por cima. Serve pra
   conferir arte, enquadramento e os poleiros do mundo novo.
   uso: node preview.js [saida.png] [pausa]                                 */

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { SPRITES, coresDe } from './public/sprites.js'
import { pintarCena, desenharAnimados, LARG, ALT, CHAO, FIOS } from './public/cenario.js'
import { PESSOAS, PALETA_PESSOAS } from './public/pessoas.js'

const ESCALA = 2

/* ─── framebuffer ─────────────────────────────────────────── */

const buf = new Uint8Array(LARG * ALT * 4)

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
}

let alfa = 1

function px(x, y, cor) {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || y < 0 || x >= LARG || y >= ALT) return
  const i = (y * LARG + x) * 4
  const [r, g, b] = hex(cor)
  // O cenário usa a(0.12) pra sombras longas — mistura com o que já está lá.
  buf[i] = Math.round(buf[i] * (1 - alfa) + r * alfa)
  buf[i + 1] = Math.round(buf[i + 1] * (1 - alfa) + g * alfa)
  buf[i + 2] = Math.round(buf[i + 2] * (1 - alfa) + b * alfa)
  buf[i + 3] = 255
}

function retangulo(x, y, w, h, cor) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, cor)
}

/* ─── cenário: estático + camada animada num instante fixo ── */

pintarCena({
  r: (x, y, w, h, cor) => retangulo(x, y, w, h, cor),
  a: (v) => (alfa = v),
})
alfa = 1

// ctx "de mentira": desenharAnimados só usa fillStyle/fillRect.
const ctxFake = {
  fillStyle: '#000',
  fillRect(x, y, w, h) {
    retangulo(x, y, w, h, this.fillStyle)
  },
}
desenharAnimados(ctxFake, 1234, 1)

/* ─── sprites ─────────────────────────────────────────────── */

function sprite(nome, x, y, iCorpo = 0, iCrista = 0, espelhar = false) {
  const mapa = SPRITES[nome]
  const cores = coresDe(iCorpo, iCrista)
  const larg = Math.max(...mapa.map((l) => l.length))
  const topo = y - mapa.length
  for (let j = 0; j < mapa.length; j++)
    for (let i = 0; i < mapa[j].length; i++) {
      const cor = cores[mapa[j][i]]
      if (cor) px(x + (espelhar ? larg - 1 - i : i), topo + j, cor)
    }
}

function pessoa(iPessoa, pose, x, espelhar = false) {
  const mapa = PESSOAS[iPessoa].mapas[pose] || PESSOAS[iPessoa].mapas.parado1
  const larg = mapa[0].length
  const topo = CHAO - mapa.length
  for (let j = 0; j < mapa.length; j++)
    for (let i = 0; i < mapa[j].length; i++) {
      const cor = PALETA_PESSOAS[mapa[j][i]]
      if (cor) px(x + (espelhar ? larg - 1 - i : i), topo + j, cor)
    }
}

/* ─── a cena ──────────────────────────────────────────────── */

const PRACA = [
  { nome: 'Pedro', corpo: 0, crista: 0 },
  { nome: 'Gordinho', corpo: 1, crista: 2 },
  { nome: 'Zé Bicudo', corpo: 2, crista: 3 },
  { nome: 'Migalha', corpo: 3, crista: 5 },
  { nome: 'Torresmo', corpo: 4, crista: 1 },
  { nome: 'Ruflante', corpo: 5, crista: 4 },
]

const modo = process.argv[3] === 'pausa' ? 'pausa' : 'foco'

if (modo === 'foco') {
  // Todo mundo sentado trabalhando, espalhado pelo calçadão.
  PRACA.forEach((j, i) => {
    const x0 = 120 + i * 190
    sprite(['sentado', 'sentado2', 'sentado3'][i % 3], x0 + 8, CHAO, j.corpo, j.crista)
    sprite(i % 2 ? 'notebook2' : 'notebook', x0 - 8, CHAO + 1)
  })
} else {
  // Passeio: poses variadas no chão + UM POMBO POUSADO NO FIO (patas na
  // catenária de FIOS[0]) + os cinco pedestres em cena.
  const poses = ['parado', 'soco', 'vooCima', 'vooBaixo', 'bicando2']
  poses.forEach((p2, i) => {
    sprite(p2, 240 + i * 170, CHAO + (p2.startsWith('voo') ? -120 : 0), PRACA[i].corpo, PRACA[i].crista)
  })
  const xFio = 300 // dentro do vão 1 (150..490)
  sprite('parado', xFio, FIOS[0].y(xFio + 14), PRACA[5].corpo, PRACA[5].crista)

  pessoa(3, 'varrer1', 194) // jornaleiro varrendo na frente da banca
  pessoa(1, 'andar2', 420, true) // senhora indo pra direita
  pessoa(2, 'digitar1', 600) // jovem digitando
  pessoa(0, 'andar1', 820, true) // executivo apressado
  pessoa(4, 'andar3', 1080) // corredora
}

/* ─── escala + PNG ────────────────────────────────────────── */

const W = LARG * ESCALA
const H = ALT * ESCALA
const linhas = Buffer.alloc(H * (W * 4 + 1))
let p = 0
for (let y = 0; y < H; y++) {
  linhas[p++] = 0 // filtro "none"
  for (let x = 0; x < W; x++) {
    const i = (Math.floor(y / ESCALA) * LARG + Math.floor(x / ESCALA)) * 4
    linhas[p++] = buf[i]
    linhas[p++] = buf[i + 1]
    linhas[p++] = buf[i + 2]
    linhas[p++] = buf[i + 3]
  }
}

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(b) {
  let c = 0xffffffff
  for (const byte of b) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(tipo, dados) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(dados.length)
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([len, corpo, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bits por canal
ihdr[9] = 6 // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(linhas, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

const saida = process.argv[2] || 'preview.png'
writeFileSync(saida, png)
console.log(`  🖼️  ${saida} · ${W}x${H} · modo ${modo}`)
