/* Teste de ponta a ponta da regra que sustenta o produto:
   3 pombos atravessam um sprint inteiro juntos e cada um recebe
   10 (base) + 2 amigos × 5 = 20 migalhas. Também confere que o mural
   fica trancado durante o foco.
   uso: node teste.js                                                      */

import { io } from 'socket.io-client'

const URL = process.env.URL || 'http://localhost:3000'
const SALA = 'TST' + String(Math.floor(process.uptime() * 1000) % 99).padStart(2, '0')
const N = 3

const sockets = []
const creditos = []
let recusas = 0
let faseAnterior = null

console.log(`  sala ${SALA} · esperando um ciclo turbo completo (até ~2min)\n`)

for (let i = 0; i < N; i++) {
  const s = io(URL)
  sockets.push(s)
  s.on('connect', () => s.emit('entrar', { codigo: SALA, id: `t${i}`, nome: `Pombo${i}`, corpo: i, crista: i }))
  s.on('creditado', (c) => {
    creditos.push({ quem: `Pombo${i}`, ...c })
    console.log(`  🍞 Pombo${i} recebeu ${c.ganho} (base ${c.base} + bando ${c.bando})`)
  })
  s.on('recusado', () => recusas++)

  if (i === 0) {
    let liguei = false
    s.on('estado', (e) => {
      if (!liguei) {
        liguei = true
        // Espera os 3 pombos pousarem antes do play, senão os atrasados
        // entram com o sprint rolando e (corretamente) ficam de fora.
        setTimeout(() => {
          s.emit('config', { focusMin: 1, breakMin: 1 })
          s.emit('timer', { acao: 'play' })
        }, 800)
        return
      }
      if (e.fase !== faseAnterior) {
        console.log(`  ⏱  ${e.fase} (${e.restante}s restantes${e.rodando ? '' : ', pausado'})`)
        faseAnterior = e.fase
      }
    })
  }
}

// Cutuca o mural durante o foco: tem que ser recusado.
setInterval(() => sockets[1]?.emit('mural', { texto: 'posso falar?' }), 4000)

setTimeout(() => {
  console.log('\n  ── resultado ──')
  const ok = []
  const falhas = []

  // O teste atravessa mais de um ciclo, então o que importa é que cada
  // pombo apareça — não o total de créditos.
  const distintos = new Set(creditos.map((c) => c.quem))
  distintos.size === N
    ? ok.push(`os ${N} pombos foram creditados (${creditos.length} créditos no total)`)
    : falhas.push(`creditados ${distintos.size}/${N} pombos distintos`)

  const esperado = 10 + 5 * (N - 1)
  creditos.every((c) => c.ganho === esperado)
    ? ok.push(`bônus de bando correto: ${esperado} migalhas cada`)
    : falhas.push(`ganho errado: ${creditos.map((c) => c.ganho).join(', ')} (esperava ${esperado})`)

  recusas > 0
    ? ok.push(`mural trancado durante o foco (${recusas} tentativas barradas)`)
    : falhas.push('mural NÃO foi trancado durante o foco')

  ok.forEach((t) => console.log(`  ✓ ${t}`))
  falhas.forEach((t) => console.log(`  ✗ ${t}`))
  console.log()
  process.exit(falhas.length ? 1 : 0)
}, 170000)
