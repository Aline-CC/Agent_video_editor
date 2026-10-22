# Aprendizados · Inserts (busca, captura de tela, escolha da mídia)

O que já foi aprendido nesta área, vídeo a vídeo (como gravar: `etapas/14-concluir.md`). Leia antes de trabalhar nela
e não repita estes erros. **[gosto]** = preferência confirmada pelo criador · **[defeito]** = erro técnico.

## Do criador

- **[gosto] Legível no celular, antes de tudo.** O Reels é visto num celular: se o texto da mídia não dá para ler nesse
  tamanho, ela não serve. Recorte e amplie só a parte que importa (a janela, a linha do terminal, o trecho da página). _mvi-0717 · 2026-10-12_
- **[gosto] Uma cor de fundo só.** Muitos vídeos oficiais mostram uma janela pequena sobre um fundo colorido: recorte
  só a janela. A janela pequena sobre outra cor, dentro do nosso layout, fica com cara de amador. _mvi-0717 · 2026-10-12_
- **[gosto] O produto em ação vale mais que a página.** Alguém usando o app, o terminal rodando, o resultado
  aparecendo convencem mais que documentação, landing page ou tabela. Página só quando a fala cita a própria página
  (um anúncio, uma data, um preço). _mvi-0717 · 2026-10-12_
- **[gosto] Material atual.** Mostre a versão e as telas da geração atual do produto. Versão antiga (outro nome de
  modelo, interface velha) só se não houver outra, e com nota para o criador. _mvi-0717 · 2026-10-12_
- **[gosto] Fluxo do Magnific: gravar a tela.** Abra o Space e grave a tela passeando pelos nós, mostrando o fluxo
  completo e os modelos de geração (a lista de modelos aberta), acelerado para caber no trecho. _3-coisas-fai · 2026-10-14_
- **[gosto] Mesmo cenário e mesma modelo numa sequência.** As imagens de uma mesma sequência vêm do mesmo ensaio. _3-coisas-fai · 2026-10-14_
- **[gosto] Banco sem repetição.** No banco fica só a mídia inteira (a imagem ou o vídeo original); recorte, enquadramento e trecho são feitos na edição. _chat · 2026-10-18_
- **[gosto] Nome e tag.** O nome da mídia não leva o nome do projeto nem o número do plano; as criações levam a tag `criações/<produto>`. _chat · 2026-10-18_
- **[gosto] Gravação de edição (Photoshop e afins) preenche a área inteira, só com a imagem**, sem a interface cinza
  em volta, e acelerada para a edição aparecer até o fim. _black-v5 a v8 · 2026-10-22_
- **[gosto] O mesmo curso mostra o mesmo material em todos os vídeos da campanha** (ex.: o Color Grading sempre com o
  trecho das paletas). _revisão geral Black · 2026-10-22_

## Técnicos (do editor)

- **[técnica] Conferir o trecho inteiro.** Antes de entregar, olhe começo, meio e fim do trecho usado: nada de troca
  de cena, câmera indo para outra coisa, sobreposição do vídeo original (cronômetro, marca d'água, legenda) ou borda do
  fundo aparecendo. _mvi-0717 · 2026-10-12_
- **[técnica] Resolução sobrando.** Baixe sempre a maior resolução disponível e nunca amplie além do que a fonte
  tem. Julgue a nitidez no vídeo final em 4K, em tamanho real — a prévia de 720p esconde o borrado. Se a melhor fonte
  ainda fica borrada, grave a sua própria: rode a ferramenta de verdade (ex.: uma sessão real do terminal) e
  renderize em alta resolução. _mvi-0717 · 2026-10-12_
- **[técnica] O detalhe citado aparece grande.** Se a fala cita um detalhe (uma data, um preço, um número), o insert
  termina nesse detalhe, ampliado e legível. _mvi-0717 · 2026-10-12_
- Os inserts que já estão no banco voltam em ~20 s; os que pedem busca e captura, em 3 a 11 min. _1º teste · 2026-10-10_
- openai.com, claude.com, perplexity.ai, Gamma e Canva bloqueiam a captura (Cloudflare, "Um momento…"): vá para a doc
  oficial (developers.openai.com, docs.anthropic.com), o blog ou o model card do produto. _1º teste_
- Capturas começam em branco enquanto a página carrega: corte o começo com um trecho (`banco.py trecho`). _1º teste_
- Sites com WebGL pesado (esferas 3D) podem sair pretos na captura com a máquina carregada; um vídeo do banco curto
  demais pode virar câmera lenta (`ffmpeg -vf "setpts=PTS/0.42,minterpolate=fps=30:mi_mode=blend"`). _1º teste_
- Exemplos "do que não fazer" (site genérico, site poluído) são os mais difíceis de achar prontos: descreva na marcação
  um tipo concreto e achável (ex.: "a galeria de templates do Lovable"). Nunca monte um mockup sem dizer. _1º teste_
- Apague do banco o que foi capturado e não serviu (`banco.py apagar`): os subagentes deixavam lixo. _1º teste_
## Anúncios (CTAs) — só para anúncio; Reels têm outra lógica

- **[gosto]** Material já aprovado antes de qualquer outro: os Spaces, o fluxo live, o agente criador e o analisador das versões aprovadas. _cta-lp-ext·v1 c3; ficha-personagem-ia·v6.4 · 2026-10-15_
- **[gosto]** Gravação de fluxo devagar o bastante para ler; não acelere demais. _ficha-personagem-ia·v6.7, v6.9 · 2026-10-15_
- **[técnica]** Recorte a gravação de tela no que importa (no ChatGPT: a área de geração com a caixa de texto embaixo). _cta-lp-ext·v4 c3 · 2026-10-15_
- **[gosto]** Fala sobre conceito de foto (detalhes da pele, iluminação, composição, câmera): a série correspondente das aulas (a tenista em Câmera/Luz/Volume, o retrato em 3 iluminações). _cta-vsl-ext·v6 c2–c4, v8 c3–c5, v12 c2 · 2026-10-15_
- **[gosto]** Mídias do mesmo assunto juntas na mesma tela, não uma depois da outra (três vídeos empilhados com o rosto no meio; duas aulas, uma em cima e outra embaixo da legenda; 6 fotos numa página). _cta-vsl-ext·v6 c1, v12 c5, v14 c2 · 2026-10-15_
- **[gosto]** Fotos juntas numa página entram só como imagem, paradas, sem animação de motion. _cta-vsl-ext·chat · 2026-10-15_
- **[gosto]** Fala que cita ferramentas sem nome ("ferramentas gratuitas"): os logos delas (motion `logos-ferramentas`: ChatGPT, Gemini, Flow). _cta-vsl-ext·v10 c1 · 2026-10-15_
- **[gosto]** "Dar vida a uma ideia": o processo real, o antes e as referências (a modelo sem joia e as fotos da joia, do fluxo). _cta-vsl-ext·v6 c10 · 2026-10-15_
