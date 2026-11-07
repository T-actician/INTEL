(() => {
const $ = id => document.getElementById(id);
const dial = $('dial');
let map = null, tgt = null, mkT = null, mkS = null, shared = null;
const btns = ['b-sat', 'b-tilt', 'b-bld', 'b-street', 'b-big'];

const NAME = ['coalesce', ['get', 'name:latin'], ['get', 'name']];
const HALO = { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,.85)', 'text-halo-width': 1.6 };

const style = {
  version: 8,
  sources: {
    sat: { type: 'raster', tileSize: 256, maxzoom: 18, attribution: 'Imagery: Esri, Maxar, Earthstar Geographics',
           tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] },
    dem: { type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 14,
           tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'] },
    osm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    area: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  },
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  terrain: { source: 'dem', exaggeration: 1.4 },
  layers: [
    { id: 'sat', type: 'raster', source: 'sat' },
    { id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': '#ff9d2e', 'fill-opacity': 0.08 } },
    { id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': '#ff9d2e', 'line-width': 2, 'line-dasharray': [3, 3] } },
    { id: 'bld', type: 'fill-extrusion', source: 'osm', 'source-layer': 'building', minzoom: 14, layout: { visibility: 'none' },
      paint: { 'fill-extrusion-color': '#e8edf0', 'fill-extrusion-opacity': 0.45,
               'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
               'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0] } },
    { id: 'lb-road', type: 'symbol', source: 'osm', 'source-layer': 'transportation_name', minzoom: 14,
      layout: { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': ['Noto Sans Regular'], 'text-size': 11 }, paint: HALO },
    { id: 'lb-place', type: 'symbol', source: 'osm', 'source-layer': 'place', minzoom: 6,
      layout: { 'text-field': NAME, 'text-font': ['Noto Sans Bold'], 'text-size': 14 }, paint: HALO },
    { id: 'lb-poi', type: 'symbol', source: 'osm', 'source-layer': 'poi', minzoom: 15, filter: ['has', 'name'],
      layout: { 'text-field': NAME, 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-anchor': 'top', 'text-offset': [0, 0.4] }, paint: HALO },
    { id: 'lb-num', type: 'symbol', source: 'osm', 'source-layer': 'housenumber', minzoom: 18,
      layout: { 'text-field': ['get', 'housenumber'], 'text-font': ['Noto Sans Regular'], 'text-size': 10 }, paint: HALO },
  ],
};

function circle(lon, lat, km){
  const pts = [], d = km / 6371, p = lat * Math.PI / 180;
  for (let i = 0; i <= 64; i++){
    const b = i / 64 * 2 * Math.PI;
    const la = Math.asin(Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(b));
    const lo = lon * Math.PI / 180 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p), Math.cos(d) - Math.sin(p) * Math.sin(la));
    pts.push([lo * 180 / Math.PI, la * 180 / Math.PI]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] } };
}

function pin(cls){ const e = document.createElement('div'); e.className = 'pin ' + (cls || ''); return e; }

function ensureMap(){
  if (map) return true;
  if (!window.maplibregl){ log('Map engine failed to load', 'err'); return false; }
  maplibregl.setWorkerUrl('vendor/maplibre-gl-csp-worker.js');
  map = new maplibregl.Map({ container: 'map', style, center: [tgt.lon, tgt.lat], zoom: 7, maxPitch: 80, maxZoom: 20,
                             attributionControl: { compact: true } });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
  let warned = false;
  map.on('error', () => { if (!warned){ warned = true; log('Some map tiles unreachable: check internet', 'err'); } });
  map.on('load', () => { drawTarget(); if (shared) drawShared(); });
  return true;
}

function drawTarget(){
  if (!map || !tgt) return;
  map.getSource('area') && map.getSource('area').setData({ type: 'FeatureCollection', features: [circle(tgt.lon, tgt.lat, 30)] });
  if (!mkT) mkT = new maplibregl.Marker({ element: pin() });
  mkT.setLngLat([tgt.lon, tgt.lat]).addTo(map);
}

function drawShared(){
  if (!map || !shared) return;
  if (!mkS) mkS = new maplibregl.Marker({ element: pin('me') });
  mkS.setLngLat([shared.lon, shared.lat]).addTo(map);
}

function enter(){
  if (!tgt || dial.classList.contains('map')) return;
  dial.classList.add('map');
  if (!ensureMap()){ dial.classList.remove('map'); return; }
  requestAnimationFrame(() => {
    map.resize(); drawTarget();
    map.jumpTo({ center: [tgt.lon, tgt.lat], zoom: 7, pitch: 0, bearing: 0 });
    map.flyTo({ center: [tgt.lon, tgt.lat], zoom: 10.5, duration: 3000, essential: true });
  });
  $('b-sat').textContent = 'GLOBE'; $('b-sat').classList.add('on');
  log('Satellite view: ISP service area (30 km ring), not a street address');
}

function leave(){
  dial.classList.remove('map', 'big');
  $('b-sat').textContent = 'SATELLITE'; $('b-sat').classList.remove('on');
  $('b-big').classList.remove('on'); $('b-big').textContent = 'EXPAND';
  setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}

window.addEventListener('hud-target', e => {
  tgt = e.detail; btns.forEach(id => { $(id).disabled = false; });
  if (map){ drawTarget(); }
});
window.addEventListener('hud-enter-map', enter);

$('b-sat').addEventListener('click', () => dial.classList.contains('map') ? leave() : enter());
$('b-tilt').addEventListener('click', () => {
  if (!map) return;
  const on = map.getPitch() < 10;
  map.easeTo({ pitch: on ? 65 : 0, bearing: on ? -20 : 0, duration: 1200 });
  $('b-tilt').classList.toggle('on', on);
});
$('b-bld').addEventListener('click', () => {
  const b = $('b-bld'), on = !b.classList.contains('on');
  b.classList.toggle('on', on);
  if (map) map.setLayoutProperty('bld', 'visibility', on ? 'visible' : 'none');
});
$('b-street').addEventListener('click', () => {
  const c = map ? map.getCenter() : { lat: tgt.lat, lng: tgt.lon };
  window.intel.openExternal(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c.lat.toFixed(6)},${c.lng.toFixed(6)}`);
  log('Street View opened in browser (only works where coverage exists)');
});
$('b-big').addEventListener('click', () => {
  if (!dial.classList.contains('map')) enter();
  const on = dial.classList.toggle('big');
  $('b-big').classList.toggle('on', on); $('b-big').textContent = on ? 'COLLAPSE' : 'EXPAND';
  setTimeout(() => map && map.resize(), 50);
});
$('b-exit').addEventListener('click', () => $('b-big').click());
addEventListener('keydown', e => { if (e.key === 'Escape' && dial.classList.contains('big')) $('b-big').click(); });

function parseCoords(t){
  const m = t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || t.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/)
         || t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || t.match(/(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)/);
  return m;
}

async function plot(){
  let text = $('shared').value.trim();
  const link = text.match(/https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\S+/i);
  if (link){
    log('Resolving shared link...');
    const full = await window.intel.resolveLink(link[0]);
    if (!full){ log('Could not open the shared link: check internet', 'err'); return; }
    text = full;
  }
  const m = parseCoords(text);
  const acc = text.match(/acc=(\d+)/);
  if (!m){ log('Shared location: no coordinates found', 'err'); return; }
  const lat = +m[1], lon = +m[2];
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180){ log('Shared location: coordinates out of range', 'err'); return; }
  shared = { lat, lon };
  log(`Shared location plotted: ${lat.toFixed(5)}, ${lon.toFixed(5)}` + (acc ? ` (±${acc[1]} m)` : ''));
  if (!tgt) tgt = { lat, lon, label: 'Shared' };
  if (!dial.classList.contains('map')){ btns.forEach(id => { $(id).disabled = false; }); enter(); }
  const go = () => { drawShared(); map.flyTo({ center: [lon, lat], zoom: 17, pitch: 55, duration: 2500 }); };
  map.loaded() ? go() : map.once('load', go);
}
$('b-plot').addEventListener('click', plot);
$('shared').$('b-exit').addEventListener('click', () => $('b-big').click());
addEventListener('keydown', e => { if (e.key === 'Enter') plot(); });
})();
