/* Bacapi Maps — GSB/PKK, Peta 3D bangunan, Satelit+label, search, tap daerah (Bing-like) */
(function(){
  const places = window.BACAPI_PLACES || [];
  const $ = id => document.getElementById(id);
  const loader = $('loader');
  const hideLoader = ()=>loader && loader.classList.add('hidden');

  const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [118, -2],
    zoom: 3.4,
    pitch: 0,
    bearing: 0,
    maxPitch: 70,
    attributionControl: true
  });
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}), 'bottom-right');
  map.on('load', hideLoader);
  setTimeout(hideLoader, 7000);

  let base = 'map';   // 'map' | 'sat'
  let tilted = false;

  function rasterStyle(){
    return {
      version: 8,
      sources: {
        sat: { type:'raster', tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize:256, attribution:'Esri World Imagery' },
        labels: { type:'raster', tiles:['https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png'], tileSize:256, attribution:'© OpenStreetMap, © CARTO' }
      },
      layers: [
        { id:'sat', type:'raster', source:'sat' },
        { id:'labels', type:'raster', source:'labels' }
      ]
    };
  }
  function add3dBuildings(){
    if(base!=='map') return;
    try{
      const layers = map.getStyle().layers || [];
      const labelLayer = layers.find(l => l.type==='symbol' && l.layout && l.layout['text-field']);
      const before = labelLayer ? labelLayer.id : undefined;
      if(!map.getLayer('3d-buildings') && map.getSource('openmaptiles')){
        map.addLayer({
          id:'3d-buildings', source:'openmaptiles', 'source-layer':'building',
          type:'fill-extrusion', minzoom:14,
          paint:{
            'fill-extrusion-color':'#b7d1e6',
            'fill-extrusion-height':['coalesce',['get','render_height'],['*',['coalesce',['get','building:levels'],3],3],12],
            'fill-extrusion-base':['coalesce',['get','render_min_height'],0],
            'fill-extrusion-opacity':0.78
          }
        }, before);
      }
    }catch(e){}
  }
  function syncUI(){
    $('btnMap').classList.toggle('active', base==='map' && !tilted);
    $('btnSat').classList.toggle('active', base==='sat');
    $('btnTilt').classList.toggle('active', tilted);
  }
  function applyCamera(){
    map.easeTo({ pitch: tilted ? 60 : 0, bearing: tilted ? -20 : 0, duration: 600 });
  }
  function setBase(b){
    base = b;
    if(b==='sat') tilted = false;
    syncUI();
    if(b==='map'){
      map.setStyle('https://tiles.openfreemap.org/styles/liberty');
      map.once('style.load', ()=>{ add3dBuildings(); applyCamera(); });
    }else{
      map.setStyle(rasterStyle());
      map.once('style.load', applyCamera);
    }
  }
  function toggleTilt(){
    if(base==='sat') setBase('map');
    tilted = !tilted;
    syncUI();
    applyCamera();
    if(tilted && map.getZoom() < 15) map.easeTo({zoom:15.5, duration:800});
  }
  $('btnMap').onclick = ()=>{ tilted=false; setBase('map'); };
  $('btnSat').onclick = ()=>setBase('sat');
  $('btnTilt').onclick = toggleTilt;
  map.on('style.load', add3dBuildings);

  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function regionText(r){ if(!r) return ''; return [r.kota,r.provinsi,r.negara].filter(Boolean).join(', ') + (r.pkk?` • PKK ${esc(r.pkk)}`:''); }
  function showPanel(p){
    const d = p.detail || {}; const ph = (d.photos&&d.photos[0])||{};
    const cuisine = (d.cuisine||[]).map(c=>`<li><b>${esc(c.name)}</b> — ${esc(c.origin||'')}${c.note?` (${esc(c.note)})`:''}</li>`).join('');
    const guides = (d.guides||[]).map(g=>`<li><b>${esc(g.title)}</b>: ${esc(g.content||'')}</li>`).join('');
    const gmaps = `https://www.google.com/maps?q=${p.coords.lat},${p.coords.lng}`;
    const panel = $('panel');
    panel.innerHTML = `
      <button class="close" id="closePanel">✕</button>
      <div class="gsb">${esc(p.gsb_id||'Wilayah')}</div>
      <h2>${esc(p.name)}</h2>
      <div class="meta">${esc(regionText(p.region)||p.meta||'')} ${p.coords?`• ${esc(p.coords.lat)}, ${esc(p.coords.lng)}`:''}</div>
      ${ph.url?`<img src="${esc(ph.url)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer">`:''}
      ${ph.credit?`<div class="credit">Foto: ${esc(ph.credit)} ${ph.license?`(${esc(ph.license)})`:''}</div>`:''}
      <h3>Penjelasan</h3><p>${esc(d.explanation||'-')}</p>
      ${cuisine?`<h3>Kuliner khas / cocok</h3><ul>${cuisine}</ul>`:''}
      ${guides?`<h3>Guides</h3><ul>${guides}</ul>`:''}
      <div class="actions">
        ${p.coords?`<a class="btn primary" target="_blank" rel="noopener" href="${gmaps}">Arahkan</a>`:''}
        ${p.coords?`<button class="btn" id="fly3d">Lihat 3D Miring</button>`:''}
        ${p.wikiUrl?`<a class="btn" target="_blank" rel="noopener" href="${esc(p.wikiUrl)}">Sumber</a>`:''}
      </div>`;
    panel.classList.remove('hidden');
    $('closePanel').onclick = ()=>panel.classList.add('hidden');
    if($('fly3d')) $('fly3d').onclick = ()=>{
      if(base==='sat') setBase('map'); tilted = true; syncUI();
      map.flyTo({center:[p.coords.lng,p.coords.lat], zoom:16.2, pitch:60, bearing:20, duration:1600});
    };
  }

  function focusPlace(p){
    if(!p || !p.coords || p.coords.lat==null) return;
    map.flyTo({center:[p.coords.lng,p.coords.lat], zoom:Math.max(map.getZoom(),6), duration:900});
    showPanel(p);
  }

  places.forEach(p => {
    if(!p.coords || p.coords.lat==null) return;
    const el = document.createElement('div'); el.className='marker'; el.title=p.name;
    el.onclick = (e)=>{ e.stopPropagation(); focusPlace(p); };
    new maplibregl.Marker({element:el}).setLngLat([p.coords.lng,p.coords.lat]).addTo(map);
  });

  // List
  const list = $('placeList');
  places.forEach(p=>{
    const it = document.createElement('div'); it.className='place-item';
    it.innerHTML = `<b>${esc(p.name)}</b><span>${esc(p.gsb_id)} • ${esc(regionText(p.region))}</span>`;
    it.onclick = ()=>{ focusPlace(p); $('drawer').classList.add('hidden'); };
    list.appendChild(it);
  });
  $('listToggle').onclick = ()=>$('drawer').classList.toggle('hidden');
  $('closeDrawer').onclick = ()=>$('drawer').classList.add('hidden');

  // Search
  const input = $('searchInput');
  const results = $('searchResults');
  const clearBtn = $('clearSearch');
  function renderSearch(q){
    const s = (q||'').trim().toLowerCase();
    clearBtn.classList.toggle('hidden', !s);
    if(!s){ results.classList.add('hidden'); results.innerHTML=''; return; }
    const hits = places.filter(p=>{
      const hay = [p.name,p.gsb_id,regionText(p.region),p.category].join(' ').toLowerCase();
      return hay.includes(s);
    }).slice(0,12);
    if(!hits.length){ results.innerHTML = `<div class="sr-item"><span>Tidak ada hasil di data GSB.</span></div>`; results.classList.remove('hidden'); return; }
    results.innerHTML = hits.map((p,i)=>`<div class="sr-item" data-i="${i}"><b>${esc(p.name)}</b><span>${esc(p.gsb_id)} • ${esc(regionText(p.region))}</span></div>`).join('');
    results.classList.remove('hidden');
    results.querySelectorAll('.sr-item[data-i]').forEach((el,idx)=>{
      el.onclick = ()=>{ focusPlace(hits[idx]); results.classList.add('hidden'); };
    });
  }
  input.addEventListener('input', e=>renderSearch(e.target.value));
  input.addEventListener('focus', e=>renderSearch(e.target.value));
  clearBtn.onclick = ()=>{ input.value=''; renderSearch(''); input.focus(); };
  document.addEventListener('click', e=>{ if(!e.target.closest('.search-wrap')) results.classList.add('hidden'); });

  // Tap nama daerah/negara di peta -> reverse geocode + Wikipedia
  async function fetchSummary(title){
    const name = encodeURIComponent(title.replace(/ /g,'_'));
    for(const lang of ['id','en']){
      try{
        const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${name}`);
        if(r.ok){ const j = await r.json(); if(j.extract) return { ...j, lang }; }
      }catch(e){}
    }
    return null;
  }
  async function showRegion(lat,lng){
    $('panel').innerHTML = `<button class="close" id="closePanel">✕</button><h2>Memuat info daerah…</h2><p class="meta">${lat.toFixed(4)}, ${lng.toFixed(4)}</p>`;
    $('panel').classList.remove('hidden');
    $('closePanel').onclick = ()=>$('panel').classList.add('hidden');
    try{
      const rg = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`, { headers:{'Accept':'application/json'} });
      const geo = rg.ok ? await rg.json() : {};
      const a = geo.address || {};
      const name = a.state || a.province || a.region || a.county || a.city || a.town || a.village || a.country || geo.name || 'Daerah';
      const country = a.country || '';
      const sum = await fetchSummary(name) || (country && country!==name ? await fetchSummary(country) : null);
      const photo = sum && sum.thumbnail ? { url: sum.thumbnail.source, credit:'Wikipedia', license:'' } : ((sum && sum.originalimage) ? {url: sum.originalimage.source, credit:'Wikipedia', license:''} : null);
      showPanel({
        gsb_id: 'DAERAH',
        name: name + (country && country!==name ? `, ${country}` : ''),
        meta: geo.display_name || '',
        coords: {lat, lng},
        wikiUrl: sum && sum.content_urls && sum.content_urls.desktop ? sum.content_urls.desktop.page : null,
        detail: {
          photos: photo ? [photo] : [],
          explanation: sum && sum.extract ? sum.extract : 'Penjelasan belum tersedia untuk daerah ini.',
          cuisine: [{ name:'Kuliner khas daerah', origin: country||name, note:'Lihat rekomendasi lokal / pencarian kuliner khas.' }],
          guides: [{ title:'Panduan', content:'Cek tempat populer, transportasi, dan waktu terbaik berkunjung di daerah ini.' }]
        }
      });
    }catch(e){
      showPanel({ gsb_id:'DAERAH', name:'Info daerah', coords:{lat,lng}, detail:{ photos:[], explanation:'Gagal memuat info (cek koneksi).', cuisine:[], guides:[] } });
    }
  }

  map.on('click', (e)=>{
    if(e.originalEvent && e.originalEvent.target && e.originalEvent.target.closest('.marker')) return;
    if(e.originalEvent && e.originalEvent.target && e.originalEvent.target.closest('.maplibregl-ctrl')) return;
    showRegion(e.lngLat.lat, e.lngLat.lng);
  });

  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
})();
