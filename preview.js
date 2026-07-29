/* Renderiza a praça num PNG sem abrir o navegador.
   Serve pra conferir a arte e o enquadramento rápido.
   uso: node preview.js [saida.png]                                        */

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { SPRITES, CENARIO, coresDe } from './public/sprites.js'

const LARG = 330
const ALT = 96
const ESCALA = 5
const LINHA_CHAO = 74
const ESTACAO = 52
const PASSO_MAX = 56

/* ─── framebuffer ─────────────────────────────────────────── */

const buf = new Uint8Array(LARG * ALT * 4)

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
}

function px(x, y, cor) {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || y < 0 || x >= LARG || y >= ALT) return
  const i = (y * LARG + x) * 4
  const [r, g, b] = hex(cor)
  buf[i] = r
  buf[i + 1] = g
  buf[i + 2] = b
  buf[i + 3] = 255
}

function retangulo(x, y, w, h, cor) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, cor)
}

function elipse(cx, cy, rx, ry, cor) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) px(x, y, cor)
    }
}

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

/* ─── a cena ──────────────────────────────────────────────── */

retangulo(0, 0, LARG, ALT, CENARIO.ceu)
elipse(LARG / 2, LINHA_CHAO + 1, LARG * 0.44, 9, CENARIO.chao)
elipse(LARG / 2, LINHA_CHAO - 1, LARG * 0.41, 6, CENARIO.chaoLuz)

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
  const n = PRACA.length
  const passo = Math.min(PASSO_MAX, (LARG - ESTACAO - 8) / Math.max(n - 1, 1))
  const largura = (n - 1) * passo + ESTACAO
  PRACA.forEach((j, i) => {
    const x0 = (LARG - largura) / 2 + i * passo
    // Quadros de digitação alternados, pra ver os três de uma vez.
    sprite(['sentado', 'sentado2', 'sentado3'][i % 3], x0 + 8, LINHA_CHAO, j.corpo, j.crista)
    sprite(i % 2 ? 'notebook2' : 'notebook', x0 - 8, LINHA_CHAO + 1)
  })
} else {
  const poses = ['parado', 'soco', 'tonto', 'vooCima', 'vooBaixo', 'bicando2']
  PRACA.forEach((j, i) => {
    sprite(poses[i], 4 + i * 54, LINHA_CHAO + (poses[i].startsWith('voo') ? -14 : 0), j.corpo, j.crista, false)
  })
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
