# Aprendizados · Render e autorrevisão

O que já foi aprendido nesta área, vídeo a vídeo (como gravar: `etapas/14-concluir.md`). Leia antes de trabalhar nela
e não repita estes erros. **[gosto]** = preferência confirmada pelo criador · **[defeito]** = erro técnico.

## Do criador

_Nenhum ainda._

## Técnicos (do editor)

- O Gemini acerta problemas de corte e de legenda sobre conteúdo, e erra cor de legenda (diz "preta" para a branca com
  sombra): confira na folha de contato antes de mexer. _1º teste · 2026-10-10_
- Nunca rode o render (ou algo que use multiprocessing) por `python -` (stdin): os processos-filho entram em laço e a
  máquina trava. Use um arquivo com `if __name__ == '__main__'`. _1º teste_
