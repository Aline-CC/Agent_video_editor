# Contexto · campanha Black Friday 2026

Leia antes de mexer em qualquer projeto `black-*` (junto com o `regras.md` desta pasta). Atualize o **Estado** ao entregar
uma versão: é o que a próxima sessão lê.

## A campanha

- **Oferta:** acesso vitalício (plano "acesso total") a todos os cursos, os lançados e os que ainda vão sair, com bônus
  exclusivos de Black Friday. A condição só é revelada na **live de 10/11 (10 de novembro), às 19h**.
- **CTA:** cadastro na página `alinefreitas.cc/black-friday` (formulário "não leva nem 10 segundos"); depois do cadastro,
  o ingresso da live (`/black-friday/ingresso`, "Sua inscrição está confirmada").
- **Os 6 cursos** (coleção "Black 26", caixas 3D): Formação Artista IA, Retoque de Pele (High End), Color Grading,
  Retoque de Produto, Pós de CGI, Photoshop Starter.
- **Números:** a bio do Instagram diz **+4.000 alunos**; nos vídeos a fala diz "mais de três mil" (black-v4) e "quatro
  mil" (black-cadastro). Não troque o número na tela sem a criadora decidir.
- **Prova de mercado:** +20 anos com publicidade (Netflix, Samsung, Coca-Cola, Honda, Boticário/make B, Iguatemi).
  Portfólio: `alinefreitascc.myportfolio.com` (`/videos`, vídeos em no máximo 720p; `/fusoes`, imagens).

## Mídias no banco (as de sempre)

`banco.py buscar black` e `buscar portfólio`. As principais:
- Página e ingresso: `1ac3f4cbd9` (cadastro, em pé), `c3ac0b7ffa` (cadastro, metade de cima), `3f40467c14` (ingresso).
- Cursos: `b1bb1216c3` (as 6 caixas juntas), uma caixa por curso (`3a8727e6ac`, `efb762c814`, `cad0138213`, `3c2cf07a99`,
  `9982e9a676`, `fb4df5570c`), os 6 deslizando (`35a7a02e74`, `504d100031`, `af9eff0ced`).
- Peças da campanha: stories `a907688534` e `54a86e53ea`, contagem `3e42e8e667`, posts `175007481d` e `2e98b701dc`,
  estático `eb6c2a396e`.
- Portfólio: Honda HR-V `fcd137791d` e `30ccb36461`, make B `860cbb32fb`, fusões em pé (`f6a13619ac`, `54afb7b5b6`,
  `9d217c0521`, `18c2bc3ad7`, `3f55274762`).
- Instagram com "+4.000 alunos" marcado em rosa: `50156a4f79` (gravado em 2026-10-20 no Chrome dela).

## O visual da campanha

- **Fundo e vinheta do PRE-39** em todo plano em que ela aparece em tela cheia: o fundo escurecido, ela com o brilho
  dela, a vinheta no quadro todo (pedido no black-v4, v9).
- **Texto gigante atrás dela** (recortada) + texto menor na frente, branco, entrando desfocado. Ex.: "10/11" atrás e "às
  19h" na frente; "pra" atrás e "sempre" na frente; "+20 anos". O de trás tem que ser lido inteiro: o topo a ~5% da tela
  (no black-v2 v11 ela pediu para subir), o cabelo passando só na base dele.
- A legenda das palavras que viram texto fica muda (`legenda.ajustes` com `texto: ""`).
- Inserts com movimento: zoom lento do centro (`camera: "Leve"` no Corte seco), como nos CTAs, **nunca deslizando rápido
  para o lado**.
- Fechamento: assinatura alinefreitas.cc (fundo preto, fade).

### Esses efeitos não estão no render

O render (`render.py`) ainda não faz o texto atrás dela nem o fundo do PRE-39: eles são aplicados **sobre o proxy, depois
de cada render**, na ordem abaixo, rodando da raiz do repositório. Se você renderizar e não reaplicar, eles somem da
versão.

```bash
W="--with mediapipe --with numpy --with opencv-python-headless --with pillow"
X=biblioteca/presets/efeitos/scripts
V=projetos/<slug>/versoes/vN          # o script lê palavras.json e planos.json da mesma pasta: o vídeo tem que ser proxy.mp4
cp $V/proxy.mp4 /tmp/limpo.mp4        # guarde o limpo para poder refazer
uv run -q $=W python $X/pre39_fundo.py $V/proxy.mp4 /tmp/a.mp4 && mv /tmp/a.mp4 $V/proxy.mp4          # só o black-v4 por enquanto
Y_A=0.05 ESCURO=1.0 uv run -q $=W python $X/texto_atras.py $V/proxy.mp4 /tmp/b.mp4 <w_atrás> <w_frente> "<atrás>" "<frente>" [y_frente] [tam_atrás=272] [tam_frente=150] && mv /tmp/b.mp4 $V/proxy.mp4
cp $V/proxy.mp4 projetos/<slug>/previa.mp4
```

`ESCURO=1.0` quando o PRE-39 já escureceu o fundo; sem ele, o texto escurece o fundo do plano para 0,82. Os textos de
cada vídeo:
- **black-v2:** `Y_A=0.05 … w00161 w00163 "10/11" "às 19h" "" 300` e depois `Y_A=0.10 … w00184 w00185 "pra" "sempre" 0.79 170 240` ("pra" menor e "sempre" maior, pedido da v11).
- **black-v3:** `w00279 w00280 "chegou" "a hora" "" 280` (padrões de resto).
- **black-v4:** nenhum desde a v12 (ela pediu para tirar o fundo PRE-39 e o "+20 anos").
- **black-v5 a v8** (bruto `video_1792520953698.MP4`, um preparo só, copiado): `Y_A=0.05 … <w_10> <w_às> "10/11" "às 19h" "" 300`,
  com v5 `w00136 w00140`, v6 `w00237 w00241`, v7 `w00516 w00520`, v8 `w00643 w00646`.

## Estado (2026-10-21)

**Sincronia:** o bruto do iPhone tem o áudio começando ~0,05 s depois da imagem e a voz limpa perdia esse começo (voz
adiantada). Corrigido em `voz.py` (próximos projetos) e nas vozes dos black-v2/v3/v4 e cadastro. Outros projetos com o
mesmo atraso, não mexidos: 3-coisas-fai (50 ms), reel-referencia (76 ms), ficha-personagem-ia (31 ms).

| Projeto | O que é | Última | Situação |
|---|---|---|---|
| black-v2 | "já é aluno" (22 s) | v14 | a revisar (revisão geral de 2026-10-22: materiais a 24 q/s, zoom suave embutido, site em "todos os cursos", Color Grading igual, Brilho branco suave, legenda) |
| black-v3 | "esperando desconto" (17 s) | v14 | a revisar (revisão geral de 2026-10-22: materiais a 24 q/s, zoom suave embutido, site em "todos os cursos", Color Grading igual, Brilho branco suave, legenda) |
| black-v4 | "20 anos" (41 s) | v14 | a revisar (revisão geral de 2026-10-22: materiais a 24 q/s, zoom suave embutido, site em "todos os cursos", Color Grading igual, Brilho branco suave, legenda) |
| black-ultimas-horas | "últimas horas" (14 s, bruto IMG_2475.MOV) | v1 | a revisar |
| black-ultimo-dia | "último dia" (13 s, o mesmo bruto; abre com a frase do fim, cortes com `ordem` e palavras renumeradas na ordem da saída) | v1 | a revisar |
| black-v1-laptop | laptop, sem fala (10 s) | v4 | a revisar: sem teclado, com Piano pulsante (feita à mão: o vídeo da v3 + a trilha a −14 LUFS) |
| black-v5 | "preço do acesso total" (42 s) | v7 | a revisar (revisão geral de 2026-10-22: materiais a 24 q/s, zoom suave embutido, site em "todos os cursos", Color Grading igual, Brilho branco suave, legenda) |
| black-v6 | "vai ter Black Friday" (47 s) | v7 | a revisar (revisão geral de 2026-10-22: materiais a 24 q/s, zoom suave embutido, site em "todos os cursos", Color Grading igual, Brilho branco suave, legenda) |
| black-v7 | "acesso vitalício" (42 s) | v7 | a revisar (revisão geral de 2026-10-22: materiais a 24 q/s, zoom suave embutido, site em "todos os cursos", Color Grading igual, Brilho branco suave, legenda) |
| black-v8 | "acesse pra sempre" (34 s) | v13 | a revisar (revisão geral de 2026-10-22: materiais a 24 q/s, zoom suave embutido, site em "todos os cursos", Color Grading igual, Brilho branco suave, legenda) |
| black-cadastro | página de cadastro, **16:9** (1:55) | v10 | **aprovada**; final 4K em `final/` ("… v10 …"; o arquivo sem "v10" é o da v8). (v10: as trocas de tela presas ao quadro exato dos cortes da fala (antes, 1–3 quadros desencontrados); o destaque no celular de leve; a cascata dos alunos termina em "E com acesso total", onde entra o site com as capas; a Aula 8 certa (a7) virou o fluxo; nada recomeça no meio do trecho. v9: sem a legenda pequena; o pack parado, sem tremer; o celular com o Instagram e o destaque nos alunos; "trabalho de alunos" com as 35 imagens em cascata (PRE-08); sem o insert do delineado; a moldura em um curso por vez, com o botão por cima; a Aula 8 virou o fluxo (montagem/membros.py)). A v8 tinha sido **aprovada**, com o final em `final/` (4K 16:9, HEVC, a montagem a CRF 6 ampliada de 1080p; refazer: `CRF=6 AB=320k montagem.py v5 …` e o ffmpeg de 4K). (v8: o Instagram num card pequeno ao lado dela, com o movimento do PRE-02, e todos os zooms contínuos (subpixel; antes andavam aos degraus). v7: o pack das 6 caixas embaixo de "uma condição exclusiva", o Instagram com foco no "+4.000 alunos" em "4 mil alunos", o vídeo novo de nitidez na tela toda. v6: cor da LUT aprovada nela, Boticário, volume/nitidez/antes-depois, vídeo do curso de CGI, capas inteiras, só ela no "formulário do lado", assinatura no fim. v5 = a regravação em pé que ela mandou na v4; a 1ª gravação, horizontal, está em `gravacao1/` e a v4, que ela elogiou, em `montagem/montagem_v4.py`). Montado fora do editor: `projetos/black-cadastro/montagem/` (`fala.py vN <saída>` faz o corte da fala com o áudio do render; `montagem.py vN <saída> montagem/fala_9x16.mp4` monta tudo, trocas presas às palavras; materiais em `montagem/materiais/`). Para uma v6: edite `montagem.py`, rode `render.py` (base 9:16: palavras + áudio), `fala.py`, `montagem.py` e copie para `versoes/vN/proxy.mp4` e `previa.mp4`. A transcrição foi refeita trecho a trecho (os tempos da inteira escorregavam até 1,5 s) e teve a grafia corrigida |

**Transcrição:** sem ElevenLabs (ela não paga transcrição): o preparar usa o whisper local (`transcricao.transcrever_local`).
Nos v5–v8, onde a fala cita cursos e aulas entra o **material real das aulas** (pedido de 2026-10-21, os mesmos do
vídeo de apresentação, agora no banco): Formação → fluxo do Space `24bf359ab9` e UGC + fluxo Chronos; Retoque → pele
`a415c332ac`, volume `08d88dedeb`, nitidez `20000a9555`, make `54f8ba8516`; Color → trechos do vídeo do curso
(`a56bae40f1` rua, `86694ca5e6` noite, `5444b8c6b1` paletas); Produto → 212 acelerado `a9c17ceb10`; CGI → `37e20ef368`;
cursos futuros → Photoshop GLOW acelerado `726679ec79`. Na tela dividida com `enriquecimento.altura: 0.5`. Nada de
caixas 3D, janelas PRE-32 nem thumbs para isso. Textos atrás: v5 também `w00149 w00150 "grande" "desconto"` e
`w00162 w00163 "bônus" "exclusivos"`; v6 `w00355 w00357 "bônus" "especiais"`; v7 `w00530 w00531 "bônus" "exclusivos"`;
v8 `w00685 w00686 "bônus" "inéditos"`.

**Uma sessão por vez nos vídeos Black.** Em 2026-10-20 duas sessões mexeram nos mesmos projetos e as versões se
cruzaram (v10/v11 de uma, v12 da outra). Antes de começar, veja a última versão e a data dela
(`ls -t projetos/black-*/versoes`); se alguém mexeu há pouco, pergunte à criadora.
