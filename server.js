import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = join(__dirname, 'data.json')
const PORT = process.env.PORT || 3000

/* ─────────────────────────── regras da praça ─────────────────────────── */

const FOCO_PADRAO = 30 * 60
const PAUSA_PADRAO = 6 * 60
const BASE_MIGALHAS = 10
const BONUS_POR_AMIGO = 5
const MAX_AMIGOS_BONUS = 3
const MAX_SPRINTS_DIA = 8
const TOLERANCIA_QUEDA_SEC = 120 // reconectou em até 2min? o sprint continua valendo
const SOME_DA_PRACA_SEC = 600 // offline há 10min: sai do desenho, mantém as migalhas
const ALCANCE_SOCO = 26 // px lógicos
const EMPURRAO_SOCO = 14

function chaveDoDia(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().slice(0, 10)
}

/* ─────────────────────────── estado + persistência ─────────────────────────── */

/** O timer é estado da sala: qualquer pombo presente pode controlar. */
function novoTimer(focusSec = FOCO_PADRAO, breakSec = PAUSA_PADRAO) {
  return { fase: 'foco', restante: focusSec, rodando: false, focusSec, breakSec }
}

const salas = new Map()

function novaSala(codigo) {
  return { codigo, timer: novoTimer(), jogadores: new Map(), mural: [] }
}

function pegarSala(codigo) {
  if (!salas.has(codigo)) salas.set(codigo, novaSala(codigo))
  return salas.get(codigo)
}

function anunciar(sala, texto) {
  sala.mural.push({ tipo: 'sistema', texto, ts: Date.now() })
}

function carregar() {
  if (!existsSync(DATA_FILE)) return
  try {
    const bruto = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
    for (const [codigo, dados] of Object.entries(bruto)) {
      const sala = novaSala(codigo)
      if (Number.isFinite(dados.focusSec)) sala.timer = novoTimer(dados.focusSec, dados.breakSec)
      for (const [id, j] of Object.entries(dados.jogadores || {})) {
        sala.jogadores.set(id, {
          id,
          nome: j.nome,
          crista: j.crista,
          corpo: j.corpo,
          migalhas: j.migalhas || 0,
          sprints: j.sprints || 0,
          sprintsHoje: j.dia === chaveDoDia() ? j.sprintsHoje || 0 : 0,
          dia: chaveDoDia(),
          online: false,
          offlineDesde: Date.now(),
          socketId: null,
          focoValido: false,
        })
      }
      salas.set(codigo, sala)
    }
  } catch (e) {
    console.error('[pombodoro] não consegui ler data.json, começando limpo:', e.message)
  }
}

let salvarPendente = null
function salvar() {
  if (salvarPendente) return
  salvarPendente = setTimeout(() => {
    salvarPendente = null
    const saida = {}
    for (const [codigo, sala] of salas) {
      saida[codigo] = {
        focusSec: sala.timer.focusSec,
        breakSec: sala.timer.breakSec,
        jogadores: Object.fromEntries(
          [...sala.jogadores].map(([id, j]) => [
            id,
            {
              nome: j.nome,
              crista: j.crista,
              corpo: j.corpo,
              migalhas: j.migalhas,
              sprints: j.sprints,
              sprintsHoje: j.sprintsHoje,
              dia: j.dia,
            },
          ])
        ),
      }
    }
    try {
      writeFileSync(DATA_FILE, JSON.stringify(saida, null, 2))
    } catch (e) {
      console.error('[pombodoro] falhei ao salvar:', e.message)
    }
  }, 1500)
}

/* ─────────────────────────── serialização pro cliente ─────────────────────────── */

function jogadoresVisiveis(sala) {
  const agora = Date.now()
  return [...sala.jogadores.values()]
    .filter((j) => j.online || agora - j.offlineDesde < SOME_DA_PRACA_SEC * 1000)
    .map((j) => ({
      id: j.id,
      nome: j.nome,
      crista: j.crista,
      corpo: j.corpo,
      x: j.posX, // quem entra agora vê os outros onde eles pararam
      dir: j.posDir,
      migalhas: j.migalhas,
      sprints: j.sprints,
      sprintsHoje: j.sprintsHoje,
      online: j.online,
      focoValido: j.focoValido,
    }))
    .sort((a, b) => b.migalhas - a.migalhas || a.nome.localeCompare(b.nome))
}

function estado(sala) {
  const t = sala.timer
  return {
    codigo: sala.codigo,
    // O cliente conta os segundos sozinho a partir daqui — sem tráfego por segundo.
    agoraServidor: Date.now(),
    fase: t.fase,
    restante: t.restante,
    rodando: t.rodando,
    focusSec: t.focusSec,
    breakSec: t.breakSec,
    jogadores: jogadoresVisiveis(sala),
    mural: sala.mural.slice(-60),
  }
}

const emFoco = (sala) => sala.timer.fase === 'foco' && sala.timer.rodando

/* ─────────────────────────── servidor ─────────────────────────── */

const app = express()
const http = createServer(app)
const io = new Server(http)

app.use(express.static(join(__dirname, 'public')))
app.get('/r/:codigo', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')))

io.on('connection', (socket) => {
  let sala = null
  let jogador = null

  socket.on('entrar', (payload = {}) => {
    const codigo = String(payload.codigo || '').toUpperCase().slice(0, 8)
    const id = String(payload.id || '').slice(0, 40)
    if (!codigo || !id) return

    sala = pegarSala(codigo)
    socket.join(codigo)

    const existente = sala.jogadores.get(id)
    const nome = String(payload.nome || 'Pombo').trim().slice(0, 16) || 'Pombo'

    if (existente) {
      jogador = existente
      jogador.nome = nome
      jogador.crista = payload.crista ?? jogador.crista
      jogador.corpo = payload.corpo ?? jogador.corpo
      const voltouRapido = Date.now() - jogador.offlineDesde < TOLERANCIA_QUEDA_SEC * 1000
      if (!voltouRapido) jogador.focoValido = false
    } else {
      jogador = {
        id,
        nome,
        crista: payload.crista ?? 0,
        corpo: payload.corpo ?? 0,
        migalhas: 0,
        sprints: 0,
        sprintsHoje: 0,
        dia: chaveDoDia(),
        online: true,
        offlineDesde: 0,
        socketId: socket.id,
        focoValido: false, // entrou com o sprint rolando? esse não conta
      }
      sala.jogadores.set(id, jogador)
      anunciar(sala, `${nome} pousou na praça`)
    }

    jogador.online = true
    jogador.socketId = socket.id
    if (jogador.dia !== chaveDoDia()) {
      jogador.dia = chaveDoDia()
      jogador.sprintsHoje = 0
    }

    salvar()
    io.to(codigo).emit('estado', estado(sala))
  })

  /* ── controles do cronômetro ── */

  socket.on('timer', (payload = {}) => {
    if (!sala || !jogador) return
    const t = sala.timer
    const acao = String(payload.acao || '')

    if (acao === 'play' && !t.rodando) {
      t.rodando = true
      // Sprint começando do zero: quem está presente entra valendo.
      if (t.fase === 'foco' && t.restante === t.focusSec) abrirSprint(sala)
      anunciar(sala, `${jogador.nome} deu o play ▶`)
    } else if (acao === 'pause' && t.rodando) {
      t.rodando = false
      anunciar(sala, `${jogador.nome} pausou o relógio ⏸`)
    } else if (acao === 'reset') {
      t.fase = 'foco'
      t.restante = t.focusSec
      t.rodando = false
      for (const j of sala.jogadores.values()) j.focoValido = false
      anunciar(sala, `${jogador.nome} zerou o relógio ↺`)
    } else {
      return
    }
    salvar()
    io.to(sala.codigo).emit('estado', estado(sala))
  })

  socket.on('config', (payload = {}) => {
    if (!sala || !jogador) return
    const t = sala.timer
    const foco = Number(payload.focusMin)
    const pausa = Number(payload.breakMin)
    if (Number.isFinite(foco)) t.focusSec = Math.round(Math.max(1, Math.min(120, foco)) * 60)
    if (Number.isFinite(pausa)) t.breakSec = Math.round(Math.max(1, Math.min(30, pausa)) * 60)
    // Mudou a duração: o sprint em andamento não vale mais.
    t.fase = 'foco'
    t.restante = t.focusSec
    t.rodando = false
    for (const j of sala.jogadores.values()) j.focoValido = false
    anunciar(sala, `${jogador.nome} ajustou: ${Math.round(t.focusSec / 60)}min foco · ${Math.round(t.breakSec / 60)}min pausa`)
    salvar()
    io.to(sala.codigo).emit('estado', estado(sala))
  })

  /* ── presença e conversa ── */

  socket.on('mural', (payload = {}) => {
    if (!sala || !jogador) return
    const texto = String(payload.texto || '').trim().slice(0, 200)
    if (!texto) return
    // A regra que define o produto: durante o foco rodando, o mural fecha.
    if (emFoco(sala)) {
      socket.emit('recusado', 'O mural abre na pausa. Volta pro monitor. 🐦')
      return
    }
    sala.mural.push({ tipo: 'fala', de: jogador.nome, deId: jogador.id, cor: jogador.crista, texto, ts: Date.now() })
    io.to(sala.codigo).emit('estado', estado(sala))
  })

  socket.on('recado', (payload = {}) => {
    if (!sala || !jogador) return
    const texto = String(payload.texto || '').trim().slice(0, 120)
    if (!texto) return
    sala.mural.push({ tipo: 'recado', de: jogador.nome, cor: jogador.crista, texto, ts: Date.now() })
    io.to(sala.codigo).emit('estado', estado(sala))
  })

  socket.on('emote', (payload = {}) => {
    if (!sala || !jogador) return
    const emoji = String(payload.emoji || '').slice(0, 4)
    if (!emoji) return
    io.to(sala.codigo).emit('emote', { id: jogador.id, emoji })
  })

  socket.on('mover', (payload = {}) => {
    if (!sala || !jogador) return
    if (emFoco(sala)) return // trabalhando não se anda nem se soca

    const acao = ['anda', 'bica', 'pula', 'soco'].includes(payload.acao) ? payload.acao : 'anda'
    const x = Number(payload.x)
    if (Number.isFinite(x)) jogador.posX = Math.max(0, Math.min(300, x))
    jogador.posDir = payload.dir === 1 ? 1 : -1

    if (acao === 'soco') {
      if (!Number.isFinite(jogador.posX)) return
      // O servidor decide quem apanha — senão cada cliente veria uma briga diferente.
      const vitimas = []
      for (const outro of sala.jogadores.values()) {
        if (outro === jogador || !outro.online || !Number.isFinite(outro.posX)) continue
        const dx = outro.posX - jogador.posX
        if (Math.abs(dx) > ALCANCE_SOCO) continue
        outro.posX = Math.max(0, Math.min(300, outro.posX + (dx >= 0 ? 1 : -1) * EMPURRAO_SOCO))
        vitimas.push({ id: outro.id, x: outro.posX })
      }
      io.to(sala.codigo).emit('soco', { id: jogador.id, x: jogador.posX, dir: jogador.posDir, vitimas })
      return
    }

    // Caminho quente (~8x/s por pombo andando): retransmite sem montar estado.
    socket.to(sala.codigo).emit('pos', { id: jogador.id, x: jogador.posX, dir: jogador.posDir, acao })
  })

  socket.on('disconnect', () => {
    if (!sala || !jogador) return
    if (jogador.socketId === socket.id) {
      jogador.online = false
      jogador.offlineDesde = Date.now()
    }
    io.to(sala.codigo).emit('estado', estado(sala))
  })
})

/* ─────────────────────────── batida do relógio ─────────────────────────── */

setInterval(() => {
  const agora = Date.now()

  for (const sala of salas.values()) {
    for (const j of sala.jogadores.values()) {
      if (!j.online && agora - j.offlineDesde > TOLERANCIA_QUEDA_SEC * 1000) j.focoValido = false
    }

    const t = sala.timer
    if (!t.rodando) continue
    if (![...sala.jogadores.values()].some((j) => j.online)) continue // praça vazia congela

    t.restante -= 1
    if (t.restante > 0) continue

    if (t.fase === 'foco') {
      fecharSprint(sala)
      t.fase = 'pausa'
      t.restante = t.breakSec
    } else {
      t.fase = 'foco'
      t.restante = t.focusSec
      abrirSprint(sala)
    }
    io.to(sala.codigo).emit('estado', estado(sala))
  }
}, 1000)

function abrirSprint(sala) {
  for (const j of sala.jogadores.values()) {
    j.focoValido = j.online
  }
}

function fecharSprint(sala) {
  // O bando é quem atravessou o foco junto. Quem já bateu o teto diário
  // continua contando pro bônus dos outros — só não leva migalha.
  const concluiram = [...sala.jogadores.values()].filter((j) => j.focoValido && j.online)
  const bando = Math.min(Math.max(concluiram.length - 1, 0), MAX_AMIGOS_BONUS)
  const ganho = BASE_MIGALHAS + BONUS_POR_AMIGO * bando
  const premiados = concluiram.filter((j) => j.sprintsHoje < MAX_SPRINTS_DIA)

  for (const j of premiados) {
    if (j.dia !== chaveDoDia()) {
      j.dia = chaveDoDia()
      j.sprintsHoje = 0
    }
    j.migalhas += ganho
    j.sprints += 1
    j.sprintsHoje += 1
    j.focoValido = false
    if (j.socketId) {
      io.to(j.socketId).emit('creditado', {
        ganho,
        base: BASE_MIGALHAS,
        bando,
        total: j.migalhas,
        restamHoje: MAX_SPRINTS_DIA - j.sprintsHoje,
      })
    }
  }

  for (const j of sala.jogadores.values()) j.focoValido = false

  if (premiados.length > 0) {
    const nomes = premiados.map((j) => j.nome).join(', ')
    anunciar(
      sala,
      premiados.length === 1
        ? `${nomes} fechou o sprint · +${ganho} 🍞`
        : `${nomes} fecharam o sprint juntos · +${ganho} 🍞 cada (bando de ${concluiram.length})`
    )
    salvar()
  }
}

carregar()
http.listen(PORT, () => {
  console.log(`\n  🐦  Pombodoro voando em http://localhost:${PORT}\n`)
})
