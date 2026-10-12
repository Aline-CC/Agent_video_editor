# 04 · Inserts

Cada plano com insert (Insert tela cheia, Tela dividida · insert, Comentário + insert + ator) precisa de **mídia real**:
vídeos e imagens que mostrem o que a marcação pede. Você não busca nada no contexto principal: dispara **um subagente
por insert, todos de uma vez, em segundo plano** (modelo `sonnet`), e segue para outras etapas enquanto eles trabalham.

> **Antes de começar, leia `../aprendizados/inserts.md` (e mande cada subagente ler também)**: o que o criador já corrigiu em vídeos anteriores. Não repita esses erros.

## Rodar

```bash
uv run ferramentas/inserts.py listar <slug>      # cada pedido: id, formato, tempo, duração, fala, marcação, mídias
# … subagentes gravam projetos/<slug>/inserts/<plano>.json …
uv run ferramentas/inserts.py juntar <slug>      # liga as mídias achadas a cada pedido
```

## De onde vem a mídia (nesta ordem)

1. **Materiais do criador** (`projetos/<slug>/apoio/`): se servem, use-os (suba ao banco).
2. **O banco** (`banco.py buscar "<termos>"`): mídias já usadas em outros vídeos, com descrição, fonte e selo. Prefira
   as **★ usado em vídeo aprovado** e as **✓ aprovado** (o criador já gostou delas); evite as **✗ recusado** (ficaram de
   fora de um vídeo aprovado).
3. **Captura do site real** (`captura.py <url>`), quando a fala cita um site, ferramenta, produto ou repositório: grava
   a página rolando/carregando, como ela é. 16:9 para tela dividida; 9:16 (um computador em pé) para tela cheia.
4. **Web, fontes oficiais**: o site, o blog, o changelog, o X ou o YouTube **do próprio produto** (vídeo: `yt-dlp` só do
   trecho útil; imagem: o arquivo original). Nunca o rosto de outro criador de conteúdo; nunca vídeo de outro criador.
   Registre a URL de cada mídia.
5. Nada real serve: diga no resultado; você decide depois entre um motion e trocar o plano para Full ator.

Sem imagem gerada por IA (o criador não pediu).

## O subagente (um por pedido)

Mande, para cada pedido, este prompt preenchido (Agent, `subagent_type: general-purpose`, `model: sonnet`,
`run_in_background: true`):

```text
Você busca a mídia de UM insert de um Reels. Repositório: <raiz>. Rode os scripts com `uv run ferramentas/<x>.py`.
Projeto: <slug>. Insert <plano> · <tipo> · formato <vertical|dividida> · <duração> s.
Fala: "<fala do bloco>"
O que deve aparecer (marcação): <marcação>
Contexto do vídeo (1 frase): <assunto do vídeo>.
Antes: leia <raiz>/.claude/skills/editor/aprendizados/inserts.md (o que o criador já corrigiu) e siga.
Briefing/materiais: <se houver; caminhos em projetos/<slug>/apoio/>.

Ordem: (1) materiais do criador; (2) `banco.py buscar "<termos>"`; (3) `captura.py <url> --proporcao <16:9 para
dividida | 9:16 para vertical> --duracao <duração+1, mín. 4> --projeto <slug>` quando a fala cita um site/ferramenta
(ache a URL oficial com WebSearch); (4) web oficial: imagens/vídeos do próprio produto (yt-dlp com --download-sections
para baixar só o trecho útil; nunca rosto ou vídeo de outro criador), e `banco.py adicionar <arquivo> --nome … --descricao
… --palavras … --fonte <url> --projeto <slug>`.
Mídias: 1 a 3 (se a marcação cita duas coisas, uma de cada). Vídeo com movimento é melhor que imagem parada; o vídeo
precisa durar pelo menos a duração do insert. Proporção: horizontal para dividida; 9:16 para vertical (se só houver
horizontal, serve).
Confira o que achou: olhe os quadros (`folha.py <video>` e leia a imagem; imagens, leia direto). Para um vídeo baixado
cujo conteúdo você não consegue julgar pelos quadros, pergunte ao `gemini.py <video> "<pergunta>"`.
Se só um trecho do vídeo serve, crie um trecho: `banco.py trecho <id> <ini> <fim>` e use o id do trecho. Capturas
começam em branco enquanto a página carrega: corte o começo branco com um trecho.
Apague do banco o que você capturou ou baixou e NÃO usou: `banco.py apagar <id…>`.
Se nada real servir, não monte um mockup seu: diga na nota (quem decide a troca é o editor).
No fim, grave projetos/<slug>/inserts/<plano>.json = {"plano": "<plano>", "midias": ["<banco_id>", …], "fontes": ["<url>",
…], "nota": "o que achou, ou por que não achou"} e responda com 2 linhas: os ids e a nota.
```

## Depois

- `inserts.py juntar <slug>`; leia o que ficou **sem mídia**. Para cada um: rode de novo com outra estratégia, ou troque
  o plano (motion novo, Full ator) — e então reaplique a direção (`direcao.py aplicar`) com o roteiro ajustado.
- Comentário + insert + ator: o card do comentário usa o texto do plano; a mídia é o insert por trás dele.
- O que entrou no banco fica para os próximos vídeos (o banco cresce sozinho).

Tempo esperado: 3 a 6 min (em paralelo com Áudio, Legenda e Transições).
