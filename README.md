# 🐦 Pombodoro

**A praça onde os pombos trabalham.** Pomodoro coletivo em pixel art — sprints
sincronizados e migalhas por foco.

## Rodar

```bash
npm install
npm start          # http://localhost:3000
```

A primeira visita cria uma praça nova e põe o código na URL (`/r/ABC12`).
O botão **Copiar convite** manda esse link pros amigos — é só isso, não tem cadastro.

## Testar sozinho

```bash
node bots.js TESTE 4     # 4 pombos de mentira pousam na praça TESTE
node teste.js            # teste de ponta a ponta da pontuação (~3 min)
node preview.js out.png  # renderiza a cena num PNG, sem abrir o navegador
node preview.js out.png pausa
```

No app, arraste o slider de foco pra **1min** e dê o play: dá pra ver um ciclo
inteiro sem esperar meia hora. (Os bots fazem isso sozinhos ao entrar.)

## As regras

| | |
|---|---|
| Sprint completo | **10 migalhas** |
| Sprint abandonado | **0** — não existe crédito parcial |
| Teto diário | 8 sprints pontuados (4h de foco de verdade) |

**Durante o foco rodando o mural fica trancado.** Só emotes passam. É a regra
que separa o Pombodoro de "mais um Discord com timer": a pausa vira o café do
escritório, sincronizado, e todo mundo aparece ao mesmo tempo.

**O cronômetro é da sala.** Qualquer pombo presente dá play, pausa, zera e
ajusta a duração nos sliders (foco 1–60min, pausa 1–30min). Mudar a duração
zera o sprint em andamento. Quem entra com o sprint já rolando não pontua
naquele sprint — pontua no próximo.

**Anti-trapaça é de leve**, é entre amigos: só invalida o sprint se a conexão
cair por mais de 2 minutos. Trocar de aba não conta — você *tem* que trabalhar
em outro lugar.

**Na pausa a praça vira playground:** `A/D` anda, `W` voa (batendo asa),
`S` bica o chão, `E` dá um soco no pombo mais próximo — que fica tonto, sai
voando de empurrão e vê estrelinha. O chat aparece como balão de fala em cima
do pombo de quem falou. Nada disso funciona durante o foco: pombo focado é
pombo sentado.

## Como é feito

```
server.js         Express + Socket.io. Autoridade sobre fase e pontuação.
public/sprites.js Pixel art como mapa de caracteres + cache de canvas.
public/cena.js    Render em canvas lógico 190×64, ampliado por fator inteiro.
public/app.js     Socket, painéis, relógio local.
data.json         Placar (criado sozinho).
```

O timer não trafega a cada segundo: o servidor manda o próprio relógio junto
com o estado, o cliente calcula o offset e conta sozinho. Só há emissão quando
a fase vira.

As posições dos pombos na pausa são calculadas **no cliente** — cada um vê um
passeio diferente e ninguém precisa sincronizar isso. Só presença e fase são
autoritativas.

## Roadmap

- [x] **v0** — praça por link, timer do relógio, presença, migalhas, mural, pombo-correio
- [ ] **v1** — rádio da praça (fila colaborativa de YouTube, round-robin, skip por votação)
- [ ] **v2** — streak diário, placar semanal (reseta segunda), meta de bando
- [ ] **v3** — loja de chapéus e skins
- [ ] **v4** — bot do Slack postando o placar da semana

### Sobre o rádio (v1)

Um player por cliente, servidor guarda `{videoId, startedAt}`, cada cliente faz
seek e corrige drift. Três armadilhas conhecidas:

1. Muito vídeo tem embed bloqueado → validar via oEmbed **antes** de aceitar na fila
2. Autoplay no mobile exige gesto → o botão "pousar na praça" faz esse papel
3. O player precisa ficar visível (esconder num 1×1 fere o ToS) → vira o radinho
   de um pombo DJ no canto da cena
