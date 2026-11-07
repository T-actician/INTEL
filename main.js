const { app, BrowserWindow, ipcMain } = require('electron');
const net = require('net');
const path = require('path');

const cache = new Map();

function isPublic(ip) {
  const v = net.isIP(ip);
  if (!v) return false;
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    return true;
  }
  const l = ip.toLowerCase();
  return !(l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80'));
}

function collect(entities, abuse, other) {
  for (const ent of entities || []) {
    const roles = ent.roles || [];
    for (const item of (ent.vcardArray || [null, []])[1] || []) {
      if (item[0] === 'email') (roles.includes('abuse') ? abuse : other).add(item[3]);
    }
    collect(ent.entities, abuse, other);
  }
}

async function getJson(url, ms, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(ms) });
  return res.json();
}

async function lookup(raw) {
  const ip = String(raw || '').trim();
  if (!isPublic(ip)) throw new Error('Enter a valid public IP address');
  if (cache.has(ip)) return cache.get(ip);

  const fields = 'status,message,country,regionName,city,lat,lon,isp,org,as,proxy,hosting,mobile';
  const [g, r] = await Promise.allSettled([
    getJson(`http://ip-api.com/json/${ip}?fields=${fields}`, 8000),
    getJson(`https://rdap.org/ip/${ip}`, 10000, { Accept: 'application/rdap+json' }),
  ]);

  if (g.status !== 'fulfilled') throw new Error('Geolocation failed: check your internet connection');
  const geo = g.value;
  if (geo.status !== 'success') throw new Error(geo.message || 'Geolocation failed');

  const rdap = r.status === 'fulfilled' ? r.value : null;
  const abuse = new Set(), other = new Set();
  collect(rdap && rdap.entities, abuse, other);

  const result = {
    ip,
    geo,
    rdap_ok: !!rdap,
    network_name: rdap ? rdap.name : null,
    range: rdap ? `${rdap.startAddress} - ${rdap.endAddress}` : null,
    country_code: rdap ? rdap.country : null,
    abuse_contacts: [...abuse].sort(),
    other_contacts: [...other].filter((e) => !abuse.has(e)).sort(),
  };
  cache.set(ip, result);
  return result;
}

ipcMain.handle('lookup', async (_e, ip) => {
  try {
    return { ok: true, data: await lookup(ip) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 680,
    title: 'INTEL HUD',
    backgroundColor: '#02060d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
