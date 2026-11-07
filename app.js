/* Bacapi Maps — GSB/PKK, Peta 3D bangunan, Satelit+label, search (Bing-like UI) */
(function(){
  const places = window.BACAPI_PLACES || [];
  const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [118, -2],
    zoom: 3.4,
    pitch: 0,          // default tidak miring
    bearing: 0,
    maxPitch: 70,
    attributionControl: true
  });
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}), 'bottom-right');

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
    document.getElementById('btnMap').classList.toggle('active', base==='map' && !tilted);
    document.getElementById('btnSat').classList.toggle('active', base==='sat');
    document.getElementById('btnTilt').classList.toggle('active', tilted);
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
  document.getElementById('btnMap').onclick = ()=>{ tilted=false; setBase('map'); };
  document.getElementById('btnSat').onclick = ()=>setBase('sat');
  document.getElementById('btnTilt').onclick = toggleTilt;
  map.on('style.load', add3dBuildings);

  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function regionText(r){ if(!r) return ''; return [r.kota,r.provinsi,r.negara].filter(Boolean).join(', ') + (r.pkk?` • PKK ${esc(r.pkk)}`:''); }
  function showPanel(p){
    const d = p.detail || {}; const ph = (d.photos&&d.photos[0])||{};
    const cuisine = (d.cuisine||[]).map(c=>`<li><b>${esc(c.name)}</b> — ${esc(c.origin||'')}${c.note?` (${esc(c.note)})`:''}</li>`).join('');
    const guides = (d.guides||[]).map(g=>`<li><b>${esc(g.title)}</b>: ${esc(g.content||'')}</li>`).join('');
    const gmaps = `https://www.google.com/maps?q=${p.coords.lat},${p.coords.lng}`;
    const panel = document.getElementById('panel');
    panel.innerHTML = `
      <button class="close" id="closePanel">✕</button>
      <div class="gsb">${esc(p.gsb_id)}</div>
      <h2>${esc(p.name)}</h2>
      <div class="meta">${esc(regionText(p.region))} • ${esc(p.coords.lat)}, ${esc(p.coords.lng)}</div>
      ${ph.url?`<img src="${esc(ph.url)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer">`:''}
      ${ph.credit?`<div class="credit">Foto: ${esc(ph.credit)} ${ph.license?`(${esc(ph.license)})`:''}</div>`:''}
      <h3>Penjelasan</h3><p>${esc(d.explanation||'-')}</p>
      ${cuisine?`<h3>Kuliner khas / cocok</h3><ul>${cuisine}</ul>`:''}
      ${guides?`<h3>Guides</h3><ul>${guides}</ul>`:''}
      <div class="actions">
        <a class="btn primary" target="_blank" rel="noopener" href="${gmaps}">Arahkan</a>
        <button class="btn" id="fly3d">Lihat 3D Miring</button>
      </div>`;
    panel.classList.remove('hidden');
    document.getElementById('closePanel').onclick = ()=>panel.classList.add('hidden');
    document.getElementById('fly3d').onclick = ()=>{
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
  const list = document.getElementById('placeList');
  places.forEach(p=>{
    const it = document.createElement('div'); it.className='place-item';
    it.innerHTML = `<b>${esc(p.name)}</b><span>${esc(p.gsb_id)} • ${esc(regionText(p.region))}</span>`;
    it.onclick = ()=>{ focusPlace(p); document.getElementById('drawer').classList.add('hidden'); };
    list.appendChild(it);
  });
  document.getElementById('listToggle').onclick = ()=>document.getElementById('drawer').classList.toggle('hidden');
  document.getElementById('closeDrawer').onclick = ()=>document.getElementById('drawer').classList.add('hidden');

  // Search
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  const clearBtn = document.getElementById('clearSearch');
  function renderSearch(q){
    const s = (q||'').trim().toLowerCase();
    clearBtn.classList.toggle('hidden', !s);
    if(!s){ results.classList.add('hidden'); results.innerHTML=''; return; }
    const hits = places.filter(p=>{
      const hay = [p.name,p.gsb_id,regionText(p.region),p.category].join(' ').toLowerCase();
      return hay.includes(s);
    }).slice(0,12);
    if(!hits.length){ results.innerHTML = `<div class="sr-item"><span>Tidak ada hasil.</span></div>`; results.classList.remove('hidden'); return; }
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

  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
})();
