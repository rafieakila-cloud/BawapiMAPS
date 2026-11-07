/* Bacapi Maps — GSB/PKK, 3D (MapLibre+OpenFreeMap), Satelit + label, tap detail */
(function(){
  const places = window.BACAPI_PLACES || [];
  const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [118, -2],
    zoom: 3.2,
    pitch: 45,
    bearing: -10,
    maxPitch: 70,
    attributionControl: true
  });
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}), 'top-right');

  let mode = '3d';
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
    if(mode!=='3d') return;
    const layers = map.getStyle().layers || [];
    const labelLayer = layers.find(l => l.type==='symbol' && l.layout && l.layout['text-field']);
    const before = labelLayer ? labelLayer.id : undefined;
    if(!map.getLayer('3d-buildings') && map.getSource('openmaptiles')){
      try{
        map.addLayer({
          id:'3d-buildings', source:'openmaptiles', 'source-layer':'building',
          type:'fill-extrusion', minzoom:14,
          paint:{
            'fill-extrusion-color':'#7aa7c7',
            'fill-extrusion-height':['coalesce',['get','render_height'],['*',['coalesce',['get','building:levels'],3],3],12],
            'fill-extrusion-base':['coalesce',['get','render_min_height'],0],
            'fill-extrusion-opacity':0.72
          }
        }, before);
      }catch(e){}
    }
  }
  function setMode(m){
    mode = m;
    document.getElementById('btn3d').classList.toggle('active', m==='3d');
    document.getElementById('btnSat').classList.toggle('active', m==='satelit');
    if(m==='3d'){
      map.setStyle('https://tiles.openfreemap.org/styles/liberty');
      map.once('style.load', ()=>{ map.easeTo({pitch:45,bearing:-10}); add3dBuildings(); });
    }else{
      map.setStyle(rasterStyle());
      map.once('style.load', ()=>{ map.easeTo({pitch:0,bearing:0}); });
    }
  }
  document.getElementById('btn3d').onclick = ()=>setMode('3d');
  document.getElementById('btnSat').onclick = ()=>setMode('satelit');

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
        <button class="btn" id="flyBtn">Fokus 3D</button>
      </div>`;
    panel.classList.remove('hidden');
    document.getElementById('closePanel').onclick = ()=>panel.classList.add('hidden');
    document.getElementById('flyBtn').onclick = ()=>{ setMode('3d'); map.flyTo({center:[p.coords.lng,p.coords.lat], zoom:16.2, pitch:60, bearing:20, duration:1800}); };
  }

  places.forEach(p => {
    if(!p.coords || p.coords.lat==null) return;
    const el = document.createElement('div'); el.className='marker'; el.title=p.name;
    el.onclick = (e)=>{ e.stopPropagation(); map.flyTo({center:[p.coords.lng,p.coords.lat], zoom:Math.max(map.getZoom(),5), duration:900}); showPanel(p); };
    new maplibregl.Marker({element:el}).setLngLat([p.coords.lng,p.coords.lat]).addTo(map);
  });

  const list = document.getElementById('placeList');
  places.forEach(p=>{
    const it = document.createElement('div'); it.className='place-item';
    it.innerHTML = `<b>${esc(p.name)}</b><span>${esc(p.gsb_id)} • ${esc(regionText(p.region))}</span>`;
    it.onclick = ()=>{ if(p.coords.lat!=null){ map.flyTo({center:[p.coords.lng,p.coords.lat], zoom:6, duration:1000}); showPanel(p); } document.getElementById('drawer').classList.add('hidden'); };
    list.appendChild(it);
  });
  document.getElementById('listToggle').onclick = ()=>document.getElementById('drawer').classList.toggle('hidden');
  document.getElementById('closeDrawer').onclick = ()=>document.getElementById('drawer').classList.add('hidden');

  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
})();
