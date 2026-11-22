
const LAND = window.LAND;
const $ = id => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion:reduce)').matches;
const rad = Math.PI / 180;
const cv = $('globe'), ctx = cv.getContext('2d');
let W = 0, R0 = 0;
let view = {lon: 20, lat: 15, zoom: 1}, target = null, anim = null, idle = true;

function size(){
  const w = cv.parentElement.getBoundingClientRect().width, d = devicePixelRatio || 1;
  W = w; cv.width = cv.height = Math.round(w * d);
  ctx.setTransform(d, 0, 0, d, 0, 0);
  R0 = w / 2 * 0.92;
}
addEventListener('resize', size);

function project(lon, lat, v, R){
  const l = (lon - v.lon) * rad, p = lat * rad, p0 = v.lat * rad;
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  let x = Math.cos(p) * Math.sin(l);
  let y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l);
  if (cosc < 0){ const m = Math.hypot(x, y) || 1; x /= m; y /= m; }
  return [W / 2 + x * R, W / 2 - y * R, cosc >= 0];
}

function graticule(R){
  ctx.strokeStyle = 'rgba(25,181,255,.18)'; ctx.lineWidth = 1;
  const line = pts => {
    ctx.beginPath(); let pen = false;
    for (const [lo, la] of pts){
      const [x, y, vis] = project(lo, la, view, R);
      if (!vis){ pen = false; continue; }
      pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true;
    }
    ctx.stroke();
  };
  for (let lo = -180; lo < 180; lo += 30){
    const pts = []; for (let la = -90; la <= 90; la += 4) pts.push([lo, la]); line(pts);
  }
  for (let la = -60; la <= 60; la += 30){
    const pts = []; for (let lo = -180; lo <= 180; lo += 4) pts.push([lo, la]); line(pts);
  }
}

function draw(t){
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2, 0, 7); ctx.clip();
  const bg = ctx.createRadialGradient(W / 2, W / 2, W * .1, W / 2, W / 2, W / 2);
  bg.addColorStop(0, '#07253d'); bg.addColorStop(1, '#020a14');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, W);

  const R = R0 * view.zoom;
  ctx.beginPath(); ctx.arc(W / 2, W / 2, R, 0, 7);
  ctx.fillStyle = '#031626'; ctx.fill();
  graticule(R);

  ctx.fillStyle = 'rgba(25,120,170,.45)'; ctx.strokeStyle = 'rgba(95,208,255,.8)'; ctx.lineWidth = 1;
  for (const ring of LAND){
    ctx.beginPath();
    for (let i = 0; i < ring.length; i += 2){
      const [x, y] = project(ring[i], ring[i + 1], view, R);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  if (target){
    const [x, y, vis] = project(target.lon, target.lat, view, R);
    if (vis){
      const pulse = RM ? 0.5 : (t / 1200) % 1;
      ctx.strokeStyle = '#ff9d2e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fillStyle = '#ff9d2e'; ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1 - pulse;
      ctx.beginPath(); ctx.arc(x, y, 8 + pulse * 30, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
      const acc = 30 / 6371 * R;
      ctx.setLineDash([4, 6]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, acc, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '600 13px Consolas,monospace'; ctx.fillStyle = '#ff9d2e';
      ctx.fillText(target.label, x + 14, y - 12);
    }
  }
  ctx.restore();
}

function frame(t){
  if (anim){
    const k = Math.min(1, (t - anim.t0) / anim.dur), e = 1 - Math.pow(1 - k, 3);
    view.lon = anim.from.lon + anim.dlon * e;
    view.lat = anim.from.lat + (anim.to.lat - anim.from.lat) * e;
    view.zoom = anim.from.zoom + (anim.to.zoom - anim.from.zoom) * e;
    if (k >= 1) anim = null;
  } else if (idle && !RM){
    view.lon += 0.12;
  }
  draw(t);
  requestAnimationFrame(frame);
}

function flyTo(lon, lat, zoom){
  idle = false;
  const dlon = ((lon - view.lon + 540) % 360) - 180;
  if (RM){ view = {lon: view.lon + dlon, lat, zoom}; return; }
  anim = {t0: performance.now(), dur: 2400, from: {...view}, to: {lat, zoom}, dlon};
}

function log(msg, cls){
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  $('log').appendChild(d); $('log').scrollTop = $('log').scrollHeight;
}
const setText = (id, v) => { $(id).textContent = (v === undefined || v === null || v === '') ? '--' : v; };
function lamp(id, on, warn){ $(id).className = 'lamp ' + (on ? (warn ? 'on-warn' : 'on-ok') : ''); }
function mails(id, list){
  const el = $(id); el.textContent = '';
  if (!list.length){ el.textContent = '--'; return; }
  list.forEach(m => { const d = document.createElement('div'); d.textContent = m; el.appendChild(d); });
}

function render(r){
  const g = r.geo;
  setText('t-ip', r.ip); setText('country', g.country + ' (' + (r.country_code || '?') + ')');
  setText('region', g.regionName); setText('city', g.city);
  setText('coords', g.lat.toFixed(4) + ', ' + g.lon.toFixed(4));
  setText('isp', g.isp); setText('org', g.org); setText('asn', g.as);
  setText('netname', r.network_name); setText('range', r.range);
  mails('abuse', r.abuse_contacts); mails('other', r.other_contacts);
  lamp('l-proxy', g.proxy, true); lamp('l-hosting', g.hosting, true); lamp('l-mobile', g.mobile, false);
  target = {lon: g.lon, lat: g.lat, label: g.city + ', ' + g.country};
  flyTo(g.lon, g.lat, 4);
}

async function scan(){
  const btn = $('scan'), ip = $('ip').value.trim();
  btn.disabled = true; btn.classList.remove('ok'); btn.textContent = 'SCANNING...';
  log('Scan started: ' + ip);
  try{
    const res = await window.intel.lookup(ip);
    if (!res.ok) throw new Error(res.error || 'Lookup failed');
    const data = res.data;
    log('Geolocation resolved: ' + data.geo.city + ', ' + data.geo.country);
    log(data.rdap_ok ? 'Network owner: ' + data.network_name + ' / ' + data.geo.as
                     : 'RDAP registry unavailable (' + (data.rdap_error || 'unknown') + '), showing geolocation data only', data.rdap_ok ? '' : 'err');
    log('Abuse contacts found: ' + data.abuse_contacts.length);
    render(data);
    btn.textContent = 'SCAN COMPLETE'; btn.classList.add('ok');
    log('Scan complete.');
  }catch(e){
    log('ERROR: ' + e.message, 'err');
    btn.textContent = 'SCAN FAILED';
  }finally{
    btn.disabled = false;
    setTimeout(() => { btn.textContent = 'SCAN'; btn.classList.remove('ok'); }, 2500);
  }
}
$('scan').addEventListener('click', scan);
$('ip').addEventListener('keydown', e => { if (e.key === 'Enter') scan(); });
size(); requestAnimationFrame(frame);
log('System online. Enter an IP address and press SCAN.');
window.intel.onUpdate((msg) => log(msg));
