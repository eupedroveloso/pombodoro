/* Pombos de mentira pra testar a praça sozinho.
   uso: node bots.js [CODIGO] [QUANTOS]                                    */

import { io } from 'socket.io-client'

const CODIGO = (process.argv[2] || 'TESTE').toUpperCase()
const QUANTOS = Number(process.argv[3] || 4)
const URL = process.env.URL || 'http://localhost:3000'

const NOMES = ['Gordinho', 'Pé-de-Pano', 'Zé Bicudo', 'Ruflante', 'Migalha', 'Torresmo', 'Cocada']
const EMOTES = ['👍', '🔥', '☕', '😵', '🍞', '🎧']
const FALAS = ['bom sprint', 'alguém pega um café?', 'travei numa regex', 'bora mais um', 'esse foi puxado']

for (let i = 0; i < QUANTOS; i++) {
  const nome = NOMES[i % NOMES.length]
  const socket = io(URL)

  socket.on('connect', () => {
    socket.emit('entrar', {
      codigo: CODIGO,
      id: `bot-${i}`,
      nome,
      corpo: i % 6,
      crista: (i * 2 + 1) % 6,
    })
    console.log(`  🐦 ${nome} pousou em ${CODIGO}`)
  })

  let liguei = false
  socket.on('estado', (s) => {
    if (i !== 0) return
    // O primeiro bot configura 1min/1min e dá o play, uma vez só.
    if (!liguei && !s.rodando) {
      liguei = true
      socket.emit('config', { focusMin: 1, breakMin: 1 })
      socket.emit('timer', { acao: 'play' })
    }
    console.log(`  [${s.fase}${s.rodando ? '' : ' ⏸'}] ${s.restante}s · ${s.jogadores.length} na praça`)
  })

  // Passeia de vez em quando (na pausa; no foco o servidor descarta).
  setInterval(() => {
    socket.emit('mover', { x: Math.floor(10 + Math.random() * 600), dir: Math.random() < 0.5 ? 1 : -1, acao: 'anda' })
  }, 5000 + i * 1300)
  // E de vez em quando parte pra porrada — ou pior.
  setInterval(() => socket.emit('mover', { acao: 'soco', dir: 1 }), 17000 + i * 4100)
  setInterval(() => socket.emit('mover', { acao: 'coco', dir: 1 }), 23000 + i * 5700)

  socket.on('creditado', ({ ganho, total }) => console.log(`  🍞 ${nome} +${ganho} (${total})`))

  setInterval(() => socket.emit('emote', { emoji: EMOTES[Math.floor(Math.random() * EMOTES.length)] }), 6000 + i * 1700)
  setInterval(() => socket.emit('mural', { texto: FALAS[Math.floor(Math.random() * FALAS.length)] }), 9000 + i * 2300)
}
