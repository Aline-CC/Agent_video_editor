// As páginas que leem as referências da calibragem: a galeria de Referências (todos os planos, para ver como cada tipo
// foi usado e favoritar os melhores) e a Heurística da direção (as regras e os roteiros de exemplo que o Claude lê).
import { $, $$, ESTRELA_CHEIA, ICONE, PLANOS, ajuda, aviso, chipCodigo, codigos, enviar, esc, janela, nomePlano, num, preferencia, seg, tempo, tocarTrecho, urlRef } from './comum.js'
import { jsons } from './biblioteca.js'

const GRUPOS = [
  ['dividida', 'Tela dividida', ['tela_dividida_insert', 'tela_dividida_motion']],
  ['cheia', 'Tela cheia', ['insert_tela_cheia', 'motion_tela_cheia']],
  ['lettering', 'Full ator com lettering', ['full_ator_lettering']],
  ['ator', 'Full ator', ['full_ator']],
  ['comentario', 'Comentário + insert + ator', ['comentario_insert_ator']],
]
const SO_ATOR = ['full_ator', 'full_ator_lettering']
const ORDENS = { aleatorio: 'Aleatório', longos: 'Mais longos', curtos: 'Mais curtos', video: 'Por vídeo' }
const sorteio = new Map() // o aleatório é sorteado uma vez por clipe enquanto a página está aberta: favoritar não embaralha
const chaveClipe = (c) => `${c.ref}|${c.inicio}`
const ENTRA = { na_pausa: 'numa pausa', entre_palavras: 'entre palavras coladas', dentro_da_palavra: 'no meio de uma palavra', depois_da_fala: 'depois que a fala acabou' }

// ---------- Referências ----------

export async function abrirReferencias(tela) {
  tela.className = 'pagina pagina-referencias'
  tela.innerHTML = '<p class="vazio">Carregando…</p>'
  let dados
  try {
    dados = await enviar('GET', '/api/referencias/clipes')
  } catch (e) {
    tela.innerHTML = `<p class="vazio">${esc(e.message)}</p>`
    return null
  }
  const [presets, cods] = await Promise.all([jsons('biblioteca/presets', ['ordem.json']), codigos()])
  const clipes = dados.clipes
  const codigoDo = (c) => (cods.referencia?.[c.ref] ? `${cods.referencia[c.ref]}·${c.id}` : null)
  const chipDo = (c) => chipCodigo(codigoDo(c), `${nomePlano(c.tipo)} · ${c.ref_nome} ${tempo(c.inicio)}`)
  for (const c of clipes) {
    if (!sorteio.has(chaveClipe(c))) sorteio.set(chaveClipe(c), Math.random())
    c.presets = presets.filter((p) => (p.fontes || []).some((f) => f.ref === c.ref && f.inicio >= c.inicio - 0.5 && f.fim <= c.fim + 0.5))
  }
  const grupos = [...GRUPOS]
  const conhecidos = new Set(GRUPOS.flatMap((g) => g[2]))
  for (const t of new Set(clipes.map((c) => c.tipo))) if (!conhecidos.has(t)) grupos.splice(grupos.length - 1, 0, [t, nomePlano(t), [t]])
  let filtro = 'todos'
  let semAtor = preferencia('semFullAtor', true)
  let soRevisadas = false
  let ordem = 'aleatorio'
  let visiveis = []

  const base = () => clipes.filter((c) => (!semAtor || !SO_ATOR.includes(c.tipo)) && (!soRevisadas || c.revisado))
  const card = (c, k) => `<article class="card-clipe" data-k="${k}">
      <div class="mini mini-916">${c.miniatura ? `<img src="${c.miniatura}" alt="" loading="lazy">` : ''}
        <span class="selo tipo-${esc(c.tipo)}">${esc(nomePlano(c.tipo))}</span>
        ${c.presets.length ? '<span class="selo selo-preset">preset</span>' : ''}
        <button class="estrela${c.favorito ? ' ligada' : ''}" data-favoritar title="${c.favorito ? 'Tirar dos favoritos' : 'Favoritar'} (F no clipe aberto)">${c.favorito ? ESTRELA_CHEIA : ICONE.estrela}</button>
        ${c.revisado ? '<span class="selo-revisado">✓ revisado</span>' : ''}<span class="duracao duracao-baixo">${seg(c.fim - c.inicio)}</span></div>
      <p class="sub">${esc(c.ref_nome)} · ${tempo(c.inicio)}</p><div class="card-pe">${chipDo(c)}</div>
      ${c.texto ? `<p class="texto-clipe">“${esc(c.texto)}”</p>` : ''}
      <p class="desc desc-2">${esc(c.descricao || '')}</p>
    </article>`

  const desenhar = () => {
    const l = base()
    const nFav = l.filter((c) => c.favorito).length
    const contar = (tipos) => l.filter((c) => tipos.includes(c.tipo)).length
    const ativos = grupos.filter(([id, , tipos]) => !(semAtor && tipos.every((t) => SO_ATOR.includes(t))))
    if (filtro !== 'todos' && filtro !== 'favoritos' && !ativos.some(([id]) => id === filtro)) filtro = 'todos'
    const tiposDo = grupos.find(([id]) => id === filtro)?.[2]
    visiveis = l.filter((c) => (filtro === 'favoritos' ? c.favorito : !tiposDo || tiposDo.includes(c.tipo)))
    const dur = (c) => c.fim - c.inicio
    visiveis.sort({
      aleatorio: (a, b) => sorteio.get(chaveClipe(a)) - sorteio.get(chaveClipe(b)),
      longos: (a, b) => dur(b) - dur(a),
      curtos: (a, b) => dur(a) - dur(b),
      video: (a, b) => a.ref_nome.localeCompare(b.ref_nome, 'pt-BR') || a.inicio - b.inicio,
    }[ordem])
    const chip = (id, html) => `<button class="pilula pequena${filtro === id ? ' ativa' : ''}" data-filtro="${id}">${html}</button>`
    tela.innerHTML = `<div class="filtros filtros-ref">
        ${chip('favoritos', `${ICONE.estrela} Favoritos <span class="conta">${nFav}</span>`)}
        ${chip('todos', `Todos <span class="conta">${l.length}</span>`)}
        ${ativos.map(([id, nome, tipos]) => chip(id, `${esc(nome)} <span class="conta">${contar(tipos)}</span>`)).join('')}
        <span class="filtros-dir">
          <label class="caixa"><input type="checkbox" data-sem-ator ${semAtor ? 'checked' : ''}> Ignorar Full ator</label>
          <label class="caixa"><input type="checkbox" data-revisadas ${soRevisadas ? 'checked' : ''}> Só revisadas</label>
          <label class="caixa">Ordenar <select data-ordem>${Object.entries(ORDENS).map(([k, n]) => `<option value="${k}"${k === ordem ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
          <span class="dica">${visiveis.length} clipes</span></span></div>
      ${!clipes.length ? '<p class="vazio">Nenhum clipe ainda. Suba vídeos editados na <a href="#/calibragem">Calibragem</a>: quando a análise terminar, cada plano aparece aqui.</p>'
        : visiveis.length ? `<div class="grade grade-clipes">${visiveis.map(card).join('')}</div>` : '<p class="vazio">Nenhum clipe com esses filtros.</p>'}`
  }

  const favoritar = async (c) => {
    c.favorito = !c.favorito
    atualizarEstrelas(c)
    try {
      await enviar('PUT', `/api/referencias/${encodeURIComponent(c.ref)}/favorito`, { inicio: c.inicio, fim: c.fim, favorito: c.favorito })
      aviso(c.favorito ? '★ Favorito' : 'Tirado dos favoritos')
    } catch (e) {
      c.favorito = !c.favorito // o servidor recusou: volta
      atualizarEstrelas(c)
      aviso(e.message, 'erro')
    }
  }
  const atualizarEstrelas = (c) => {
    for (const b of $$('[data-favoritar]', document)) {
      const dono = b.closest('[data-k]')
      const x = dono ? visiveis[+dono.dataset.k] : null
      if (x !== c) continue
      b.classList.toggle('ligada', c.favorito)
      b.innerHTML = b.classList.contains('botao') ? `${c.favorito ? ESTRELA_CHEIA : ICONE.estrela} ${c.favorito ? 'Favorito' : 'Favoritar'}` : c.favorito ? ESTRELA_CHEIA : ICONE.estrela
    }
    const fav = $('[data-filtro="favoritos"] .conta', tela)
    if (fav) fav.textContent = base().filter((x) => x.favorito).length
  }

  // o clipe tocando mudo com o mouse em cima (um vídeo só, que passa de card em card)
  const previa = document.createElement('video')
  previa.muted = true
  previa.playsInline = true
  previa.preload = 'auto'
  let parar = null
  tela.addEventListener('mouseover', (e) => {
    const mini = e.target.closest('.card-clipe .mini')
    if (!mini || mini.contains(previa)) return
    const c = visiveis[+mini.closest('.card-clipe').dataset.k]
    parar?.()
    if (!previa.src.endsWith(c.video)) previa.src = c.video
    mini.append(previa)
    parar = tocarTrecho(previa, c.inicio, c.fim)
  })
  tela.addEventListener('mouseout', (e) => {
    const mini = e.target.closest('.card-clipe .mini')
    if (!mini || mini.contains(e.relatedTarget)) return
    parar?.()
    previa.pause()
    previa.remove()
  })
  tela.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filtro]')
    if (f) {
      filtro = f.dataset.filtro
      return desenhar()
    }
    const card = e.target.closest('.card-clipe')
    if (!card) return
    const c = visiveis[+card.dataset.k]
    if (e.target.closest('[data-favoritar]')) return favoritar(c)
    parar?.()
    previa.pause()
    previa.remove()
    abrirClipe(+card.dataset.k)
  })
  tela.addEventListener('change', (e) => {
    if (e.target.matches('[data-sem-ator]')) semAtor = preferencia('semFullAtor', true, e.target.checked)
    if (e.target.matches('[data-revisadas]')) soRevisadas = e.target.checked
    if (e.target.matches('[data-ordem]')) ordem = e.target.value
    desenhar()
  })

  /** O modal do clipe: este trecho em loop (com som) ou o vídeo de origem, os dados e a faixa dos planos da origem. */
  const abrirClipe = (k0) => {
    let k = k0
    let modo = 'trecho'
    let pararTrecho = null
    const { el, fechar } = janela('', {
      classe: 'janela-clipe',
      aoFechar: () => {
        pararTrecho?.()
        document.removeEventListener('keydown', tecla)
      },
    })
    const tocar = () => {
      const c = visiveis[k]
      const v = $('video', el)
      pararTrecho?.()
      pararTrecho = null
      for (const b of $$('[data-modo]', el)) b.classList.toggle('ativa', b.dataset.modo === modo)
      if (modo === 'trecho') pararTrecho = tocarTrecho(v, c.inicio, c.fim)
      else {
        v.currentTime = c.inicio
        v.play().catch(() => {})
      }
    }
    const mostrar = () => {
      const c = visiveis[k]
      const o = dados.origens[c.ref] || { planos: [], proporcao: {}, duracao: c.fim }
      const e = c.entrada
      const entra = !e ? 'abre o vídeo' : [ENTRA[e.onde] || e.onde, e.frase ? (e.frase === 'inicio' ? 'no começo de uma frase' : 'no meio de uma frase') : '',
        e.palavra && e.ms != null ? `${Math.abs(e.ms)} ms ${e.ms < 0 ? 'antes' : 'depois'} de “${esc(e.palavra)}”` : ''].filter(Boolean).join(' · ')
      const viz = (x, fim) => (x ? `${esc(nomePlano(x.tipo))} · ${seg(x.duracao)}` : `— (${fim} o vídeo)`)
      const props = Object.entries(o.proporcao || {}).sort((a, b) => b[1] - a[1])
      el.innerHTML = `<header class="janela-cabeca" data-k="${k}"><span class="chip-plano tipo-${esc(c.tipo)}">${esc(nomePlano(c.tipo))}</span>
          ${chipDo(c)}${c.revisado ? '<span class="t-revisado">✓ revisado</span>' : ''}<span class="dica">${k + 1} de ${visiveis.length}</span>
          ${c.presets.length ? `<a class="link" href="#/presets" data-fechar>${c.presets.length === 1 ? 'Virou preset' : `${c.presets.length} presets`} ↗</a>` : ''}
          <span class="espaco"></span>
          <button class="botao pequeno estrela-botao${c.favorito ? ' ligada' : ''}" data-favoritar>${c.favorito ? ESTRELA_CHEIA : ICONE.estrela} ${c.favorito ? 'Favorito' : 'Favoritar'} <kbd>F</kbd></button>
          <button class="botao-icone" data-anterior title="Anterior (←)">${ICONE.quadroAntes}</button><button class="botao-icone" data-seguinte title="Seguinte (→)">${ICONE.quadroDepois}</button>
          <button class="botao-icone" data-fechar title="Fechar (Esc)">${ICONE.fechar}</button></header>
        <div class="clipe-corpo" data-k="${k}">
          <div class="clipe-video"><video src="${c.video}" controls playsinline></video>
            <div class="alternar"><button class="pilula pequena" data-modo="trecho">Este trecho</button><button class="pilula pequena" data-modo="origem">Vídeo de origem</button></div></div>
          <div class="clipe-info">
            ${c.texto ? `<p class="clipe-texto">“${esc(c.texto)}”</p>` : ''}
            <div class="campo"><span class="eyebrow">Marcação</span><p>${esc(c.descricao || '—')}</p></div>
            <dl class="dados"><dt>Duração</dt><dd>${seg(c.fim - c.inicio)}</dd>
              <dt>Onde no vídeo</dt><dd>${tempo(c.inicio)} → ${tempo(c.fim)} · ${Math.round((c.posicao || 0) * 100)}% · plano ${c.numero} de ${c.total}</dd>
              <dt>Entra</dt><dd>${entra}</dd>
              <dt>Fala no trecho</dt><dd>${c.palavras} palavras${c.por_minuto ? ` · ${c.por_minuto} por minuto` : ''}</dd>
              <dt>Vem depois de</dt><dd>${viz(c.anterior, 'abre')}</dd><dt>Vai para</dt><dd>${viz(c.seguinte, 'fecha')}</dd></dl>
            ${c.elementos?.length ? `<div class="campo"><span class="eyebrow">Elementos dentro do plano</span><ul class="lista-simples">${c.elementos.map((x) => `<li><span>${esc(dados.elementos?.[x.tipo] || x.tipo)}${x.texto ? ` · “${esc(x.texto)}”` : ''}</span><span class="apagado">${tempo(x.inicio)}</span></li>`).join('')}</ul></div>` : ''}
            ${c.fala ? `<div class="campo"><span class="eyebrow">Fala</span><p class="fala">“${esc(c.fala)}”</p></div>` : ''}
            <div class="campo"><span class="eyebrow">Vídeo de origem</span>
              <p><b>${esc(o.nome || c.ref_nome)}</b> · ${tempo(o.duracao)} · ${o.planos.length} planos · <a class="link" href="#/calibragem/${encodeURIComponent(c.ref)}" data-fechar>abrir na calibragem ↗</a></p>
              <div class="barras">${props.map(([t, f]) => `<div class="barra-prop"><span>${esc(nomePlano(t))}</span><i><b class="tipo-${esc(t)}" style="width:${(f * 100).toFixed(1)}%"></b></i><span class="apagado">${Math.round(f * 100)}%</span></div>`).join('')}</div></div>
          </div>
        </div>
        <div class="faixa-origem" title="Clique para ver o vídeo de origem a partir daí">${o.planos.map((p) => `<span class="tipo-${esc(p.tipo)}${Math.abs(p.inicio - c.inicio) < 0.05 ? ' este' : ''}" style="left:${(p.inicio / o.duracao) * 100}%;width:${((p.fim - p.inicio) / o.duracao) * 100}%" title="${esc(nomePlano(p.tipo))} · ${tempo(p.inicio)}"></span>`).join('')}<i class="cabeca-origem"></i></div>`
      const v = $('video', el)
      v.addEventListener('timeupdate', () => ($('.cabeca-origem', el).style.left = `${(v.currentTime / o.duracao) * 100}%`))
      tocar()
    }
    const ir = (d) => {
      k = (k + d + visiveis.length) % visiveis.length
      mostrar()
    }
    el.addEventListener('click', (e) => {
      const m = e.target.closest('[data-modo]')
      if (m) {
        modo = m.dataset.modo
        return tocar()
      }
      if (e.target.closest('[data-favoritar]')) return favoritar(visiveis[k])
      if (e.target.closest('[data-anterior]')) return ir(-1)
      if (e.target.closest('[data-seguinte]')) return ir(1)
      const faixa = e.target.closest('.faixa-origem')
      if (faixa) {
        const caixa = faixa.getBoundingClientRect()
        const o = dados.origens[visiveis[k].ref]
        modo = 'origem'
        pararTrecho?.()
        pararTrecho = null
        for (const b of $$('[data-modo]', el)) b.classList.toggle('ativa', b.dataset.modo === modo)
        const v = $('video', el)
        v.currentTime = ((e.clientX - caixa.left) / caixa.width) * o.duracao
        v.play().catch(() => {})
      }
    })
    const tecla = (e) => {
      if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return
      const v = $('video', el)
      const f = {
        ArrowLeft: () => ir(-1),
        ArrowRight: () => ir(1),
        f: () => favoritar(visiveis[k]),
        F: () => favoritar(visiveis[k]),
        ' ': () => (v.paused ? v.play().catch(() => {}) : v.pause()),
      }[e.key]
      if (f) {
        e.preventDefault()
        e.stopPropagation()
        f()
      }
    }
    document.addEventListener('keydown', tecla)
    mostrar()
  }

  desenhar()
  return () => {
    parar?.()
    previa.pause()
  }
}

// ---------- Heurística da direção ----------

const TAG_LETTERING = /<lettering(?:\s+texto\s*=\s*["“]([^"”]*)["”])?\s*>(.*?)<\/lettering\s*>/gi
/** A fala com os `<lettering>` destacados (e o texto da tela, quando é diferente do falado). */
function falaComLettering(fala) {
  let html = ''
  let pos = 0
  for (const m of fala.matchAll(TAG_LETTERING)) {
    html += esc(fala.slice(pos, m.index))
    html += `<mark title="${m[1] ? `Lettering na tela: ${esc(m[1])}` : 'Lettering'}">${esc(m[2])}${m[1] ? ` <small>→ ${esc(m[1])}</small>` : ''}</mark>`
    pos = m.index + m[0].length
  }
  return `“${html + esc(fala.slice(pos))}”`
}

/** Um Markdown pequeno (títulos, listas, parágrafos, negrito, itálico e código), o bastante para as regras. */
function markdown(texto) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
  let html = ''
  let lista = false
  let paragrafo = []
  const fecharParagrafo = () => {
    if (paragrafo.length) html += `<p>${inline(paragrafo.join(' '))}</p>`
    paragrafo = []
  }
  const fecharLista = () => {
    if (lista) html += '</ul>'
    lista = false
  }
  for (const linha of texto.split('\n')) {
    const t = linha.trim()
    const titulo = t.match(/^(#{1,4})\s+(.*)$/)
    if (titulo) {
      fecharParagrafo()
      fecharLista()
      html += `<h${titulo[1].length + 1}>${inline(titulo[2])}</h${titulo[1].length + 1}>`
    } else if (/^[-*]\s+/.test(t)) {
      fecharParagrafo()
      if (!lista) html += '<ul>'
      lista = true
      html += `<li>${inline(t.replace(/^[-*]\s+/, ''))}</li>`
    } else if (!t) {
      fecharParagrafo()
      fecharLista()
    } else {
      fecharLista()
      paragrafo.push(t)
    }
  }
  fecharParagrafo()
  fecharLista()
  return html
}

export async function abrirHeuristica(tela) {
  tela.className = 'pagina pagina-heuristica'
  let h
  try {
    h = await enviar('GET', '/api/heuristica')
  } catch (e) {
    tela.innerHTML = `<p class="vazio">${esc(e.message)}</p>`
    return null
  }
  let modo = 'ler'
  const abertos = new Set()
  const linhas = h.roteiros.reduce((n, r) => n + r.linhas.length, 0)
  const regras = () =>
    modo === 'ler' ? `<div class="markdown">${markdown(h.regras)}</div>` : `<textarea class="editor-regras" spellcheck="false">${esc(h.regras)}</textarea>`
  const roteiro = (r) => `<details class="sanfona" data-ref="${esc(r.ref)}" ${abertos.has(r.ref) ? 'open' : ''}>
      <summary>${ICONE.seta_baixo}<b>${esc(r.nome)}</b><span class="dica">${r.linhas.length} linhas${r.revisado ? ' · ✓ revisado' : ''}</span>
        <a class="link" href="#/calibragem/${encodeURIComponent(r.ref)}">abrir calibragem ↗</a></summary>
      <div class="roteiro">${r.linhas.map((l, k) => `<button class="linha-roteiro" data-k="${k}" ${l.inicio == null ? 'title="Sem os tempos deste trecho"' : `title="${tempo(l.inicio)}–${tempo(l.fim)} · clique para assistir"`}>
          <span class="marcacao"><i class="ponto ${l.tipo ? `tipo-${esc(l.tipo)}` : ''}"></i>${esc(l.marcacao)}</span>
          <span class="fala-roteiro">${l.fala ? falaComLettering(l.fala) : '<i class="apagado">(sem fala)</i>'}</span></button>`).join('')}</div>
    </details>`
  const desenhar = () => {
    tela.innerHTML = `<div class="cabeca-secao"><span class="eyebrow">Heurística da direção</span>${ajuda('O Claude lê esta página inteira antes de dirigir cada vídeo: as regras e, embaixo, os roteiros dos seus vídeos — a fala com a marcação do que aparecia na tela em cada momento. Ele aprende a dirigir olhando os roteiros. As regras você edita aqui (as do criador são obrigatórias; as sugeridas pela IA são guia). Os roteiros vêm da Calibragem: para corrigir uma marcação, abra a revisão do vídeo.')}<span class="salvo" id="salvo-h"></span></div>
      <section class="bloco-heuristica"><div class="titulo-bloco"><span class="eyebrow">Regras</span>
          <div class="alternar">${['ler', 'editar'].map((m) => `<button class="pilula pequena${modo === m ? ' ativa' : ''}" data-modo="${m}">${m === 'ler' ? 'Ler' : 'Editar'}</button>`).join('')}</div>
          ${modo === 'editar' ? '<span class="dica">Grava ao sair da caixa.</span>' : ''}</div>
        ${regras()}</section>
      <section class="bloco-heuristica"><div class="titulo-bloco"><span class="eyebrow">Roteiros de exemplo</span>
          <span class="dica">${h.roteiros.length} vídeos · ${linhas} linhas. Clique numa linha para assistir àquele trecho.</span></div>
        ${h.roteiros.length ? h.roteiros.map(roteiro).join('') : '<p class="dica">Nenhum roteiro ainda: eles saem das referências analisadas na Calibragem.</p>'}</section>`
  }
  const salvo = (texto, erro = false) => {
    const el = $('#salvo-h', tela)
    if (!el) return
    el.className = `salvo${erro ? ' salvo-erro' : ''}`
    el.innerHTML = texto
    if (!erro) setTimeout(() => el.textContent === 'Salvo' && (el.innerHTML = ''), 1800)
  }
  tela.addEventListener('click', (e) => {
    const m = e.target.closest('[data-modo]')
    if (m) {
      modo = m.dataset.modo
      desenhar()
      if (modo === 'editar') $('.editor-regras', tela).focus()
      return
    }
    const b = e.target.closest('.linha-roteiro')
    if (!b) return
    const r = h.roteiros.find((x) => x.ref === b.closest('.sanfona').dataset.ref)
    const l = r.linhas[+b.dataset.k]
    if (l.inicio == null || !r.proxy) return aviso('Sem os tempos deste trecho (o roteiro e a direção da referência não batem).', 'erro')
    for (const x of $$('.linha-roteiro.ativa', tela)) x.classList.remove('ativa')
    b.classList.add('ativa')
    let parar = null
    const { el } = janela(`<div class="player-linha"><video src="${urlRef(r.ref, 'proxy.mp4')}" controls playsinline></video>
        <div class="player-info"><div class="item-cabeca"><span class="dica">${esc(r.nome)} · ${tempo(l.inicio)}–${tempo(l.fim)}</span><span class="espaco"></span><button class="botao-icone" data-fechar title="Fechar (Esc)">${ICONE.fechar}</button></div>
          <p class="marcacao">${l.tipo ? `<i class="ponto tipo-${esc(l.tipo)}"></i>` : ''}${esc(l.marcacao)}</p>
          <p class="fala-roteiro">${l.fala ? falaComLettering(l.fala) : '(sem fala)'}</p></div></div>`, { classe: 'janela-linha', aoFechar: () => parar?.() })
    parar = tocarTrecho($('video', el), l.inicio, l.fim)
  })
  tela.addEventListener('toggle', (e) => {
    const d = e.target.closest?.('.sanfona')
    if (d) d.open ? abertos.add(d.dataset.ref) : abertos.delete(d.dataset.ref)
  }, true)
  tela.addEventListener('focusout', async (e) => {
    if (!e.target.matches('.editor-regras')) return
    const texto = e.target.value
    if (texto.trim() === h.regras.trim()) return
    salvo('Salvando…')
    try {
      await enviar('PUT', '/api/heuristica', { regras: texto })
      h.regras = texto.trimEnd() + '\n'
      salvo('Salvo')
    } catch (x) {
      salvo(esc(x.message), true)
    }
  })
  desenhar()
}
