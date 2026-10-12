// Os CTAs: trechos finais de vídeos já editados, que entram inteiros no fim de um orgânico e dão as saídas do projeto
// (📱 Reels ManyChat, 💰 Ad LP, 💰 Ad VSL…). Aqui o criador sobe os vídeos, marca onde o CTA começa e termina, escolhe a
// categoria e o favorito de cada uma (o que entra por padrão).
import { $, $$, ESTRELA_CHEIA, ICONE, ajuda, aviso, chipCodigo, codigos, confirmar, enviar, esc, janela, json, tempo, tocarTrecho } from './comum.js'
import { marcarTrechos } from './trechos.js'

export async function abrirCtas(tela) {
  tela.className = 'pagina pagina-ctas'
  const desenhar = async () => {
    const [d, cods] = await Promise.all([json('/api/ctas', { ctas: [], categorias: [] }), codigos()])
    const cats = Object.fromEntries(d.categorias.map((c) => [c.id, c]))
    const card = (c) => {
      const cat = cats[c.categoria]
      return `<article class="card-cta" data-id="${c.id}">
        <div class="mini mini-916"><img src="/biblioteca/ctas/${c.id}/miniatura.jpg?${encodeURIComponent(c.inicio)}" alt="" loading="lazy">
          <video muted playsinline preload="none" data-src="/biblioteca/ctas/${c.id}/proxy.mp4"></video>
          ${cat ? `<span class="selo selo-amarelo">${esc(cat.emoji)} ${esc(cat.saida)}</span>` : '<span class="selo selo-coral">Sem categoria</span>'}
          <button class="video-tocar" data-som title="Assistir o CTA com som">${ICONE.tocar}</button>
          <button class="botao-icone pequeno cta-expandir" data-expandir title="Abrir grande, com som">${ICONE.expandir}</button>
          <div class="cta-barra"><i></i></div>
          <span class="duracao">${tempo(c.fim - c.inicio)}</span>
          <button class="estrela${c.favorito ? ' ligada' : ''}" data-favorito title="${c.favorito ? 'Favorito da categoria (entra por padrão)' : 'Tornar o favorito da categoria'}">${c.favorito ? ESTRELA_CHEIA : ICONE.estrela}</button></div>
        <h3 class="cta-nome" title="${esc(c.nome)}${c.fonte ? `\n${esc(c.fonte)}` : ''}">${esc(c.nome)}</h3>
        <div class="cta-info">${chipCodigo(cods.cta?.[c.id], c.nome)}
          <select class="select-cta" data-categoria aria-label="Categoria"><option value="">Categoria…</option>
            ${d.categorias.map((k) => `<option value="${esc(k.id)}"${k.id === c.categoria ? ' selected' : ''}>${esc(k.emoji)} ${esc(k.nome)}</option>`).join('')}</select></div>
        <div class="acoes-pe"><button class="botao pequeno" data-marcar title="Marque na linha do tempo onde o CTA começa e termina">${ICONE.tesoura} Marcar o CTA</button>
          <button class="botao-icone pequeno" data-apagar title="Apagar (vai para biblioteca/ctas/_lixeira/)">${ICONE.lixo}</button></div>
      </article>`
    }
    // numa grade só, na ordem das categorias (as sem categoria primeiro, para o criador organizar); o selo diz a categoria
    const grupos = [['', 'Sem categoria'], ...d.categorias.map((k) => [k.id, `${k.emoji} ${k.nome} → ${k.saida}`])]
      .map(([id, nome]) => [nome, d.ctas.filter((c) => (c.categoria || '') === id)]).filter(([, l]) => l.length)
    tela.innerHTML = `<div class="cabeca-secao"><span class="eyebrow">CTAs · ${String(d.ctas.length).padStart(2, '0')}</span>
        ${ajuda('Trechos finais de vídeos já editados, que entram inteiros no fim de um orgânico. A categoria define a saída que o CTA dá ao projeto (📱 Reels ManyChat, 💰 Ad LP, 💰 Ad VSL…); a ★ é o favorito da categoria, o que entra por padrão. Suba o vídeo editado e marque onde o CTA começa e termina.')}
        <label class="botao pequeno botao-subir">${ICONE.subir} Subir vídeo<input type="file" multiple accept="video/mp4,video/quicktime,video/webm" hidden data-subir></label></div>
      ${grupos.length ? `<div class="grade grade-ctas">${grupos.flatMap(([, l]) => l).map(card).join('')}</div>`
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
    tela.onchange = async (e) => {
      if (e.target.dataset.subir != null) return subir(e.target.files)
      const s = e.target.closest('[data-categoria]')
      if (!s) return
      await salvar(s.closest('.card-cta').dataset.id, { categoria: s.value || null })
    }
    tela.onclick = async (e) => {
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
