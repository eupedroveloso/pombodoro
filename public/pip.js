/* Picture-in-Picture do cronômetro + notificações de virada de fase.

   Divisão de trabalho: o app.js é o dono do relógio (extrapolação sobre o
   relógio do servidor, via deltaRelogio) e do estado (fase, rodando, tarefa
   marcada no mural). Este módulo só APRESENTA: recebe um obterEstado() na
   inicialização e desenha a janelinha a partir dele. Nenhum cálculo de
   tempo nasce aqui — zero risco de dois relógios discordarem.

   Dois caminhos, do mais rico pro fallback:
   - Document PiP (Chrome/Edge 116+): janelinha sempre-visível com HTML de
     verdade, mesma origem da página — dá pra linkar o style.css, usar a
     Press Start 2P e os ícones pixel art do icones.js. Como aceita cliques,
     ela carrega controles: play/pausa, zerar e −/+ de duração (foco e
     pausa), que agem no relógio do modo ativo — sala ou sprint solo — via
     os callbacks `acoes` que o app.js entrega na inicialização.
   - Vídeo PiP (Safari): cronômetro desenhado num canvas → captureStream()
     → <video> escondido → requestPictureInPicture(). Só imagem, sem HTML,
     mas cumpre o papel de "relógio flutuante".
   - Firefox não expõe nenhuma das duas APIs pra página (o PiP de lá é só o
     controle nativo do usuário sobre vídeos): o botão fica desabilitado
     com o motivo no title.

   Por que a janelinha NÃO abre sozinha quando você sai da aba: todo
   navegador exige gesto do usuário pra entrar em PiP (anti-abuso — senão
   qualquer site abriria janelinhas por conta própria). O caminho honesto:
   (a) o usuário abre uma vez e a janelinha PERSISTE ao trocar de aba —
       esse é o fluxo principal ("abra uma vez e ela te acompanha");
   (b) registramos o action handler 'enterpictureinpicture' da Media
       Session, que habilita o auto-PiP do Chrome (abrir sozinho ao sair da
       aba) nos casos em que o próprio navegador julga o site elegível;
   (c) voltar pra aba NÃO fecha a janelinha — fechar é decisão do usuário,
       no X dela ou no botão. */

import { iconeDataURI, iconeHtml } from './icones.js'

/* ─── helpers puros (exportados pra teste sem navegador) ───── */

/** mm:ss no mesmo formato do relógio grande; null/indefinido vira "--:--". */
export function formatarRestante(seg) {
  if (!Number.isFinite(seg)) return '--:--'
  const s = Math.max(0, Math.floor(seg))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Texto da notificação pela fase que ENTROU (sem emoji — UI é pixel art). */
export function textoViradaDeFase(faseNova) {
  return faseNova === 'pausa'
    ? 'Sprint concluído! Hora do café na praça.'
    : 'A pausa acabou — de volta ao foco.'
}

/** Só notifica se o usuário não está vendo o relógio grande: aba oculta ou
    acompanhando pela janelinha. Aba visível e sem PiP = já está na tela. */
export function deveNotificar({ permissao, abaVisivel, pipAberto }) {
  if (permissao !== 'granted') return false
  return !abaVisivel || pipAberto
}

/* ─── estado do módulo ─────────────────────────────────────── */

let obterEstado = () => null
let acoes = null // { playPause, reset, duracao(alvo, delta) } — gestos do app.js, modo-cientes
let botao = null
let timerPip = null // atualização de 250ms, só enquanto a janelinha existe

/* Document PiP */
let pipJanela = null
let pipEls = null // { fase, relogio, tarefa } dentro do documento da janelinha

/* Fallback por vídeo */
let fbCanvas = null
let fbCtx = null
let fbVideo = null
let fbAtivo = false

const TITULO_ABRIR = 'Cronômetro flutuante (Picture-in-Picture) — abra uma vez e ela te acompanha quando você sair da aba'
const TITULO_FECHAR = 'Fechar o cronômetro flutuante'

function pipAberto() {
  return Boolean(pipJanela) || fbAtivo
}

/* ─── API pro app.js ───────────────────────────────────────── */

/**
 * @param opcoes.botao   o #btnPip do header
 * @param opcoes.obterEstado () => null | { restante, fase, rodando, tarefa, solo, focusSec, breakSec }
 * @param opcoes.acoes  { playPause, reset, duracao(alvo, delta) } — controles
 *                      dentro da janelinha; agem no modo ativo (sala ou solo)
 */
export function iniciarPip(opcoes) {
  obterEstado = opcoes.obterEstado
  acoes = opcoes.acoes || null
  botao = opcoes.botao
  botao.title = TITULO_ABRIR

  const temDocPip = 'documentPictureInPicture' in window
  const temVideoPip =
    'pictureInPictureEnabled' in document || 'webkitSetPresentationMode' in HTMLVideoElement.prototype

  if (!temDocPip && !temVideoPip) {
    botao.disabled = true
    botao.title = 'Seu navegador não tem Picture-in-Picture'
    return
  }

  botao.onclick = async () => {
    if (pipAberto()) {
      fecharPip()
      return
    }
    // Sem await: requestWindow()/requestPictureInPicture() precisam receber
    // o gesto do clique ainda vivo — esperar o prompt de notificação
    // consumiria a ativação e o navegador negaria o PiP.
    pedirPermissaoNotificacao()
    try {
      await abrirPip(temDocPip)
    } catch {
      // usuário cancelou o prompt do navegador (ou política negou) — sem drama
    }
  }

  // Auto-PiP do Chrome: com este handler registrado, o navegador PODE abrir
  // a janelinha sozinho ao sair da aba (decisão dele, não nossa — ver
  // comentário no topo). setActionHandler lança em navegadores que ainda
  // não conhecem essa ação, daí o try.
  try {
    navigator.mediaSession?.setActionHandler('enterpictureinpicture', () => {
      if (!pipAberto()) abrirPip(temDocPip).catch(() => {})
    })
  } catch {
    // ação desconhecida neste navegador — segue sem auto-PiP
  }
}

/** Chamado pelo app.js a cada 'estado' do socket — o ponto único onde a
    fase pode ter virado. Notifica na virada e redesenha a janelinha já. */
export function avisarPip(anterior, s) {
  if (anterior && s && anterior.fase !== s.fase) notificarViradaDeFase(s.fase)
  if (pipAberto()) atualizarPip()
}

/* ─── abrir / fechar ───────────────────────────────────────── */

async function abrirPip(usarDocPip) {
  if (usarDocPip) await abrirDocumentPip()
  else await abrirVideoPip()
  if (!timerPip) timerPip = setInterval(atualizarPip, 250)
  botao.classList.add('ativo')
  botao.title = TITULO_FECHAR
  atualizarPip()
}

function fecharPip() {
  // O resto da limpeza acontece nos eventos de fechamento (pagehide /
  // leavepictureinpicture) — mesmo caminho de quando o usuário fecha no X.
  if (pipJanela) pipJanela.close()
  if (fbAtivo) {
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {})
    else fbVideo?.webkitSetPresentationMode?.('inline')
  }
}

/** Janelinha fechou (pelo X, pelo botão ou porque a página saiu):
    devolve o botão ao estado normal e para a atualização. */
function aoFecharPip() {
  pipJanela = null
  pipEls = null
  fbAtivo = false
  fbVideo?.pause()
  clearInterval(timerPip)
  timerPip = null
  if (botao) {
    botao.classList.remove('ativo')
    botao.title = TITULO_ABRIR
  }
}

/* ─── caminho principal: Document PiP ──────────────────────── */

/* Janelinha COMPACTA e discreta (~240×140): fundo escuro quase opaco, o
   pombo vira só um "favicon" interno de 16px, o cronômetro domina mas em
   corpo menor, a tarefa é uma linha com ellipsis — e os controles moram
   dentro dela (Document PiP aceita cliques em HTML normal). */
const CSS_PIP = `
  body { display: flex; align-items: center; justify-content: center; background: #0c0c16; }
  .pip-raiz { display: flex; flex-direction: column; gap: 7px; padding: 9px 11px; width: 100%; min-width: 0; }
  .pip-linha { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .pip-topo .pill { font-size: 7px; padding: 3px 6px; letter-spacing: .08em; white-space: nowrap; }
  .pip-tarefa {
    flex: 1; min-width: 0; text-align: right;
    font-family: 'Press Start 2P', ui-monospace, monospace;
    font-size: 7px; color: #8f8fa3;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pip-relogio { font-size: 26px; margin-left: auto; }
  .pip-raiz button { min-width: 0; padding: 5px 8px; font-size: 10px; line-height: 1; }
  .pip-duracoes {
    justify-content: space-between; gap: 4px;
    font-family: 'Press Start 2P', ui-monospace, monospace;
    font-size: 7px; color: #8686a0; text-transform: uppercase;
  }
  .pip-dur { display: flex; align-items: center; gap: 3px; white-space: nowrap; }
  .pip-dur b { color: #f2f0e8; min-width: 26px; text-align: center; font-variant-numeric: tabular-nums; }
  .pip-dur button { padding: 3px 6px; font-size: 9px; }
`

async function abrirDocumentPip() {
  const win = await window.documentPictureInPicture.requestWindow({ width: 240, height: 140 })
  pipJanela = win

  // A janela PiP nasce com documento vazio, mas compartilha a origem da
  // página — o jeito recomendado pela API é copiar os estilos de cá pra lá.
  // Clonar os <link>/<style> traz o style.css e a Press Start 2P juntos.
  for (const el of document.querySelectorAll('link[rel="stylesheet"], style')) {
    win.document.head.append(el.cloneNode(true))
  }
  win.document.head.insertAdjacentHTML('beforeend', `<style>${CSS_PIP}</style>`)

  // Mesmas classes do relógio grande (.pill, .relogio-grande): a janelinha
  // é a versão de bolso do header, não um design paralelo.
  win.document.body.innerHTML = `
    <div class="pip-raiz">
      <div class="pip-linha pip-topo">
        ${iconeHtml('pombo', 16)}
        <span id="pipFase" class="pill parado">—</span>
        <span id="pipTarefa" class="pip-tarefa">sem tarefa marcada</span>
      </div>
      <div class="pip-linha">
        <button type="button" id="pipPlay" data-st="play" title="Continuar">${iconeHtml('play', 12)}</button>
        <button type="button" id="pipReset" class="ghost" title="Zerar">↺</button>
        <strong id="pipRelogio" class="relogio-grande pip-relogio">--:--</strong>
      </div>
      <div class="pip-linha pip-duracoes">
        <span class="pip-dur">foco <button type="button" class="ghost" data-d="foco:-5" title="Foco −5min">−</button><b id="pipFoco">--</b><button type="button" class="ghost" data-d="foco:5" title="Foco +5min">+</button></span>
        <span class="pip-dur">pausa <button type="button" class="ghost" data-d="pausa:-5" title="Pausa −5min">−</button><b id="pipPausa">--</b><button type="button" class="ghost" data-d="pausa:5" title="Pausa +5min">+</button></span>
      </div>
    </div>`
  pipEls = {
    fase: win.document.getElementById('pipFase'),
    relogio: win.document.getElementById('pipRelogio'),
    tarefa: win.document.getElementById('pipTarefa'),
    play: win.document.getElementById('pipPlay'),
    foco: win.document.getElementById('pipFoco'),
    pausa: win.document.getElementById('pipPausa'),
  }

  // Controles: mesmos gestos do header, no relógio do modo ativo (o app.js
  // decide se vão pro timer da sala ou pro sprint solo).
  pipEls.play.onclick = () => acoes?.playPause?.()
  win.document.getElementById('pipReset').onclick = () => acoes?.reset?.()
  for (const b of win.document.querySelectorAll('button[data-d]')) {
    const [alvo, delta] = b.dataset.d.split(':')
    b.onclick = () => acoes?.duracao?.(alvo, Number(delta))
  }

  // 'pagehide' dispara quando a janelinha fecha — pelo X dela ou via close().
  win.addEventListener('pagehide', aoFecharPip)
}

/* ─── fallback: canvas → vídeo → PiP clássico ──────────────── */

async function abrirVideoPip() {
  if (!fbCanvas) {
    fbCanvas = document.createElement('canvas')
    // Proporcional à janelinha compacta do Document PiP (~240×140).
    fbCanvas.width = 240
    fbCanvas.height = 140
    fbCtx = fbCanvas.getContext('2d')
  }
  desenharFallback(obterEstado()) // o stream só emite quadro se o canvas já pintou

  if (!fbVideo) {
    fbVideo = document.createElement('video')
    fbVideo.muted = true
    fbVideo.playsInline = true
    fbVideo.setAttribute('aria-hidden', 'true')
    // display:none congelaria o stream em alguns navegadores — esconde fora da tela.
    fbVideo.style.cssText = 'position:fixed;left:-9999px;bottom:0;width:240px;height:140px;'
    fbVideo.srcObject = fbCanvas.captureStream()
    fbVideo.addEventListener('leavepictureinpicture', aoFecharPip)
    // Safari antigo sinaliza pelo modo de apresentação, não pelo evento padrão.
    fbVideo.addEventListener('webkitpresentationmodechanged', () => {
      if (fbAtivo && fbVideo.webkitPresentationMode === 'inline') aoFecharPip()
    })
    document.body.append(fbVideo)
  }

  await fbVideo.play()
  if (fbVideo.readyState < 1) {
    await new Promise((r) => fbVideo.addEventListener('loadedmetadata', r, { once: true }))
  }
  if (fbVideo.requestPictureInPicture) await fbVideo.requestPictureInPicture()
  else fbVideo.webkitSetPresentationMode('picture-in-picture')
  fbAtivo = true
}

/** Rótulo da fase, com o indicativo de sprint solo na frente. */
function rotuloFase(e) {
  if (!e) return '—'
  const fase = e.fase === 'foco' ? 'FOCO' : 'MIGALHA'
  return e.solo ? `SOLO · ${fase}` : fase
}

function desenharFallback(e) {
  const ctx = fbCtx
  const W = fbCanvas.width
  const H = fbCanvas.height
  const corFase = !e || !e.rodando ? '#55556a' : e.fase === 'pausa' ? '#7ed957' : '#e0405a'
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#0c0c16'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = corFase
  ctx.fillRect(0, 0, W, 6)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '9px "Press Start 2P", ui-monospace, monospace'
  ctx.fillText(rotuloFase(e), W / 2, 32)
  ctx.fillStyle = '#f2f0e8'
  ctx.font = '24px "Press Start 2P", ui-monospace, monospace'
  ctx.fillText(formatarRestante(e?.restante), W / 2, 72)
  ctx.fillStyle = '#8f8fa3'
  ctx.font = '7px "Press Start 2P", ui-monospace, monospace'
  const tarefa = e?.tarefa || 'sem tarefa marcada'
  ctx.fillText(tarefa.length > 30 ? `${tarefa.slice(0, 29)}…` : tarefa, W / 2, 116)
}

/* ─── atualização (250ms + imediato na virada de fase) ─────── */

function atualizarPip() {
  const e = obterEstado()
  if (pipEls) {
    pipEls.relogio.textContent = formatarRestante(e?.restante)
    pipEls.fase.textContent = rotuloFase(e)
    pipEls.fase.classList.toggle('pausa', e?.fase === 'pausa')
    pipEls.fase.classList.toggle('parado', !e?.rodando)
    pipEls.fase.classList.toggle('solo', Boolean(e?.solo))
    pipEls.tarefa.textContent = e?.tarefa || 'sem tarefa marcada'
    // Ícone do play/pausa só re-renderiza quando o estado muda.
    const st = e?.rodando ? 'pausa' : 'play'
    if (pipEls.play.dataset.st !== st) {
      pipEls.play.dataset.st = st
      pipEls.play.innerHTML = iconeHtml(st, 12)
      pipEls.play.title = e?.rodando ? 'Pausar' : 'Continuar'
    }
    pipEls.foco.textContent = e ? `${Math.round(e.focusSec / 60)}m` : '--'
    pipEls.pausa.textContent = e ? `${Math.round(e.breakSec / 60)}m` : '--'
  }
  if (fbAtivo) desenharFallback(e)
}

/* ─── notificações de fim de sprint ────────────────────────── */

function pedirPermissaoNotificacao() {
  if (typeof Notification === 'undefined') return
  // 'default' = nunca respondeu; só aí faz sentido perguntar.
  // 'denied' é resposta: pedir de novo é insistência, não UX.
  if (Notification.permission === 'default') Notification.requestPermission().catch(() => {})
}

function notificarViradaDeFase(faseNova) {
  if (typeof Notification === 'undefined') return
  const pode = deveNotificar({
    permissao: Notification.permission,
    abaVisivel: document.visibilityState === 'visible',
    pipAberto: pipAberto(),
  })
  if (!pode) return
  const n = new Notification('Pombodoro', {
    body: textoViradaDeFase(faseNova),
    icon: iconeDataURI('pombo'),
    tag: 'pombodoro-fase', // tag fixa: a virada nova substitui a anterior, sem empilhar
  })
  n.onclick = () => {
    window.focus() // clicou = quer voltar pra praça
    n.close()
  }
}
