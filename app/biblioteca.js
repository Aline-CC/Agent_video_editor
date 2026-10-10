// A biblioteca: presets (aprovar e os recomendados por situação), transições (as favoritas de cada par de grupos),
// banco de inserts (corrigir nome, descrição e palavras-chave; apagar), motions (aprovar os novos) e trilhas.
// O Claude é quem cria; aqui o criador vê, aprova e marca os melhores.
import { $, $$, ESTRELA_CHEIA, ICONE, aviso, confirmar, dataHora, enviar, esc, janela, json, lista, mmss, num, seg, tocarTrecho, urlRef } from './comum.js'

export const PAGINAS_BIBLIOTECA = ['presets', 'transicoes', 'banco', 'motions', 'trilhas']

export async function abrirBiblioteca(tela, aba, resto = []) {
  tela.className = `pagina pagina-biblioteca pagina-${aba}`
  tela.innerHTML = '<p class="vazio">Carregando…</p>'
  const sair = await { banco, presets, transicoes, motions, trilhas }[aba](tela, resto)
  return () => {
    for (const m of $$('video, audio', tela)) m.pause()
    sair?.()
  }
}

/** Os JSONs de uma pasta (menos os que não são itens). */
export async function jsons(pasta, fora = []) {
  const nomes = (await lista(pasta)).filter((n) => n.endsWith('.json') && !fora.includes(n))
  return (await Promise.all(nomes.map((n) => json(`/${pasta}/${n}`)))).filter(Boolean)
}

let sonsCache
async function nomesDosSons() {
  sonsCache ||= json('/biblioteca/sons/catalogo.json', []).then((l) => Object.fromEntries((l || []).map((s) => [s.id, s.nome])))
  return sonsCache
}

/** Um vídeo que toca com o mouse em cima (mudo) e volta ao começo ao sair. */
function tocarNoHover(card, video, inicio = 0) {
  card.addEventListener('mouseenter', () => {
    if (!video.src && video.dataset.src) video.src = video.dataset.src
    video.currentTime = inicio
    video.play().catch(() => {})
  })
  card.addEventListener('mouseleave', () => video.pause())
}

const cabeca = (titulo, texto, extra = '') =>
  `<div class="cabeca-secao"><span class="eyebrow">${titulo}</span><span class="dica">${texto}</span>${extra}</div>`
const dois = (n) => String(n).padStart(2, '0')
const chip = (ativo, html, attrs = '') => `<button class="pilula pequena${ativo ? ' ativa' : ''}" ${attrs}>${html}</button>`

// ---------- Banco ----------

function origemDe(o) {
  if (!o) return ''
  if (o.url) {
    const curto = o.url.replace(/^https?:\/\//, '').replace(/[#?].*$/, '')
    return `${o.tipo === 'captura de site' ? 'Captura de site' : esc(o.tipo || 'Link')} · <a href="${esc(o.url)}" target="_blank" rel="noopener" title="${esc(o.url)}">${esc(curto)}</a>`
  }
  if (o.tipo === 'upload') return `Upload${o.nome_original ? ` · ${esc(o.nome_original)}` : ''}`
  return esc(o.tipo || '')
}

async function banco(el) {
  const ids = (await lista('biblioteca/banco')).filter((n) => n.endsWith('/')).map((n) => n.slice(0, -1))
  const itens = (await Promise.all(ids.map((id) => json(`/biblioteca/banco/${id}/item.json`).then((it) => it && { ...it, id: it.id || id })))).filter(Boolean)
  const originais = itens.filter((i) => !i.pai).sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''))
  const trechos = {}
  for (const t of itens.filter((i) => i.pai)) (trechos[t.pai] ||= []).push(t)
  for (const l of Object.values(trechos)) l.sort((a, b) => a.inicio - b.inicio)

  const cards = originais.map((it) => {
    const base = `/biblioteca/banco/${it.id}/`
    const video = it.tipo === 'video'
    const ts = trechos[it.id] || []
    return `<article class="card-banco" data-id="${it.id}">
      <div class="mini mini-169"><img src="${base}miniatura.jpg" alt="" loading="lazy">
        ${video ? `<video muted loop playsinline preload="none" data-src="${base}${it.proxy || 'proxy.mp4'}"></video>` : ''}
        <span class="selo ${video ? 'selo-azul' : 'selo-menta'}">${video ? 'Vídeo' : 'Imagem'} · ${esc(it.formato || '')}</span>
        ${video && it.duracao ? `<span class="duracao">${seg(it.duracao)}</span>` : ''}
        ${ts.length ? `<span class="selo selo-coral selo-dir">${ts.length} ${ts.length === 1 ? 'trecho' : 'trechos'}</span>` : ''}</div>
      <h3>${esc(it.nome)}</h3>
      ${it.descricao ? `<p class="desc">${esc(it.descricao)}</p>` : '<p class="desc apagado">sem descrição</p>'}
      <p class="origem">${origemDe(it.origem)}</p>
      ${ts.length ? `<ul class="trechos">${ts.map((t) => `<li data-ini="${t.inicio}" data-fim="${t.fim}"><span>${esc(t.nome)}</span><span class="apagado">${seg(t.fim - t.inicio)}</span></li>`).join('')}</ul>` : ''}
    </article>`
  })
  el.innerHTML = cabeca(`Banco · ${dois(originais.length)} mídias`, 'Os vídeos e imagens dos inserts, de todos os projetos. Passe o mouse para tocar; clique para corrigir o nome, a descrição e as palavras-chave.') +
    (originais.length ? `<div class="grade grade-banco">${cards.join('')}</div>` : '<p class="vazio">O banco está vazio.</p>')

  for (const card of $$('.card-banco', el)) {
    card.addEventListener('click', (e) => !e.target.closest('a') && detalheBanco(card.dataset.id, () => banco(el)))
    const v = $('video', card)
    if (!v) continue
    let trecho = null // [ini, fim] enquanto o mouse está num trecho
    let raf
    const laco = () => {
      if (trecho && v.currentTime >= trecho[1]) v.currentTime = trecho[0]
      raf = requestAnimationFrame(laco)
    }
    card.addEventListener('mouseenter', () => {
      if (!v.src) v.src = v.dataset.src
      v.currentTime = 0
      v.play().catch(() => {})
      laco()
    })
    card.addEventListener('mouseleave', () => {
      v.pause()
      cancelAnimationFrame(raf)
      trecho = null
    })
    for (const li of $$('.trechos li', card)) {
      li.addEventListener('mouseenter', () => {
        trecho = [+li.dataset.ini, +li.dataset.fim]
        v.currentTime = trecho[0]
        li.classList.add('ativo')
      })
      li.addEventListener('mouseleave', () => {
        trecho = null
        li.classList.remove('ativo')
      })
    }
  }
}

/** O detalhe de uma mídia: corrigir nome, descrição e palavras-chave, ver onde é usada e apagar. */
async function detalheBanco(id, recarregar) {
  let d
  try {
    d = await enviar('GET', `/api/banco/${id}`)
  } catch (e) {
    return aviso(e.message, 'erro')
  }
  const it = d.item
  const base = `/biblioteca/banco/${id}/`
  const video = it.tipo === 'video'
  const projetoDe = (u) => u.split('/')[0]
  const usos = d.usos.concat(d.trechos.flatMap((t) => t.usos.map((u) => `${u} · trecho “${t.nome}”`)))
  const { el, fechar } = janela(`
    <header class="janela-cabeca"><span class="selo-linha ${video ? 'selo-azul' : 'selo-menta'}">${video ? 'Vídeo' : 'Imagem'} · ${esc(it.formato || '')}</span>
      <span class="dica">${esc(id)}</span><button class="botao-icone" data-fechar title="Fechar (Esc)">${ICONE.fechar}</button></header>
    <div class="banco-detalhe">
      <div class="banco-midia">${video ? `<video src="${base}${it.proxy || 'proxy.mp4'}" controls muted playsinline autoplay loop></video>` : `<img src="${base}${esc(it.arquivo || 'miniatura.jpg')}" alt="">`}
        <dl class="dados"><dt>Dimensões</dt><dd>${it.largura || '?'} × ${it.altura || '?'}</dd>
          ${video ? `<dt>Duração</dt><dd>${seg(it.duracao || 0)}</dd>` : ''}
          <dt>Origem</dt><dd>${origemDe(it.origem) || '—'}</dd>
          <dt>Entrou em</dt><dd>${dataHora(it.criado_em) || '—'}${it.projeto ? ` · ${esc(it.projeto)}` : ''}</dd></dl></div>
      <form class="banco-campos" autocomplete="off">
        <label class="campo"><span class="eyebrow">Nome</span><input name="nome" value="${esc(it.nome)}"></label>
        <label class="campo"><span class="eyebrow">Descrição</span><textarea name="descricao" rows="5">${esc(it.descricao || '')}</textarea></label>
        <label class="campo"><span class="eyebrow">Palavras-chave <span class="apagado">· separadas por vírgula</span></span><input name="palavras" value="${esc((it.palavras || []).join(', '))}"></label>
        ${it.descricao_ia && it.descricao_ia !== it.descricao ? `<p class="dica"><b>A IA descreveu:</b> ${esc(it.descricao_ia)}</p>` : ''}
        <div class="acoes-linha"><button class="botao botao-coral" type="submit" disabled>Salvar</button>
          <button class="botao botao-perigo-contorno" type="button" data-apagar>${ICONE.lixo} Apagar do banco</button></div>
        <p class="erro-linha" hidden></p>
        ${d.trechos.length ? `<div class="bloco-lista"><span class="eyebrow">Trechos · ${d.trechos.length}</span><ul class="lista-simples">${d.trechos.map((t) => `<li><span>${esc(t.nome)}</span><span class="apagado">${seg(t.fim - t.inicio)} · ${mmss(t.inicio)}${t.usos.length ? ` · em ${t.usos.length}` : ''}</span></li>`).join('')}</ul></div>` : ''}
        <div class="bloco-lista"><span class="eyebrow">Usada em · ${usos.length}</span>
          ${usos.length ? `<ul class="lista-simples">${usos.map((u) => `<li><a href="#/p/${encodeURIComponent(projetoDe(u))}" data-fechar>${esc(u)}</a></li>`).join('')}</ul>` : '<p class="dica">Nenhum projeto usa esta mídia.</p>'}</div>
      </form>
    </div>`, { classe: 'janela-banco' })
  const form = $('form', el)
  const salvar = $('[type="submit"]', form)
  const erro = $('.erro-linha', el)
  const valores = () => ({ nome: form.nome.value.trim(), descricao: form.descricao.value.trim(), palavras: form.palavras.value.split(',').map((p) => p.trim()).filter(Boolean) })
  const inicial = JSON.stringify(valores())
  form.addEventListener('input', () => (salvar.disabled = JSON.stringify(valores()) === inicial || !form.nome.value.trim()))
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
      await enviar('PUT', `/api/banco/${id}`, valores())
      aviso('Salvo')
      fechar()
      recarregar()
    } catch (x) {
      erro.hidden = false
      erro.textContent = x.message
    }
  })
  $('[data-apagar]', el).addEventListener('click', async () => {
    const ok = await confirmar({ titulo: `Apagar “${it.nome}” do banco?`, texto: d.trechos.length ? `Os ${d.trechos.length} trechos dela vão junto.` : 'Não dá para desfazer.', ok: 'Apagar', perigo: true })
    if (!ok) return
    try {
      await enviar('DELETE', `/api/banco/${id}`)
      aviso('Apagada do banco')
      fechar()
      recarregar()
    } catch (x) {
      erro.hidden = false
      erro.textContent = x.message
    }
  })
}

// ---------- Presets ----------

const TELAS = { dividida: 'Tela dividida', vertical: 'Tela cheia', atras: 'Ator embaixo' }
const MIDIAS = { 1: '1 mídia', 2: '2 mídias', '2+': '3 ou mais' }
const PROPORCOES = { pe: '9:16', quadrada: 'Quadrada', deitada: 'Horizontal' }
const nMidias = (r) => Math.max(1, ...(r?.cards || []).map((c, k) => (c.midia ?? k) + 1))
const chaveMidias = (n) => (n <= 1 ? '1' : n === 2 ? '2' : '2+')
/** Onde o preset vale (como o `usosDe` do 18): o marcado, ou o que a receita suporta. */
function usosDe(p) {
  if (p.usos) return p.usos
  const telas = p.formatos || ['dividida', 'vertical']
  return { telas: telas.includes('dividida') ? [...telas, 'atras'] : telas, midias: p.receita?.repete ? ['2', '2+'] : [chaveMidias(nMidias(p.receita))] }
}
/** O preset serve à situação (como o `serve` do 18): a tela, o número de mídias e, com 1 mídia, a proporção dela. */
function serve(p, { tela, n, prop }) {
  const u = usosDe(p)
  const cabe = p.receita?.repete ? n >= 1 : n <= nMidias(p.receita)
  const props = !prop || !u.proporcoes || u.proporcoes.includes(prop)
  return cabe && props && u.midias.includes(chaveMidias(n)) && u.telas.includes(tela)
}
/** As situações dos recomendados (as chaves de presets/ordem.json): com 1 mídia, pela proporção; com várias, pelo número. */
const VARIANTES = [{ n: 1, prop: 'pe', nome: '1 mídia 9:16' }, { n: 1, prop: 'deitada', nome: '1 mídia horizontal' }, { n: 2, nome: '2 mídias' }, { n: 3, nome: '3 ou mais' }]
const situacao = (tela, n, prop) => `${tela}:${chaveMidias(n)}${n === 1 && prop ? `:${prop}` : ''}`
const N_RECOMENDADOS = 3
/** As situações de ordem.json em que o preset é favorito, juntas por tela: "Tela dividida: 1 em pé · 2". */
function favoritasPorTela(chaves) {
  const curto = (n, prop) => (n === '1' ? (prop === 'pe' ? '1 em pé' : '1 horizontal') : n === '2+' ? '3 ou mais' : `${n}`)
  const por = {}
  for (const c of chaves) {
    const [tela, n, prop] = c.split(':')
    ;(por[tela] ||= []).push(curto(n, prop))
  }
  return Object.entries(por).map(([tela, l]) => `<b>${TELAS[tela] || tela}</b> ${l.join(' · ')}`)
}
const botaoAprovar = (aprovado) =>
  `<button class="botao-check${aprovado ? ' ligado' : ''}" data-aprovar title="${aprovado ? 'Aprovado · clique para tirar a aprovação' : 'Aprovar'}" aria-pressed="${!!aprovado}">${ICONE.check}</button>`

async function presets(el) {
  const [ps, ordem0, sons] = await Promise.all([jsons('biblioteca/presets', ['ordem.json']), json('/biblioteca/presets/ordem.json', {}), nomesDosSons()])
  let ordem = ordem0 || {}
  let filtro = 'todos'
  ps.sort((a, b) => (a.aprovado ? 1 : 0) - (b.aprovado ? 1 : 0) || a.nome.localeCompare(b.nome, 'pt-BR')) // os a revisar primeiro

  const card = (p) => {
    const u = usosDe(p)
    const fonte = p.fontes?.[0]
    const sonsP = (p.receita?.sons || []).map((s) => `${esc(sons[s.som] || s.som)}${s.momento ? ` <span class="apagado">(${esc(s.momento)})</span>` : ''}`)
    const fav = Object.entries(ordem).filter(([, o]) => (o.ids || []).slice(0, o.favoritos || 0).includes(p.id)).map(([c]) => c)
    return `<article class="card-preset" data-id="${p.id}">
      <div class="mini mini-916"><video muted loop playsinline preload="metadata" src="/biblioteca/presets/clipes/${p.id}.mp4#t=0.05"></video>
        <span class="selo ${p.aprovado ? 'selo-menta' : 'selo-coral'}">${p.aprovado ? 'Aprovado' : 'A revisar'}</span>
        ${fav.length ? `<span class="selo selo-amarelo selo-dir" title="Favorito em ${fav.length} situações">★ ${fav.length}</span>` : ''}
        <span class="sem-clipe">sem clipe de referência</span></div>
      <div class="card-titulo"><h3>${esc(p.nome)}</h3>${botaoAprovar(p.aprovado)}</div>
      <p class="desc">${esc(p.descricao || '')}</p>
      <dl class="dados">
        <dt>Vale em</dt><dd>${u.telas.map((t) => TELAS[t] || t).join(' · ')}</dd>
        <dt>Mídias</dt><dd>${u.midias.map((m) => MIDIAS[m] || m).join(' · ')}${u.proporcoes ? ` <span class="apagado">(${u.proporcoes.map((x) => PROPORCOES[x] || x).join(', ')})</span>` : ''}</dd>
        <dt>Sons</dt><dd>${sonsP.length ? sonsP.join(' · ') : '<span class="apagado">nenhum</span>'}</dd>
        ${fonte ? `<dt>Referência</dt><dd>${esc(String(fonte.ref).replace(/^externa:/, ''))} ${mmss(fonte.inicio)}${p.fontes.length > 1 ? ` <span class="apagado">+${p.fontes.length - 1}</span>` : ''}</dd>` : ''}
        ${fav.length ? `<dt class="t-fav">★ Favorito</dt><dd class="favoritas">${favoritasPorTela(fav).join('<br>')}</dd>` : ''}
      </dl>
    </article>`
  }
  const ligarCard = (c) => {
    const v = $('video', c)
    v.addEventListener('error', () => c.classList.add('sem-video'))
    tocarNoHover(c, v)
  }
  const desenhar = () => {
    const n = { todos: ps.length, revisar: ps.filter((p) => !p.aprovado).length, aprovados: ps.filter((p) => p.aprovado).length }
    const vis = ps.filter((p) => filtro === 'todos' || (filtro === 'aprovados') === !!p.aprovado)
    el.innerHTML = cabeca(`Presets · ${dois(ps.length)}`, 'Os movimentos dos inserts, recriados das referências. Passe o mouse para ver o trecho de onde veio. Só os aprovados entram nas edições; os recomendados de cada situação vêm primeiro.') +
      `<div class="filtros">${[['todos', 'Todos'], ['revisar', 'A revisar'], ['aprovados', 'Aprovados']].map(([k, nome]) => chip(filtro === k, `${nome} <span class="conta">${n[k]}</span>`, `data-filtro="${k}"`)).join('')}
        <button class="botao botao-amarelo" data-recomendados>${ICONE.estrela} Recomendados por situação</button></div>
      ${vis.length ? `<div class="grade grade-presets">${vis.map(card).join('')}</div>` : '<p class="vazio">Nenhum preset aqui. Mande ao Claude o trecho de uma referência e ele monta o preset.</p>'}`
    for (const c of $$('.card-preset', el)) ligarCard(c)
  }
  el.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-filtro]')
    if (f) {
      filtro = f.dataset.filtro
      return desenhar()
    }
    if (e.target.closest('[data-recomendados]')) return recomendados(ps, ordem, (o) => {
      ordem = o
      desenhar()
    })
    const b = e.target.closest('[data-aprovar]')
    if (!b) return
    const c = b.closest('.card-preset')
    const p = ps.find((x) => x.id === c.dataset.id)
    try {
      Object.assign(p, await enviar('PUT', `/api/presets/${p.id}`, { aprovado: !p.aprovado }))
      c.outerHTML = card(p)
      ligarCard($(`.card-preset[data-id="${p.id}"]`, el))
      aviso(p.aprovado ? `“${p.nome}” aprovado` : `“${p.nome}” voltou para a revisão`)
    } catch (x) {
      aviso(x.message, 'erro')
    }
  })
  desenhar()
}

/** Os recomendados por situação (§8.16 do 18): os aprovados que valem em cada situação, na ordem; arrastar reordena e a
 *  estrela favorita até 3 (sempre no começo). Grava em presets/ordem.json, no mesmo formato. */
function recomendados(ps, ordem, mudou) {
  let sit = { tela: 'vertical', n: 1, prop: 'pe' }
  const valem = (s) => ps.filter((p) => p.aprovado && serve(p, s))
  const { el } = janela(`<header class="janela-cabeca"><h2>Recomendados por situação</h2>
      <span class="dica">Arraste para ordenar. A ★ favorita até ${N_RECOMENDADOS}: eles ficam no começo e são os recomendados de cada situação.</span>
      <button class="botao-icone" data-fechar title="Fechar (Esc)">${ICONE.fechar}</button></header>
    <div class="recomendados"><nav class="situacoes"></nav><section class="situacao"></section></div>`, { classe: 'janela-cheia' })
  const nav = $('.situacoes', el)
  const corpo = $('.situacao', el)
  let ids = []
  let nFav = 0
  const salvar = async (novos, favoritos) => {
    const chave = situacao(sit.tela, sit.n, sit.prop)
    try {
      ordem = await enviar('PUT', '/api/presets/ordem', { chave, ids: novos, favoritos })
      mudou(ordem)
    } catch (x) {
      aviso(x.message, 'erro')
    }
    desenhar()
  }
  const desenharNav = () => {
    nav.innerHTML = Object.entries(TELAS).map(([tela, nome]) => `<div class="grupo-situacao"><span class="eyebrow">${nome}</span><div>${VARIANTES.map((v) => {
      const s = { tela, n: v.n, prop: v.prop }
      const nf = ordem[situacao(tela, v.n, v.prop)]?.favoritos || 0
      const ativa = situacao(tela, v.n, v.prop) === situacao(sit.tela, sit.n, sit.prop)
      return chip(ativa, `${v.nome} <span class="conta">${valem(s).length}</span>${nf ? ` <span class="t-fav">★${nf}</span>` : ''}`, `data-sit="${tela}|${v.n}|${v.prop || ''}"`)
    }).join('')}</div></div>`).join('')
  }
  const cardRec = (p, i) => {
    const fav = i < nFav
    const cheio = !fav && nFav >= N_RECOMENDADOS
    const u = usosDe(p)
    return `<div class="card-rec${fav ? ' fav' : ''}" draggable="true" data-id="${p.id}">
      <div class="mini mini-916"><video muted loop playsinline preload="metadata" src="/biblioteca/presets/clipes/${p.id}.mp4#t=0.05"></video>
        <span class="ordem-num">${i + 1}</span>
        <button class="estrela${fav ? ' ligada' : ''}" data-estrela ${cheio ? 'disabled' : ''} title="${fav ? 'Tirar dos recomendados' : cheio ? `Já há ${N_RECOMENDADOS} favoritos: tire um antes` : 'Favoritar (recomendado nesta situação)'}">${fav ? ESTRELA_CHEIA : ICONE.estrela}</button></div>
      <b>${esc(p.nome)}</b><span class="dica">${(u.proporcoes || Object.keys(PROPORCOES)).map((x) => PROPORCOES[x]).join(' · ')}</span></div>`
  }
  const desenhar = () => {
    desenharNav()
    const chave = situacao(sit.tela, sit.n, sit.prop)
    const o = ordem[chave]
    const l = valem(sit)
    const pos = (p) => (o?.ids?.includes(p.id) ? o.ids.indexOf(p.id) : 1e9)
    const ordenados = o?.ids?.length ? [...l].sort((a, b) => pos(a) - pos(b)) : l
    const favs = new Set((o?.ids || []).slice(0, o?.favoritos || 0))
    nFav = ordenados.filter((p) => favs.has(p.id)).length
    ids = [...ordenados.filter((p) => favs.has(p.id)), ...ordenados.filter((p) => !favs.has(p.id))].map((p) => p.id)
    const nomeVar = VARIANTES.find((v) => v.n === sit.n && (v.prop || '') === (sit.prop || '')).nome
    corpo.innerHTML = `<p class="titulo-situacao"><b>${TELAS[sit.tela]} · ${nomeVar}</b> <span class="dica">${nFav}/${N_RECOMENDADOS} favoritos</span>
        ${o ? '<button class="link" data-limpar title="Volta a uma lista só, sem recomendados">Limpar a ordem</button>' : ''}</p>
      ${ids.length ? `<div class="grade-rec">${ids.map((id, i) => cardRec(ps.find((p) => p.id === id), i)).join('')}</div>` : '<p class="dica">Nenhum preset aprovado vale nesta situação (veja o “Vale em” de cada um).</p>'}`
    for (const c of $$('.card-rec', corpo)) tocarNoHover(c, $('video', c))
  }
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sit]')
    if (!b) return
    const [tela, n, prop] = b.dataset.sit.split('|')
    sit = { tela, n: +n, prop: prop || undefined }
    desenhar()
  })
  corpo.addEventListener('click', (e) => {
    if (e.target.closest('[data-limpar]')) return salvar([], 0)
    const b = e.target.closest('[data-estrela]')
    if (!b) return
    const id = b.closest('.card-rec').dataset.id
    const fav = ids.indexOf(id) < nFav
    const novos = ids.filter((x) => x !== id)
    novos.splice(fav ? nFav - 1 : nFav, 0, id) // favoritar põe no fim dos favoritos; desfavoritar, logo depois deles
    salvar(novos, nFav + (fav ? -1 : 1))
  })
  // arrastar: os cards mudam de lugar enquanto arrasta (o que cai entre os favoritos vira favorito; o último sai)
  let arrastando = null
  corpo.addEventListener('dragstart', (e) => {
    const c = e.target.closest('.card-rec')
    if (!c) return
    arrastando = c
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', c.dataset.id)
    requestAnimationFrame(() => c.classList.add('arrastando'))
  })
  corpo.addEventListener('dragover', (e) => {
    if (!arrastando) return
    e.preventDefault()
    const alvo = e.target.closest('.card-rec')
    if (!alvo || alvo === arrastando) return
    const grade = alvo.parentElement
    const todos = [...grade.children]
    grade.insertBefore(arrastando, todos.indexOf(arrastando) < todos.indexOf(alvo) ? alvo.nextSibling : alvo)
  })
  corpo.addEventListener('drop', (e) => {
    if (!arrastando) return
    e.preventDefault()
    const novos = $$('.card-rec', corpo).map((c) => c.dataset.id)
    arrastando = null
    if (novos.join() !== ids.join()) salvar(novos, nFav)
    else desenhar()
  })
  corpo.addEventListener('dragend', () => {
    if (arrastando) desenhar() // soltou fora: volta
    arrastando = null
  })
  desenhar()
}

// ---------- Transições ----------

const GRUPOS = [['ator', 'Full ator'], ['dividida', 'Tela dividida'], ['cheia', 'Tela cheia']]
const NOME_GRUPO = Object.fromEntries(GRUPOS)
const EFEITOS = { seco: 'Corte seco', luz: 'Luz colorida', brilho: 'Brilho', zoom: 'Zoom com desfoque' }
const INTENSIDADE = { baixo: 'baixo', medio: 'médio', alto: 'alto' }
const N_FAVORITAS = 2
/** O grupo de um plano para as transições (§8.8 do 18): Full ator · Tela dividida (com o comentário) · Tela cheia. */
const grupoDe = (tipo) => (tipo.startsWith('full_ator') ? 'ator' : tipo.startsWith('tela_dividida') || tipo === 'comentario_insert_ator' ? 'dividida' : 'cheia')

async function transicoes(el, resto) {
  const [ts, ordem0, pares, sons] = await Promise.all([
    jsons('biblioteca/transicoes', ['ordem.json', 'pares.json']),
    json('/biblioteca/transicoes/ordem.json', {}),
    json('/biblioteca/transicoes/pares.json', {}),
    nomesDosSons(),
  ])
  let ordem = ordem0 || {}
  const porId = Object.fromEntries(ts.map((t) => [t.id, t]))
  ts.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const par = /^(ator|dividida|cheia)>(ator|dividida|cheia)$/.test(resto[0] || '') ? resto[0] : null
  // os cortes das referências em cada par de grupos (pares.json é por par de categorias)
  const cortes = {}
  for (const [k, v] of Object.entries(pares || {})) {
    const [de, para] = k.split('>')
    const g = `${grupoDe(de)}>${grupoDe(para)}`
    ;(cortes[g] ||= { n: 0, sons: {}, cortes: [] }).n += v.n || 0
    for (const [s, q] of Object.entries(v.sons || {})) cortes[g].sons[s] = (cortes[g].sons[s] || 0) + q
    cortes[g].cortes.push(...(v.cortes || []).map((c) => ({ ...c, par: k })))
  }
  /** A ordem do par: as ids (todas as transições, as que faltam no fim) e quantas são favoritas. */
  const ordemDo = (g) => {
    const o = ordem[`familia:${g}`]
    const ids = (o?.ids || []).filter((id) => porId[id])
    for (const t of ts) if (!ids.includes(t.id)) ids.push(t.id)
    return { ids, favoritas: Math.min(o?.favoritas ?? 0, ids.length) }
  }
  const padraoDo = (g) => {
    const o = ordemDo(g)
    return o.favoritas ? porId[o.ids[0]].nome : 'Corte seco'
  }
  const efeito = (e) => {
    if (!e || e.tipo === 'seco') return 'Corte seco'
    return `${EFEITOS[e.tipo] || e.tipo} <span class="apagado">· ${num(e.antes, 2)} s antes / ${num(e.depois, 2)} s depois</span>`
  }
  const som = (s) => (s?.som ? `${ICONE.som}${esc(sons[s.som] || s.som)} <span class="apagado">· ${esc(INTENSIDADE[s.intensidade] || s.intensidade || '')}${s.atraso ? ` · ${num(s.atraso, 2)} s` : ''}</span>` : '<span class="apagado">sem som</span>')

  const card = (t, { k = -1, nFav = 0 } = {}) => {
    const fav = k >= 0 && k < nFav
    return `<article class="card-transicao" id="tr-${t.id}" data-id="${t.id}">
      <div class="mini mini-916"><video playsinline preload="metadata" src="/biblioteca/transicoes/clipes/${t.id}.mp4#t=1.4"></video>
        <span class="selo ${t.aprovado ? 'selo-menta' : 'selo-coral'}">${t.aprovado ? 'Aprovada' : 'A revisar'}</span>
        ${par && k === 0 && fav ? '<span class="selo selo-amarelo selo-dir">Padrão do par</span>' : ''}
        <button class="video-tocar" data-tocar="${t.id}" aria-label="Tocar com som">${ICONE.tocar}</button>
        <span class="sem-clipe">sem clipe de referência</span></div>
      <div class="card-titulo"><h3>${esc(t.nome)}</h3>
        ${par ? `<button class="estrela${fav ? ' ligada' : ''}" data-estrela title="${fav ? 'Tirar das favoritas do par' : 'Favorita deste par'}">${fav ? ESTRELA_CHEIA : ICONE.estrela}</button>` : ''}
        ${botaoAprovar(t.aprovado)}</div>
      ${par && k === 1 && fav ? '<button class="link" data-padrao>Tornar o padrão do par</button>' : ''}
      <p class="desc">${esc(t.descricao || '')}</p>
      <dl class="dados"><dt>Efeito</dt><dd>${efeito(t.efeito)}</dd><dt>Som</dt><dd>${som(t.som)}</dd></dl>
    </article>`
  }

  const lado = `<aside class="lado-pares">
      <a class="par-link${par ? '' : ' ativo'}" href="#/transicoes"><b>Todas as transições</b><span class="conta">${ts.length}</span><small>ver, ouvir e aprovar</small></a>
      <span class="eyebrow">De onde sai → para onde vai</span>
      ${GRUPOS.map(([de, nomeDe]) => `<div class="grupo-pares"><span class="grupo-nome">${nomeDe}<span class="conta">${GRUPOS.reduce((n, [para]) => n + (cortes[`${de}>${para}`]?.n || 0), 0)}</span></span>
        ${GRUPOS.map(([para, nomePara]) => `<a class="par-link${par === `${de}>${para}` ? ' ativo' : ''}" href="#/transicoes/${de}>${para}"><span>→ ${nomePara}</span><span class="conta">${cortes[`${de}>${para}`]?.n || 0}</span><small>${esc(padraoDo(`${de}>${para}`))}</small></a>`).join('')}</div>`).join('')}
    </aside>`

  let conteudo
  if (!par) {
    conteudo = cabeca(`Transições · ${dois(ts.length)}`, 'Como o vídeo passa de um plano para o outro. Clique num card para ver o corte da referência com som. As favoritas de cada par ficam nos pares, à esquerda.') +
      `<div class="grade grade-transicoes">${ts.map((t) => card(t)).join('')}</div>`
  } else {
    const [de, para] = par.split('>')
    const o = ordemDo(par)
    const c = cortes[par] || { n: 0, sons: {}, cortes: [] }
    const sonsPar = Object.entries(c.sons).sort((a, b) => b[1] - a[1]).map(([s, q]) => `${esc(sons[s] || s)} ×${q}`)
    const favs = o.ids.slice(0, o.favoritas)
    const outras = o.ids.slice(o.favoritas)
    conteudo = cabeca(`${NOME_GRUPO[de]} → ${NOME_GRUPO[para]}`, c.n ? `${c.n} cortes nas referências · ${sonsPar.length ? `sons: ${sonsPar.join(', ')}` : 'sem som de corte'}` : 'Nenhum corte assim nas referências.') +
      `<h4 class="subtitulo">Favoritas do par <span class="dica">· no máximo ${N_FAVORITAS}; a 1ª é o padrão (entra sozinha em cada corte deste par)</span></h4>
      ${favs.length ? `<div class="grade grade-transicoes">${favs.map((id, k) => card(porId[id], { k, nFav: favs.length })).join('')}</div>` : '<p class="dica">Nenhuma favorita: os cortes deste par ficam secos. Marque a estrela de uma transição.</p>'}
      <h4 class="subtitulo">Outras transições</h4>
      <div class="grade grade-transicoes">${outras.map((id, j) => card(porId[id], { k: favs.length + j, nFav: favs.length })).join('')}</div>
      ${c.cortes.length ? `<h4 class="subtitulo">Os cortes deste par nas referências <span class="dica">· de 1,5 s antes a 1,5 s depois, com som</span></h4>
        <div class="cortes-par"><div class="mini mini-916 previa-corte"><video playsinline preload="none"></video></div>
          <div class="chips-cortes">${c.cortes.map((x, i) => `<button class="pilula pequena" data-corte="${i}" title="${esc(x.par.replace('>', ' → '))} · ${esc(x.classe || 'seco')}${x.sons?.length ? ` · ${esc(x.sons.join(', '))}` : ''}">${esc(x.ref)} · ${mmss(x.t)}${x.sons?.length ? ' 🔊' : ''}</button>`).join('')}</div></div>` : ''}`
  }
  el.innerHTML = `<div class="com-lado">${lado}<div class="lado-conteudo">${conteudo}</div></div>`

  let atual = null
  const tocar = (id) => {
    const cardEl = $(`#tr-${id}`, el)
    const v = cardEl && $('video', cardEl)
    if (!v) return
    for (const x of $$('video', el)) if (x !== v) x.pause()
    if (v.paused) {
      v.currentTime = 0
      v.play().catch(() => {})
      if (atual !== id) cardEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    } else v.pause()
    atual = id
  }
  for (const c of $$('.card-transicao', el)) {
    const v = $('video', c)
    v.addEventListener('error', () => c.classList.add('sem-video'))
    v.addEventListener('play', () => c.classList.add('tocando'))
    for (const ev of ['pause', 'ended']) v.addEventListener(ev, () => c.classList.remove('tocando'))
    $('.mini', c).addEventListener('click', () => tocar(c.dataset.id))
  }
  let pararCorte = null
  const salvarOrdem = async (ids, favoritas) => {
    try {
      ordem = await enviar('PUT', '/api/transicoes/ordem', { chave: `familia:${par}`, ids, favoritas })
    } catch (x) {
      aviso(x.message, 'erro')
    }
    transicoes(el, resto)
  }
  el.onclick = async (e) => {
    const b = e.target.closest('[data-aprovar], [data-estrela], [data-padrao], [data-corte]')
    if (!b) return
    if (b.dataset.corte != null) {
      const x = cortes[par].cortes[+b.dataset.corte]
      const v = $('.previa-corte video', el)
      for (const y of $$('video', el)) if (y !== v) y.pause()
      for (const y of $$('[data-corte]', el)) y.classList.toggle('ativa', y === b)
      pararCorte?.()
      v.muted = false
      v.src = urlRef(x.ref, 'proxy.mp4')
      pararCorte = tocarTrecho(v, Math.max(0, x.t - 1.5), x.t + 1.5)
      return
    }
    const t = porId[b.closest('.card-transicao').dataset.id]
    if (b.dataset.aprovar != null) {
      try {
        Object.assign(t, await enviar('PUT', `/api/transicoes/${t.id}`, { aprovado: !t.aprovado }))
        aviso(t.aprovado ? `“${t.nome}” aprovada` : `“${t.nome}” voltou para a revisão`)
      } catch (x) {
        return aviso(x.message, 'erro')
      }
      return transicoes(el, resto)
    }
    const { ids, favoritas } = ordemDo(par)
    const k = ids.indexOf(t.id)
    const sem = ids.filter((id) => id !== t.id)
    if (b.dataset.padrao != null) return salvarOrdem([t.id, ...sem], favoritas)
    if (k < favoritas) {
      sem.splice(favoritas - 1, 0, t.id) // tirar: logo depois das favoritas
      return salvarOrdem(sem, favoritas - 1)
    }
    if (favoritas < N_FAVORITAS) {
      sem.splice(favoritas, 0, t.id) // marcar: no fim das favoritas
      return salvarOrdem(sem, favoritas + 1)
    }
    sem.splice(N_FAVORITAS - 1, 0, t.id) // uma terceira: entra no lugar da 2ª, que vai para as outras
    return salvarOrdem(sem, N_FAVORITAS)
  }
  return () => pararCorte?.()
}

// ---------- Motions ----------

async function motions(el) {
  const nomes = (await lista('biblioteca/motions/presets')).filter((n) => n.endsWith('.html'))
  const temRender = await fetch('/render/motion.html', { cache: 'no-store' }).then((r) => r.ok, () => false)
  const ler = async (n) => {
    const html = await fetch(`/biblioteca/motions/presets/${n}`, { cache: 'no-store' }).then((r) => r.text())
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const dado = (id) => {
      try {
        return JSON.parse(doc.getElementById(id)?.textContent || 'null')
      } catch {
        return null
      }
    }
    return { id: n.replace(/\.html$/, ''), ...(dado('preset') || {}), campos: dado('campos') || {} }
  }
  const ms = await Promise.all(nomes.map(ler))
  ms.sort((a, b) => (b.a_revisar ? 1 : 0) - (a.a_revisar ? 1 : 0) || (a.nome || a.id).localeCompare(b.nome || b.id, 'pt-BR'))
  const sons = await nomesDosSons()
  const nRevisar = ms.filter((m) => m.a_revisar).length
  const cards = ms.map((m) => {
    const campos = Object.values(m.campos).map((c) => c.rotulo).filter(Boolean)
    const sonsM = Object.values(m.sons || {}).map((s) => esc(sons[s.som] || s.som))
    const previa = temRender
      ? `<iframe src="/render/motion.html?preset=${encodeURIComponent(m.id)}&formato=vertical&tocar=1" loading="lazy" tabindex="-1" title="${esc(m.nome)}"></iframe>`
      : `<div class="sem-previa"><b>${esc(m.nome || m.id)}</b><span>a prévia vem da página de render</span></div>`
    return `<article class="card-motion" data-id="${esc(m.id)}">
      <div class="mini mini-916 fundo-${esc(m.fundo || 'escuro')}">${previa}${m.a_revisar ? '<span class="selo selo-coral">A revisar</span>' : ''}</div>
      <div class="card-titulo"><h3>${esc(m.nome || m.id)}</h3>${m.a_revisar ? `<button class="botao pequeno" data-aprovar title="Tira a marca “a revisar”">${ICONE.check} Aprovar</button>` : ''}</div>
      <p class="desc">${esc(m.descricao || '')}</p>
      <dl class="dados"><dt>Campos</dt><dd>${campos.length ? campos.map(esc).join(' · ') : '<span class="apagado">nenhum</span>'}</dd>
        <dt>Duração</dt><dd>${m.duracao ? seg(m.duracao) : '—'}</dd>
        ${sonsM.length ? `<dt>Sons</dt><dd>${sonsM.join(' · ')}</dd>` : ''}
        <dt>Id</dt><dd class="apagado">${esc(m.id)}</dd></dl>
    </article>`
  })
  el.innerHTML = cabeca(`Motions · ${dois(ms.length)}${nRevisar ? ` · ${nRevisar} a revisar` : ''}`, temRender ? 'As animações de tela cheia e dividida, tocando em loop no formato vertical. Os novos chegam “a revisar”: aprove os que ficaram bons.' : 'As animações de tela cheia e dividida. A prévia tocando aparece quando a página de render (render/motion.html) existir.') +
    `<div class="grade grade-motions">${cards.join('')}</div>`
  el.onclick = async (e) => {
    const b = e.target.closest('[data-aprovar]')
    if (!b) return
    const c = b.closest('.card-motion')
    try {
      await enviar('PUT', `/api/motions/${encodeURIComponent(c.dataset.id)}/aprovar`)
      $('.selo-coral', c)?.remove()
      b.remove()
      aviso('Motion aprovado')
    } catch (x) {
      aviso(x.message, 'erro')
    }
  }
}

// ---------- Trilhas ----------

async function trilhas(el) {
  const cat = await json('/biblioteca/trilhas/catalogo.json', { faixas: [] })
  const faixas = cat?.faixas || (Array.isArray(cat) ? cat : [])
  el.innerHTML = cabeca(`Trilhas · ${dois(faixas.length)}`, 'As músicas de fundo (instrumentais, para tocar baixo sob a voz).') +
    `<div class="lista-trilhas">${faixas.map((f) => `<div class="trilha" data-id="${esc(f.id)}">
        <button class="botao-icone botao-tocar" data-src="/biblioteca/trilhas/${esc(f.arquivo || `${f.id}.m4a`)}" aria-label="Ouvir">${ICONE.tocar}</button>
        <div class="trilha-nome"><b>${esc(f.nome)}</b><span class="apagado">${esc(f.id)}</span></div>
        <span class="trilha-clima">${esc(f.clima || '')}</span>
        <span class="trilha-num">${f.bpm ? `${Math.round(f.bpm)} BPM` : ''}</span>
        <span class="trilha-num">${f.duracao ? mmss(f.duracao) : ''}</span>
        <div class="trilha-barra"><i></i></div>
      </div>`).join('')}</div>`
  const audio = new Audio()
  let linha = null
  const marcar = (tocando) => {
    for (const t of $$('.trilha', el)) {
      const ativa = t === linha && tocando
      t.classList.toggle('tocando', ativa)
      $('button', t).innerHTML = ativa ? ICONE.pausar : ICONE.tocar
    }
  }
  audio.addEventListener('timeupdate', () => linha && ($('.trilha-barra i', linha).style.width = `${(audio.currentTime / (audio.duration || 1)) * 100}%`))
  audio.addEventListener('pause', () => marcar(false))
  audio.addEventListener('play', () => marcar(true))
  for (const b of $$('.trilha button', el))
    b.addEventListener('click', () => {
      const t = b.closest('.trilha')
      if (linha === t && !audio.paused) return audio.pause()
      if (linha !== t) {
        if (linha) $('.trilha-barra i', linha).style.width = '0'
        linha = t
        audio.src = b.dataset.src
      }
      audio.play().catch(() => {})
    })
  return () => audio.pause()
}
