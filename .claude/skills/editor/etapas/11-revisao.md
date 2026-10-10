# 11 · Aplicar uma revisão

O criador comenta a versão no app e cola aqui o texto do botão "Copiar revisão":

```text
Revisão · <slug> · v2
[0:03,2] "a galera considera" — tira esse motion, prefiro tela dividida com o site
[0:12,0–0:15,4] "esses dois sites" — mostra os dois, um de cada vez
[↳ dúvida do Claude 0:21,7] "Gemini 3.7" — sim, mantém
Geral: legenda um pouco mais baixa
(projetos/<slug>/revisoes/v2.json)
```

## Rodar

```bash
uv run ferramentas/revisao.py ler <slug> [vN]     # cada comentário com id, âncora (palavra) e o plano sob ele
```

## Aplicar

1. **Classifique** cada comentário pela etapa que ele toca e leia o `.md` dessa etapa:
   - fala (corta/volta palavra, repetição) → `02-cortes.md` (edite a `selecao.json` e `cortes.py aplicar`);
   - plano, tipo, o que aparece, lettering, elementos → `03-direcao.md` (edite o `roteiro.md` e `direcao.py aplicar`:
     os inserts que continuam no mesmo plano mantêm as mídias);
   - mídia errada/faltando → `04-inserts.md` (um subagente para cada insert a refazer, em paralelo);
   - preset, zoom, card → `05-enriquecimento.md`; motion → `06-…`; transição → `07-…`; música/volume → `08-…`;
     legenda → `09-…`.
2. Os comentários são presos ao **tempo da versão revisada** e à palavra falada ali: use a palavra (id) como âncora,
   não o segundo (o tempo muda quando os cortes mudam).
3. Aplique tudo, depois `render.py <slug>` (vira a v(N+1)) e a autorrevisão leve (só a folha de contato nos pontos
   mexidos).
4. **Responda cada comentário** no JSON:
   ```bash
   uv run ferramentas/revisao.py responder <slug> vN <id> --status aplicado --resposta "troquei por tela dividida com o site do X"
   ```
   `status`: `aplicado` · `respondido` (era pergunta) · `nao_aplicado` (diga por quê). As respostas aparecem no app.
5. Entregue como no `10-render.md`: o link, o que mudou em 3–5 linhas.

## Vira regra?

No fim, olhe os comentários que soam como **gosto geral** ("nunca abra com Full ator", "legenda sempre mais baixa",
"esse preset é feio") e pergunte ao criador, numa lista curta: "Isso vira regra para os próximos vídeos?". Só com o
"sim" dele, grave: direção → `exemplos/regras.md` (seção Regras do criador); outra etapa → o `.md` dela (numa seção
"Regras do criador"); biblioteca (preset/transição/trilha que ele não quer mais) → tire das favoritas em `ordem.json`.
Correção pontual não vira regra.
