# Aprendizados · Inserts (busca, captura de tela, escolha da mídia)

O que já foi aprendido nesta área, vídeo a vídeo (como gravar: `etapas/14-concluir.md`). Leia antes de trabalhar nela
e não repita estes erros. **[gosto]** = preferência confirmada pelo criador · **[defeito]** = erro técnico.

## Do criador

_Nenhum ainda._

## Técnicos (do editor)

- Os inserts que já estão no banco voltam em ~20 s; os que pedem busca e captura, em 3 a 11 min. _1º teste · 2026-10-10_
- openai.com, claude.com, perplexity.ai, Gamma e Canva bloqueiam a captura (Cloudflare, "Um momento…"): vá para a doc
  oficial (developers.openai.com, docs.anthropic.com), o blog ou o model card do produto. _1º teste_
- Capturas começam em branco enquanto a página carrega: corte o começo com um trecho (`banco.py trecho`). _1º teste_
- Sites com WebGL pesado (esferas 3D) podem sair pretos na captura com a máquina carregada; um vídeo do banco curto
  demais pode virar câmera lenta (`ffmpeg -vf "setpts=PTS/0.42,minterpolate=fps=30:mi_mode=blend"`). _1º teste_
- Exemplos "do que não fazer" (site genérico, site poluído) são os mais difíceis de achar prontos: descreva na marcação
  um tipo concreto e achável (ex.: "a galeria de templates do Lovable"). Nunca monte um mockup sem dizer. _1º teste_
- Apague do banco o que foi capturado e não serviu (`banco.py apagar`): os subagentes deixavam lixo. _1º teste_
