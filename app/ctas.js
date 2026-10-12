// Os CTAs: trechos finais de vídeos já editados, que entram inteiros no fim de um orgânico e dão as saídas do projeto
// (📱 Reels ManyChat, 💰 Ad LP, 💰 Ad VSL…). Aqui o criador sobe os vídeos, marca onde o CTA começa e termina, escolhe a
// categoria e o favorito de cada uma (o que entra por padrão).
import { $, $$, ESTRELA_CHEIA, ICONE, ajuda, aviso, chipCodigo, codigos, confirmar, enviar, esc, janela, json, preferencia, tempo, tocarTrecho } from './comum.js'
import { marcarTrechos } from './trechos.js'

export async function abrirCtas(tela) {
  tela.className = 'pagina pagina-ctas'
  let filtro = preferencia('ctas.produto', '')
  const desenhar = async () => {
    const [d, cods] = await Promise.all([json('/api/ctas', { ctas: [], categorias: [] }), codigos()])
    const cats = Object.fromEntries(d.categorias.map((c) => [c.id, c]))
    const prods = Object.fromEntries(d.produtos.map((p) => [p.id, p]))
    if (filtro && filtro !== '_sem' && !prods[filtro]) filtro = ''
    const card = (c) => {
      const cat = cats[c.categoria]
      return `<article class="card-cta" data-id="${c.id}">
        <div class="mini mini-916"><img src="/biblioteca/ctas/${c.id}/miniatura.jpg?${encodeURIComponent(c.inicio)}" alt="" loading="lazy">
          <video muted playsinline preload="none" data-src="/biblioteca/ctas/${c.id}/proxy.mp4"></video>
          ${cat ? `<span class="selo selo-amarelo">${esc(cat.emoji)} ${esc(cat.saida)}</span>` : '<span class="selo selo-coral">Sem categoria</span>'}
          <button class="video-tocar" data-som title="Assistir o CTA com som">${ICONE.tocar}</button>
          <div class="cta-barra"><i></i></div>
          <span class="duracao">${tempo(c.fim - c.inicio)}</span>
          <button class="estrela${c.favorito ? ' ligada' : ''}" data-favorito title="${c.favorito ? 'Favorito da categoria (entra por padrão)' : 'Tornar o favorito da categoria'}">${c.favorito ? ESTRELA_CHEIA : ICONE.estrela}</button>
          <div class="cta-ferramentas">
            <button data-marcar title="Marcar onde o CTA começa e termina">${ICONE.tesoura}</button>
            <button data-expandir title="Abrir grande, com som">${ICONE.expandir}</button>
            <button data-apagar title="Apagar (vai para biblioteca/ctas/_lixeira/)">${ICONE.lixo}</button></div></div>
        <div class="cta-corpo">
          <div class="cta-titulo"><input class="cta-nome" value="${esc(c.nome)}" data-nome maxlength="200" spellcheck="false" aria-label="Nome do CTA" title="${esc(c.nome)}${c.fonte ? ` · ${esc(c.fonte)}` : ''}">${chipCodigo(cods.cta?.[c.id], c.nome)}</div>
          <div class="cta-meta">
            <label class="cta-categoria cta-produto${prods[c.produto] ? '' : ' vazia'}" title="Produto">${prods[c.produto] ? esc(prods[c.produto].emoji) : ''}<span>${prods[c.produto] ? esc(prods[c.produto].nome) : 'Produto'}</span>${ICONE.seta_baixo}
              <select data-produto aria-label="Produto"><option value="">Sem produto</option>
                ${d.produtos.map((k) => `<option value="${esc(k.id)}"${k.id === c.produto ? ' selected' : ''}>${esc(k.emoji)} ${esc(k.nome)}</option>`).join('')}</select></label>
            <label class="cta-categoria${cat ? '' : ' vazia'}" title="Categoria (a saída que o CTA dá)">${cat ? esc(cat.emoji) : ''}<span>${cat ? esc(cat.nome) : 'Sem categoria'}</span>${ICONE.seta_baixo}
              <select data-categoria aria-label="Categoria"><option value="">Sem categoria</option>
                ${d.categorias.map((k) => `<option value="${esc(k.id)}"${k.id === c.categoria ? ' selected' : ''}>${esc(k.emoji)} ${esc(k.nome)} → ${esc(k.saida)}</option>`).join('')}</select></label>
            </div>
        </div>
      </article>`
    }
    // numa grade só, na ordem das categorias (as sem categoria primeiro, para o criador organizar); o selo diz a categoria
    const grupos = [['', 'Sem categoria'], ...d.categorias.map((k) => [k.id, `${k.emoji} ${k.nome} → ${k.saida}`])]
      .map(([id, nome]) => [nome, d.ctas.filter((c) => (c.categoria || '') === id)]).filter(([, l]) => l.length)
    tela.innerHTML = `<div class="cabeca-secao"><span class="eyebrow">CTAs · ${String(d.ctas.length).padStart(2, '0')}</span>
        ${ajuda('Trechos finais de vídeos já editados, que entram inteiros no fim de um orgânico. A categoria define a saída que o CTA dá ao projeto (📱 Reels ManyChat, 💰 Ad LP, 💰 Ad VSL…); a ★ é o favorito da categoria, o que entra por padrão. Suba o vídeo editado e marque onde o CTA começa e termina.')}
        <div class="filtro-produtos">${[['', 'Todos', ''], ...d.produtos.map((p) => [p.id, p.nome, p.emoji]), ['_sem', 'Sem produto', '']].map(([id, nome, em]) =>
          `<button class="pilula pequena${filtro === id ? ' ativa' : ''}" data-filtro-produto="${esc(id)}">${em ? `${esc(em)} ` : ''}${esc(nome)} <span class="conta">${d.ctas.filter((c) => (id === '' ? true : id === '_sem' ? !prods[c.produto] : c.produto === id)).length}</span></button>`).join('')}</div>
        <button class="botao pequeno" data-editar-produtos title="Cadastrar e renomear os produtos">${ICONE.ajustes} Produtos</button>
        <label class="botao pequeno botao-subir">${ICONE.subir} Subir vídeo<input type="file" multiple accept="video/mp4,video/quicktime,video/webm" hidden data-subir></label></div>
      ${grupos.length ? `<div class="grade grade-ctas">${grupos.flatMap(([, l]) => l).filter((c) => (filtro === '' ? true : filtro === '_sem' ? !prods[c.produto] : c.produto === filtro)).map(card).join('')}</div>`
        : '<p class="vazio">Nenhum CTA ainda. Suba um vídeo editado (ou arraste para esta página) e marque onde o CTA começa.</p>'}`
    const porId = Object.fromEntries(d.ctas.map((c) => [c.id, c]))
    // a prévia: com o mouse em cima, o trecho do CTA mudo; o ▶ toca com som (um card por vez; clique de novo pausa)
    let comSom = null
    const pararSom = () => {
      if (!comSom) return
      comSom.parar()
      comSom.card.classList.remove('com-som', 'tocando')
      $('[data-som]', comSom.card).innerHTML = ICONE.tocar
      comSom = null
    }
    const barra = (c, v, x) => {
      const r = () => {
        if (!c.classList.contains('tocando')) return
        $('.cta-barra i', c).style.width = `${Math.min(100, Math.max(0, ((v.currentTime - x.inicio) / (x.fim - x.inicio)) * 100))}%`
        requestAnimationFrame(r)
      }
      requestAnimationFrame(r)
    }
    for (const c of $$('.card-cta', tela)) {
      const v = $('video', c)
      const x = porId[c.dataset.id]
      let parar = null
      $('.mini', c).addEventListener('mouseenter', () => {
        if (comSom?.card === c) return
        if (!v.src) v.src = v.dataset.src
        v.muted = true
        parar = tocarTrecho(v, x.inicio, x.fim)
        c.classList.add('tocando')
        barra(c, v, x)
      })
      $('.mini', c).addEventListener('mouseleave', () => {
        if (comSom?.card === c) return
        parar?.()
        v.pause()
        c.classList.remove('tocando')
      })
      // clicar em qualquer lugar do vídeo toca com som (ou pausa); os botões de cima fazem o deles
      $('.mini', c).addEventListener('click', (e) => !e.target.closest('button') && $('[data-som]', c).click())
      $('[data-expandir]', c).addEventListener('click', (e) => {
        e.stopPropagation()
        pararSom()
        parar?.()
        v.pause()
        c.classList.remove('tocando')
        assistir(x)
      })
      $('[data-som]', c).addEventListener('click', (e) => {
        e.stopPropagation()
        if (comSom?.card === c) {
          if (v.paused) v.play().catch(() => {})
          else v.pause()
          $('[data-som]', c).innerHTML = v.paused ? ICONE.tocar : ICONE.pausar
          return
        }
        pararSom()
        parar?.()
        if (!v.src) v.src = v.dataset.src
        v.muted = false
        comSom = { card: c, parar: tocarTrecho(v, x.inicio, x.fim) }
        c.classList.add('tocando', 'com-som')
        $('[data-som]', c).innerHTML = ICONE.pausar
        barra(c, v, x)
      })
    }
    for (const inp of $$('[data-nome]', tela)) {
      const orig = inp.value
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') inp.blur()
        if (e.key === 'Escape') {
          inp.value = orig
          inp.blur()
        }
      })
      inp.addEventListener('blur', () => {
        const v = inp.value.trim()
        if (!v) inp.value = orig
        else if (v !== orig) salvar(inp.closest('.card-cta').dataset.id, { nome: v }).then(() => aviso('Nome salvo'))
      })
    }
    tela.onchange = async (e) => {
      if (e.target.dataset.subir != null) return subir(e.target.files)
      const pr = e.target.closest('[data-produto]')
      if (pr) return salvar(pr.closest('.card-cta').dataset.id, { produto: pr.value || null })
      const s = e.target.closest('[data-categoria]')
      if (!s) return
      await salvar(s.closest('.card-cta').dataset.id, { categoria: s.value || null })
    }
    tela.onclick = async (e) => {
      const fp = e.target.closest('[data-filtro-produto]')
      if (fp) {
        filtro = preferencia('ctas.produto', '', fp.dataset.filtroProduto)
        return desenhar()
      }
      if (e.target.closest('[data-editar-produtos]')) return editarProdutos(d.produtos)
      const card = e.target.closest('.card-cta')
      if (!card) return
      const c = porId[card.dataset.id]
      if (e.target.closest('[data-favorito]')) return salvar(c.id, { favorito: !c.favorito })
      if (e.target.closest('[data-marcar]')) {
        // a mesma linha do tempo dos trechos do banco, com um trecho só: o CTA
        return marcarTrechos({ id: c.id, nome: c.nome, duracao: c.duracao, proxy: 'proxy.mp4' }, [{ id: c.id, nome: c.nome, inicio: c.inicio, fim: c.fim }], desenhar,
          { base: `/biblioteca/ctas/${c.id}/`, tira: `/api/ctas/${c.id}/tira`, um: true, titulo: 'Marcar o CTA', salvar: (t) => enviar('PUT', `/api/ctas/${c.id}`, { inicio: t.inicio, fim: t.fim, nome: t.nome }) })
      }
      if (e.target.closest('[data-apagar]')) {
        if (!(await confirmar({ titulo: `Apagar “${c.nome}”?`, texto: 'Vai para biblioteca/ctas/_lixeira/, de onde dá para recuperar.', ok: 'Apagar', perigo: true }))) return
        await enviar('DELETE', `/api/ctas/${c.id}`)
        aviso('CTA apagado')
        desenhar()
      }
    }
  }
  /** O CTA num modal, com som: só o trecho dele, em laço, com a barra e o tempo do trecho (clique na barra pula). */
  const assistir = (x) => {
    const dur = x.fim - x.inicio
    const { el } = janela(`<button class="botao-icone anexo-fechar" data-fechar title="Fechar (Esc)">${ICONE.fechar}</button>
      <video class="anexo-grande" src="/biblioteca/ctas/${x.id}/proxy.mp4#t=${x.inicio}" playsinline></video>
      <div class="player-trecho"><button class="botao-icone pequeno" data-p title="Tocar / pausar (Espaço)">${ICONE.pausar}</button>
        <div class="trecho-barra"><i></i></div><span class="trecho-tempo">0:00,0 / ${tempo(dur)}</span></div>`, { classe: 'janela-anexo' })
    const v = $('video', el), b = $('[data-p]', el), bar = $('.trecho-barra', el)
    const mostrar = () => {
      const t = Math.min(Math.max(v.currentTime - x.inicio, 0), dur)
      $('i', bar).style.width = `${(100 * t) / dur}%`
      $('.trecho-tempo', el).textContent = `${tempo(t)} / ${tempo(dur)}`
      b.innerHTML = v.paused ? ICONE.tocar : ICONE.pausar
    }
    tocarTrecho(v, x.inicio, x.fim)
    v.addEventListener('timeupdate', mostrar)
    for (const ev of ['play', 'pause']) v.addEventListener(ev, mostrar)
    const alternar = () => (v.paused ? v.play() : v.pause())
    b.addEventListener('click', alternar)
    v.addEventListener('click', alternar)
    bar.addEventListener('click', (e) => {
      const r = bar.getBoundingClientRect()
      v.currentTime = x.inicio + ((e.clientX - r.left) / r.width) * dur
    })
    el.addEventListener('keydown', (e) => e.key === ' ' && (e.preventDefault(), alternar()))
    b.focus()
  }
  /** O painel dos produtos: emoji e nome editáveis, adicionar e tirar; grava a lista inteira. */
  const editarProdutos = (lista) => {
    let l = lista.map((p) => ({ ...p }))
    const { el, fechar } = janela(`<header class="janela-cabeca"><h2>Produtos</h2><span class="dica">a que produto cada CTA leva</span>
        <button class="botao-icone" data-fechar title="Fechar (Esc)">${ICONE.fechar}</button></header>
      <div class="produtos-lista"></div>
      <div class="produtos-acoes"><button class="botao pequeno" data-novo>${ICONE.mais} Novo produto</button>
        <button class="botao botao-coral" data-gravar>Salvar</button></div>`, { classe: 'janela-produtos' })
    const desenharL = () => {
      $('.produtos-lista', el).innerHTML = l.map((p, k) => `<div class="produto-linha" data-k="${k}">
          <input class="produto-emoji" value="${esc(p.emoji || '')}" maxlength="8" data-campo="emoji" aria-label="Emoji" placeholder="🏷️">
          <input class="produto-nome" value="${esc(p.nome)}" maxlength="60" data-campo="nome" aria-label="Nome" placeholder="Nome do produto">
          <button class="botao-icone pequeno" data-tirar title="Tirar (os CTAs dele ficam sem produto)">${ICONE.lixo}</button></div>`).join('')
        || '<p class="dica">Nenhum produto. Crie o primeiro.</p>'
    }
    desenharL()
    el.addEventListener('input', (e) => {
      const linha = e.target.closest('.produto-linha')
      if (linha) l[+linha.dataset.k][e.target.dataset.campo] = e.target.value
    })
    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-novo]')) {
        l.push({ id: '', nome: '', emoji: '' })
        desenharL()
        return $$('.produto-nome', el).at(-1).focus()
      }
      const t = e.target.closest('[data-tirar]')
      if (t) {
        l.splice(+t.closest('.produto-linha').dataset.k, 1)
        return desenharL()
      }
      if (e.target.closest('[data-gravar]')) {
        try {
          await enviar('PUT', '/api/ctas-produtos', { produtos: l })
          aviso('Produtos salvos')
          fechar()
          desenhar()
        } catch (x) {
          aviso(x.message, 'erro')
        }
      }
    })
  }
  const salvar = async (id, dados) => {
    try {
      await enviar('PUT', `/api/ctas/${id}`, dados)
      desenhar()
    } catch (x) {
      aviso(x.message, 'erro')
    }
  }
  const subir = async (arquivos) => {
    const l = [...arquivos].filter((f) => /\.(mp4|mov|m4v|webm)$/i.test(f.name))
    if (!l.length) return aviso('Use um vídeo (MP4, MOV ou WebM)', 'erro')
    for (const [k, f] of l.entries()) {
      aviso(`Enviando ${k + 1} de ${l.length}… ${f.name}`)
      try {
        const r = await fetch('/api/ctas', { method: 'POST', headers: { 'X-Nome': encodeURIComponent(f.name) }, body: f })
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || `HTTP ${r.status}`)
      } catch (x) {
        aviso(`${f.name}: ${x.message}`, 'erro')
      }
    }
    aviso('Subiu: escolha a categoria e marque onde o CTA começa')
    desenhar()
  }
  tela.addEventListener('dragover', (e) => { e.preventDefault(); tela.classList.add('soltando') })
  tela.addEventListener('dragleave', (e) => !tela.contains(e.relatedTarget) && tela.classList.remove('soltando'))
  tela.addEventListener('drop', (e) => { e.preventDefault(); tela.classList.remove('soltando'); subir(e.dataTransfer.files) })
  await desenhar()
}
