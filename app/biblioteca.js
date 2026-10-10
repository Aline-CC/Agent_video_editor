// A biblioteca, só para ver: banco de inserts, presets, transições, motions e trilhas (o Claude é quem usa e cria).
import { $, $$, ICONE, esc, json, lista, mmss, num, seg } from './comum.js'

const ABAS = [
  ['banco', 'Banco'],
  ['presets', 'Presets'],
  ['transicoes', 'Transições'],
  ['motions', 'Motions'],
  ['trilhas', 'Trilhas'],
]

export async function abrirBiblioteca(tela, aba) {
  if (!ABAS.some(([id]) => id === aba)) aba = 'banco'
  tela.className = 'pagina pagina-biblioteca'
  tela.innerHTML = `<nav class="subabas">${ABAS.map(([id, nome]) => `<a class="pilula${id === aba ? ' ativa' : ''}" href="#/biblioteca/${id}">${nome}</a>`).join('')}
      <span class="dica">Só para ver: o Claude escolhe e cria; peça a ele no chat.</span></nav>
    <div class="conteudo-biblioteca" id="conteudo-biblioteca"><p class="vazio">Carregando…</p></div>`
  const el = $('#conteudo-biblioteca')
  const sair = await { banco, presets, transicoes, motions, trilhas }[aba](el)
  return () => {
    for (const m of $$('video, audio', tela)) m.pause()
    sair?.()
  }
}

/** Os JSONs de uma pasta (menos os que não são itens). */
async function jsons(pasta, fora = []) {
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

const cabeca = (titulo, texto) => `<div class="cabeca-secao"><span class="eyebrow">${titulo}</span><span class="dica">${texto}</span></div>`

// ---------- Banco ----------

async function banco(el) {
  const ids = (await lista('biblioteca/banco')).filter((n) => n.endsWith('/')).map((n) => n.slice(0, -1))
  const itens = (await Promise.all(ids.map((id) => json(`/biblioteca/banco/${id}/item.json`).then((it) => it && { ...it, id: it.id || id })))).filter(Boolean)
  const originais = itens.filter((i) => !i.pai).sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''))
  const trechos = {}
  for (const t of itens.filter((i) => i.pai)) (trechos[t.pai] ||= []).push(t)
  for (const l of Object.values(trechos)) l.sort((a, b) => a.inicio - b.inicio)

  const origem = (o) => {
    if (!o) return ''
    if (o.url) {
      const curto = o.url.replace(/^https?:\/\//, '').replace(/[#?].*$/, '')
      return `${o.tipo === 'captura de site' ? 'Captura de site' : esc(o.tipo || 'Link')} · <a href="${esc(o.url)}" target="_blank" rel="noopener" title="${esc(o.url)}">${esc(curto)}</a>`
    }
    if (o.tipo === 'upload') return `Upload${o.nome_original ? ` · ${esc(o.nome_original)}` : ''}`
    return esc(o.tipo || '')
  }
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
      <p class="origem">${origem(it.origem)}</p>
      ${ts.length ? `<ul class="trechos">${ts.map((t) => `<li data-ini="${t.inicio}" data-fim="${t.fim}"><span>${esc(t.nome)}</span><span class="apagado">${seg(t.fim - t.inicio)}</span></li>`).join('')}</ul>` : ''}
    </article>`
  })
  el.innerHTML = cabeca(`Banco · ${String(originais.length).padStart(2, '0')} mídias`, 'Os vídeos e imagens dos inserts, de todos os projetos. Passe o mouse para tocar; os trechos ficam embaixo de cada original.') +
    (originais.length ? `<div class="grade grade-banco">${cards.join('')}</div>` : '<p class="vazio">O banco está vazio.</p>')

  for (const card of $$('.card-banco', el)) {
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

// ---------- Presets ----------

const TELAS = { dividida: 'Tela dividida', vertical: 'Tela cheia', atras: 'Ator embaixo' }
const MIDIAS = { 1: '1 mídia', 2: '2 mídias', '2+': '3 ou mais' }
const PROPORCOES = { pe: '9:16', quadrada: 'Quadrada', deitada: 'Horizontal' }
const nMidias = (r) => Math.max(1, ...(r?.cards || []).map((c, k) => (c.midia ?? k) + 1))
/** Onde o preset vale (como o `usosDe` do 18): o marcado, ou o que a receita suporta. */
function usosDe(p) {
  if (p.usos) return p.usos
  const telas = p.formatos || ['dividida', 'vertical']
  const n = nMidias(p.receita)
  return { telas: telas.includes('dividida') ? [...telas, 'atras'] : telas, midias: p.receita?.repete ? ['2', '2+'] : [n <= 1 ? '1' : n === 2 ? '2' : '2+'] }
}
/** As situações de ordem.json ("dividida:1:pe") em que o preset é favorito, juntas por tela: "Tela dividida: 1 em pé · 2". */
function favoritasPorTela(chaves) {
  const curto = (n, prop) => (n === '1' ? (prop === 'pe' ? '1 em pé' : '1 horizontal') : n === '2+' ? '3 ou mais' : `${n}`)
  const por = {}
  for (const c of chaves) {
    const [tela, n, prop] = c.split(':')
    ;(por[tela] ||= []).push(curto(n, prop))
  }
  return Object.entries(por).map(([tela, l]) => `<b>${TELAS[tela] || tela}</b> ${l.join(' · ')}`)
}

async function presets(el) {
  const [ps, ordem, sons] = await Promise.all([jsons('biblioteca/presets', ['ordem.json']), json('/biblioteca/presets/ordem.json', {}), nomesDosSons()])
  ps.sort((a, b) => (b.aprovado ? 1 : 0) - (a.aprovado ? 1 : 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
  const favoritas = {}
  for (const [chave, o] of Object.entries(ordem || {})) for (const id of (o.ids || []).slice(0, o.favoritos || 0)) (favoritas[id] ||= []).push(chave)

  const cards = ps.map((p) => {
    const u = usosDe(p)
    const fonte = p.fontes?.[0]
    const sonsP = (p.receita?.sons || []).map((s) => `${esc(sons[s.som] || s.som)}${s.momento ? ` <span class="apagado">(${esc(s.momento)})</span>` : ''}`)
    const fav = favoritas[p.id] || []
    return `<article class="card-preset">
      <div class="mini mini-916"><video muted loop playsinline preload="metadata" src="/biblioteca/presets/clipes/${p.id}.mp4#t=0.05"></video>
        <span class="selo ${p.aprovado ? 'selo-menta' : 'selo-coral'}">${p.aprovado ? 'Aprovado' : 'A revisar'}</span>
        ${fav.length ? `<span class="selo selo-amarelo selo-dir" title="Favorito em ${fav.length} situações">★ ${fav.length}</span>` : ''}
        <span class="sem-clipe">sem clipe de referência</span></div>
      <h3>${esc(p.nome)}</h3>
      <p class="desc">${esc(p.descricao || '')}</p>
      <dl class="dados">
        <dt>Vale em</dt><dd>${u.telas.map((t) => TELAS[t] || t).join(' · ')}</dd>
        <dt>Mídias</dt><dd>${u.midias.map((m) => MIDIAS[m] || m).join(' · ')}${u.proporcoes ? ` <span class="apagado">(${u.proporcoes.map((x) => PROPORCOES[x] || x).join(', ')})</span>` : ''}</dd>
        <dt>Sons</dt><dd>${sonsP.length ? sonsP.join(' · ') : '<span class="apagado">nenhum</span>'}</dd>
        ${fonte ? `<dt>Referência</dt><dd>${esc(String(fonte.ref).replace(/^externa:/, ''))} ${mmss(fonte.inicio)}${p.fontes.length > 1 ? ` <span class="apagado">+${p.fontes.length - 1}</span>` : ''}</dd>` : ''}
        ${fav.length ? `<dt class="t-fav">★ Favorito</dt><dd class="favoritas">${favoritasPorTela(fav).join('<br>')}</dd>` : ''}
      </dl>
    </article>`
  })
  el.innerHTML = cabeca(`Presets · ${String(ps.length).padStart(2, '0')}`, 'Os movimentos dos inserts, recriados das referências. Passe o mouse para ver o trecho de onde veio; ★ = favorito em alguma situação.') +
    `<div class="grade grade-presets">${cards.join('')}</div>`
  for (const card of $$('.card-preset', el)) {
    const v = $('video', card)
    v.addEventListener('error', () => card.classList.add('sem-video'))
    tocarNoHover(card, v)
  }
}

// ---------- Transições ----------

const GRUPOS = [['ator', 'Full ator'], ['dividida', 'Tela dividida'], ['cheia', 'Tela cheia']]
const EFEITOS = { seco: 'Corte seco', luz: 'Luz colorida', brilho: 'Brilho', zoom: 'Zoom com desfoque' }
const INTENSIDADE = { baixo: 'baixo', medio: 'médio', alto: 'alto' }

async function transicoes(el) {
  const [ts, ordem, sons] = await Promise.all([jsons('biblioteca/transicoes', ['ordem.json', 'pares.json']), json('/biblioteca/transicoes/ordem.json', {}), nomesDosSons()])
  const porId = Object.fromEntries(ts.map((t) => [t.id, t]))
  ts.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const efeito = (e) => {
    if (!e || e.tipo === 'seco') return 'Corte seco'
    return `${EFEITOS[e.tipo] || e.tipo} <span class="apagado">· ${num(e.antes, 2)} s antes / ${num(e.depois, 2)} s depois</span>`
  }
  const som = (s) => (s?.som ? `${ICONE.som}${esc(sons[s.som] || s.som)} <span class="apagado">· ${esc(INTENSIDADE[s.intensidade] || s.intensidade || '')}${s.atraso ? ` · ${num(s.atraso, 2)} s` : ''}</span>` : '<span class="apagado">sem som</span>')

  const linhas = GRUPOS.map(([de, nomeDe]) => `<tr><th scope="row">${nomeDe} →</th>${GRUPOS.map(([para]) => {
    const o = ordem?.[`familia:${de}>${para}`]
    const favs = (o?.ids || []).slice(0, o?.favoritas ?? 0).filter((id) => porId[id])
    return `<td>${favs.length ? favs.map((id, k) => `<button class="fav-transicao" data-tocar="${id}">${k === 0 ? '<b>1</b>' : '<b class="apagado">2</b>'} ${esc(porId[id].nome)}</button>`).join('') : '<span class="apagado">Corte seco</span>'}</td>`
  }).join('')}</tr>`).join('')

  const cards = ts.map((t) => `<article class="card-transicao" id="tr-${t.id}">
      <div class="mini mini-916"><video playsinline preload="metadata" src="/biblioteca/transicoes/clipes/${t.id}.mp4#t=1.4"></video>
        <span class="selo ${t.aprovado ? 'selo-menta' : 'selo-coral'}">${t.aprovado ? 'Aprovada' : 'A revisar'}</span>
        <button class="video-tocar" data-tocar="${t.id}" aria-label="Tocar com som">${ICONE.tocar}</button>
        <span class="sem-clipe">sem clipe de referência</span></div>
      <h3>${esc(t.nome)}</h3>
      <p class="desc">${esc(t.descricao || '')}</p>
      <dl class="dados"><dt>Efeito</dt><dd>${efeito(t.efeito)}</dd><dt>Som</dt><dd>${som(t.som)}</dd></dl>
    </article>`)

  el.innerHTML = cabeca(`Transições · ${String(ts.length).padStart(2, '0')}`, 'Como o vídeo passa de um plano para o outro. Clique num card para ver o corte da referência com som.') +
    `<div class="tabela-pares"><span class="eyebrow">As favoritas de cada par · de onde sai → para onde vai</span>
      <table><thead><tr><th></th>${GRUPOS.map(([, n]) => `<th scope="col">→ ${n}</th>`).join('')}</tr></thead><tbody>${linhas}</tbody></table>
      <p class="dica">A 1ª é o padrão do par (entra sozinha em cada corte); a 2ª é a alternativa.</p></div>
    <div class="grade grade-transicoes">${cards.join('')}</div>`

  let atual = null
  const tocar = (id) => {
    const card = $(`#tr-${id}`, el)
    const v = card && $('video', card)
    if (!v) return
    for (const x of $$('video', el)) if (x !== v) x.pause()
    if (v.paused) {
      v.currentTime = 0
      v.play().catch(() => {})
      if (atual !== id) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    } else v.pause()
    atual = id
  }
  for (const card of $$('.card-transicao', el)) {
    const v = $('video', card)
    v.addEventListener('error', () => card.classList.add('sem-video'))
    v.addEventListener('play', () => card.classList.add('tocando'))
    for (const ev of ['pause', 'ended']) v.addEventListener(ev, () => card.classList.remove('tocando'))
    $('.mini', card).addEventListener('click', () => tocar(card.id.slice(3)))
  }
  for (const b of $$('.fav-transicao', el)) b.addEventListener('click', () => tocar(b.dataset.tocar))
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
  const sons = await nomesDosSons()
  const cards = ms.map((m) => {
    const campos = Object.values(m.campos).map((c) => c.rotulo).filter(Boolean)
    const sonsM = Object.values(m.sons || {}).map((s) => esc(sons[s.som] || s.som))
    const previa = temRender
      ? `<iframe src="/render/motion.html?preset=${encodeURIComponent(m.id)}&formato=vertical&tocar=1" loading="lazy" tabindex="-1" title="${esc(m.nome)}"></iframe>`
      : `<div class="sem-previa"><b>${esc(m.nome || m.id)}</b><span>a prévia vem da página de render</span></div>`
    return `<article class="card-motion">
      <div class="mini mini-916 fundo-${esc(m.fundo || 'escuro')}">${previa}</div>
      <h3>${esc(m.nome || m.id)}</h3>
      <p class="desc">${esc(m.descricao || '')}</p>
      <dl class="dados"><dt>Campos</dt><dd>${campos.length ? campos.map(esc).join(' · ') : '<span class="apagado">nenhum</span>'}</dd>
        <dt>Duração</dt><dd>${m.duracao ? seg(m.duracao) : '—'}</dd>
        ${sonsM.length ? `<dt>Sons</dt><dd>${sonsM.join(' · ')}</dd>` : ''}
        <dt>Id</dt><dd class="apagado">${esc(m.id)}</dd></dl>
    </article>`
  })
  el.innerHTML = cabeca(`Motions · ${String(ms.length).padStart(2, '0')}`, temRender ? 'As animações de tela cheia e dividida, tocando em loop no formato vertical.' : 'As animações de tela cheia e dividida. A prévia tocando aparece quando a página de render (render/motion.html) existir.') +
    `<div class="grade grade-motions">${cards.join('')}</div>`
}

// ---------- Trilhas ----------

async function trilhas(el) {
  const cat = await json('/biblioteca/trilhas/catalogo.json', { faixas: [] })
  const faixas = cat?.faixas || (Array.isArray(cat) ? cat : [])
  el.innerHTML = cabeca(`Trilhas · ${String(faixas.length).padStart(2, '0')}`, 'As músicas de fundo (instrumentais, para tocar baixo sob a voz).') +
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
