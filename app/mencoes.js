// as marcações com @ nos comentários da revisão (do seletor que o upstream teve): o @ abre um seletor com as abas da
// barra de cima (Banco, Referências, Motions, Presets, Transições, Áudio, CTAs) e as tags à esquerda; marque quantos
// quiser (em várias abas) e Importar (ou Enter) põe no texto os códigos (@BAN-074 @MOT-03), que o Claude resolve com
// codigo.py. No card do comentário, cada código vira um chip com o nome.
import { $, $$, ICONE, achaBusca, esc, janela, json, preferencia, semAcento } from './comum.js'
import { barraDeTags, temTag } from './tags.js'

// [aba, nome, o ícone (o da aba de cima com o mesmo destino), os tipos dos itens que ela mostra]
const ABAS = [
  ['midia', 'Banco', 'banco', ['midia']], ['referencia', 'Referências', 'referencias', ['referencia']],
  ['motion', 'Motions', 'motions', ['motion']], ['preset', 'Presets', 'presets', ['preset']],
  ['transicao', 'Transições', 'transicoes', ['transicao']], ['audio', 'Áudio', 'trilhas', ['trilha', 'som']], ['cta', 'CTAs', 'ctas', ['cta']],
]
const ORDENS = { uso: 'Usados recentemente', novos: 'Mais novos', nome: 'Nome', codigo: 'Código' }
const MENCAO = /@((?:PRE|MOT|TRA|TRI|BAN|SOM|CTA)-\d+(?:\.\d+)?|REF-\d+·p\d+)/g
const iconeAba = (destino) => (destino && document.querySelector(`.abas [data-aba="${destino}"] svg`)?.outerHTML) || ICONE.tocar

let itens = null // [{codigo, tipo, id, nome, mini?, clipe?, inicio?, fim?, audio?, tags?, usado_em?}]
let porCodigo = new Map()
let aba = 'midia'
const tagDa = {} // a tag escolhida em cada aba (no seletor)
const daAba = (k) => {
  const tipos = ABAS.find((a) => a[0] === k)[3]
  return itens.filter((x) => tipos.includes(x.tipo))
}

/** Carrega a lista uma vez (os chips dos comentários usam o nome). */
export async function carregarMarcaveis() {
  if (itens) return itens
  itens = (await json('/api/marcaveis', { itens: [] })).itens || []
  // o texto da busca: o código, o nome, as tags e a descrição (sem acentos)
  for (const x of itens) x.busca = semAcento([x.codigo, x.nome, ...(x.tags || []).map((t) => `#${t}`), x.texto].join(' '))
  porCodigo = new Map(itens.map((x) => [x.codigo, x]))
  return itens
}

/** O texto de um comentário, escapado, com cada @CÓDIGO como chip (código e nome). */
export function htmlComMencoes(texto) {
  return esc(texto).replace(MENCAO, (m, c) => {
    const x = porCodigo.get(c)
    return `<span class="mencao" title="${esc(x ? `${c} · ${x.nome}` : c)}">@${esc(c)}${x ? `<span class="mencao-nome">${esc(x.nome)}</span>` : ''}</span>`
  })
}

/** O @ acabou de ser digitado no campo (no começo ou depois de um espaço): abre o seletor. */
export function seDigitouArroba(campo, e) {
  if (!e.data?.endsWith('@') || campo.value[campo.selectionStart - 1] !== '@') return
  const p = campo.selectionStart
  const antes = campo.value[p - 2]
  if (p >= 2 && antes && !/\s/.test(antes)) return // e-mail ou palavra@: não é marcação
  abrirSeletor(campo, p - 1)
}

async function abrirSeletor(campo, posArroba) {
  await carregarMarcaveis()
  let importou = false
  const marcados = new Map() // código → item, na ordem em que foram marcados
  let ordem = ORDENS[preferencia('mencao.ordem', 'uso')] ? preferencia('mencao.ordem', 'uso') : 'uso'
  let busca = ''
  let abaEscolhida = aba // a que o criador clicou: a busca só sai dela enquanto ela não tem resultado
  const acha = (x) => !busca.trim() || achaBusca(x.busca, busca)
  const { el, fechar } = janela(`<div class="seletor-mencao">
      <header class="janela-cabeca"><nav class="mencao-abas">${ABAS.map(([k, n, ic]) => `<button class="pilula pequena" data-aba-mencao="${k}">${iconeAba(ic)}${n} <span class="conta">${daAba(k).length}</span></button>`).join('')}</nav>
        <input class="busca mencao-busca" type="search" data-busca-mencao placeholder="Buscar (nome, descrição, código, #tag)" autocomplete="off">
        <label class="caixa mencao-ordem">Ordenar <select data-ordem-mencao>${Object.entries(ORDENS).map(([k, n]) => `<option value="${k}"${k === ordem ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <button class="botao-icone" data-fechar title="Fechar (Esc)">${ICONE.fechar}</button></header>
      <div class="mencao-corpo"><div class="mencao-tags"></div><div class="mencao-grade"></div></div>
      <footer class="mencao-pe"><div class="mencao-escolhidos"></div>
        <span class="dica">Clique para marcar · ▶ toca a prévia · Enter importa · Esc limpa a busca e fecha</span>
        <button class="botao botao-coral" data-importar disabled>Importar</button></footer></div>`, {
    classe: 'janela-mencao',
    aoFechar: () => {
      aba = abaEscolhida // abre de novo na aba que o criador escolheu, não na que a busca mostrou
      parar()
      document.removeEventListener('keydown', tecla, true)
      campo.focus()
      if (!importou) campo.setSelectionRange(posArroba + 1, posArroba + 1)
    },
  })
  // o foco vai para a busca (as teclas não escrevem na caixa do comentário por baixo do modal)
  const campoBusca = $('[data-busca-mencao]', el)
  campoBusca.focus()
  const ordenar = (l) => {
    const cod = (x) => x.codigo.split(/(\d+)/).map((n) => (/^\d+$/.test(n) ? n.padStart(6, '0') : n)).join('')
    const por = {
      uso: (a, b) => (b.usado_em || '').localeCompare(a.usado_em || '') || (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0) || (b.criado_em || '').localeCompare(a.criado_em || '') || cod(a).localeCompare(cod(b)),
      novos: (a, b) => (b.criado_em || '').localeCompare(a.criado_em || '') || cod(b).localeCompare(cod(a)),
      nome: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
      codigo: (a, b) => cod(a).localeCompare(cod(b)),
    }[ordem]
    return [...l].sort(por)
  }
  const lista = () => ordenar(daAba(aba).filter((x) => (!tagDa[aba] || temTag(x.tags, tagDa[aba])) && acha(x)))
  // a prévia: vídeo (o trecho, em laço), motion (a animação) ou áudio; uma de cada vez
  let tocando = null
  function parar() {
    if (!tocando) return
    tocando.parar()
    tocando = null
  }
  const tocar = (card) => {
    const x = porCodigo.get(card.dataset.mencao)
    if (tocando?.card === card) return parar()
    parar()
    const mini = $('.mencao-mini', card)
    let fim = () => {}
    if (x.clipe) {
      const v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      v.src = x.clipe
      v.className = 'mencao-video'
      if (x.inicio == null) v.loop = true
      v.addEventListener('timeupdate', () => x.inicio != null && v.currentTime >= x.fim - 0.05 && (v.currentTime = x.inicio))
      v.addEventListener('loadedmetadata', () => { if (x.inicio != null) v.currentTime = x.inicio; v.play().catch(() => {}) }, { once: true })
      mini.append(v)
      fim = () => v.remove()
    } else if (x.tipo === 'motion') {
      const f = document.createElement('iframe')
      f.src = `/render/motion.html?preset=${encodeURIComponent(x.id)}&formato=vertical&tocar=1`
      f.className = 'mencao-iframe'
      f.tabIndex = -1
      f.style.setProperty('--escala-mencao', String(mini.clientHeight / 1920)) // o palco em pé (1080×1920) cabe na altura do card
      f.style.left = `${(mini.clientWidth - 1080 * (mini.clientHeight / 1920)) / 2}px`
      mini.append(f)
      fim = () => f.remove()
    } else if (x.audio) {
      const a = new Audio(x.audio)
      a.play().catch(() => {})
      fim = () => a.pause()
    }
    card.classList.add('tocando')
    tocando = { card, parar: () => { fim(); card.classList.remove('tocando') } }
  }
  // o rodapé: os marcados (× desmarca) e o botão com a contagem
  const desenharEscolhidos = () => {
    $('.mencao-escolhidos', el).innerHTML = [...marcados.values()].map((x) => `<span class="mencao-escolhido" title="${esc(x.nome)}">@${esc(x.codigo)}<button data-desmarcar="${esc(x.codigo)}" aria-label="Desmarcar ${esc(x.codigo)}">×</button></span>`).join('')
      || '<span class="dica">Nada marcado ainda.</span>'
    const b = $('[data-importar]', el)
    b.disabled = !marcados.size
    b.textContent = marcados.size ? `Importar ${marcados.size} ${marcados.size === 1 ? 'elemento' : 'elementos'}` : 'Importar'
    for (const c of $$('.mencao-card', el)) c.classList.toggle('marcado', marcados.has(c.dataset.mencao))
    for (const t of $$('[data-aba-mencao]', el)) {
      const n = daAba(t.dataset.abaMencao).filter((x) => marcados.has(x.codigo)).length
      t.classList.toggle('com-marcados', n > 0)
      t.dataset.marcados = n || ''
    }
  }
  const desenhar = () => {
    parar()
    // com busca: cada aba conta o que acha, e a aba sem nada passa para a primeira que tem
    aba = !busca.trim() || daAba(abaEscolhida).some(acha) ? abaEscolhida : ABAS.find(([k]) => daAba(k).some(acha))?.[0] || abaEscolhida
    for (const t of $$('[data-aba-mencao]', el)) {
      t.classList.toggle('ativa', t.dataset.abaMencao === aba)
      const n = daAba(t.dataset.abaMencao).filter(acha).length
      $('.conta', t).textContent = n
      t.classList.toggle('sem-resultado', !!busca.trim() && !n)
    }
    // as tags no canto: só filtram aqui; editar é na página de cada um
    const comTags = daAba(aba).some((x) => x.tags?.length)
    if (tagDa[aba] && !daAba(aba).some((x) => temTag(x.tags, tagDa[aba]))) tagDa[aba] = ''
    $('.mencao-tags', el).innerHTML = comTags ? barraDeTags(daAba(aba).filter(acha).map((x) => ({ chave: x.codigo, tags: x.tags })), tagDa[aba] || '', `mencao.${aba}`, { editar: false }) : ''
    $('.mencao-corpo', el).classList.toggle('com-tags', comTags)
    const l = lista()
    const quando = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '')
    const emPe = aba === 'referencia' || aba === 'motion' || aba === 'cta'
    $('.mencao-grade', el).classList.toggle('em-pe', emPe)
    $('.mencao-grade', el).innerHTML = l.length ? l.map((x) => `<div class="mencao-card" data-mencao="${esc(x.codigo)}" title="${esc(x.nome)}">
        <span class="mencao-mini${emPe ? ' em-pe' : ''}">${x.mini ? `<img src="${esc(x.mini)}" alt="" loading="lazy">` : `<span class="mencao-icone">${x.audio ? ICONE.tocar : iconeAba(x.tipo === 'motion' ? 'motions' : x.tipo === 'preset' ? 'presets' : 'transicoes')}</span>`}
          <span class="mencao-check" aria-hidden="true">${ICONE.check}</span>
          ${x.clipe || x.audio || x.tipo === 'motion' ? `<button class="mencao-play" data-previa title="Tocar a prévia">${ICONE.tocar}</button>` : ''}
          ${x.usado_em ? `<span class="mencao-uso" title="Usado por último em ${esc(quando(x.usado_em))}">usado ${esc(quando(x.usado_em))}</span>` : ''}</span>
        <span class="mencao-rotulo"><b>${esc(x.codigo)}</b><span>${esc(x.nome)}</span></span></div>`).join('')
      : `<p class="vazio">${busca.trim() ? 'Nada com essa busca.' : 'Nada aqui ainda.'}</p>`
    desenharEscolhidos()
  }
  const alternar = (codigo) => {
    if (marcados.has(codigo)) marcados.delete(codigo)
    else marcados.set(codigo, porCodigo.get(codigo))
    desenharEscolhidos()
  }
  const importar = () => {
    if (!marcados.size) return
    importou = true
    // o @ digitado vira os códigos separados por espaço, e um espaço no fim; o cursor fica depois
    const v = campo.value
    const novo = `${[...marcados.keys()].map((c) => `@${c}`).join(' ')} `
    campo.value = v.slice(0, posArroba) + novo + v.slice(posArroba + 1)
    fechar()
    const p = posArroba + novo.length
    campo.setSelectionRange(p, p)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  }
  // Enter importa (menos no seletor de ordem); a revisão ignora as teclas com o modal aberto
  function tecla(e) {
    // Esc na busca: com texto, limpa; vazia, fecha (a janela, antes, só tira o foco do campo)
    if (e.key === 'Escape' && e.target === campoBusca) {
      e.stopPropagation()
      if (!campoBusca.value) return fechar()
      campoBusca.value = busca = ''
      desenhar()
      return campoBusca.focus()
    }
    if (e.key !== 'Enter' || e.isComposing || e.target.closest?.('select')) return
    e.preventDefault()
    e.stopPropagation()
    importar()
  }
  document.addEventListener('keydown', tecla, true)
  campoBusca.addEventListener('input', () => {
    busca = campoBusca.value
    desenhar()
  })
  el.addEventListener('change', (e) => {
    if (!e.target.matches('[data-ordem-mencao]')) return
    ordem = preferencia('mencao.ordem', 'uso', e.target.value)
    desenhar()
  })
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-importar]')) return importar()
    const d = e.target.closest('[data-desmarcar]')
    if (d) return alternar(d.dataset.desmarcar)
    const ab = e.target.closest('[data-abrir-tag]')
    if (ab) {
      const chave = `mencao.${aba}.tags.abertas`
      const l = preferencia(chave, [])
      preferencia(chave, [], l.includes(ab.dataset.abrirTag) ? l.filter((x) => x !== ab.dataset.abrirTag) : [...l, ab.dataset.abrirTag])
      return desenhar()
    }
    const tg = e.target.closest('[data-tag]')
    if (tg) {
      tagDa[aba] = tg.dataset.tag
      return desenhar()
    }
    const t = e.target.closest('[data-aba-mencao]')
    if (t) {
      aba = abaEscolhida = t.dataset.abaMencao
      return desenhar()
    }
    const c = e.target.closest('.mencao-card')
    if (!c) return
    if (e.target.closest('[data-previa]')) return tocar(c)
    alternar(c.dataset.mencao)
  })
  desenhar()
}
