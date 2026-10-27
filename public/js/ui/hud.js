// HUD atas: kartu kedua pemain (Ingatan, peran) dan penunjuk waktu + komet.
import { $, esc } from '../util.js';
import { app } from '../app.js';
import { progresKomet } from '../engine/aturan.js';
import { INGATAN_MAX, JAM_B3 } from '../engine/state.js';

const WARNA = ['var(--taki)', 'var(--mitsuha)'];

function chip(s, k) {
  const p = s.players[k] || {}, aktif = s.phase === 'main' && s.giliran === k;
  let peran = k === 0 ? 'Pemain Taki · Tokyo' : 'Pemain Mitsuha · Itomori';
  if (s.babak === 1 && s.tukar) peran = k === 0 ? 'Di tubuh Mitsuha' : 'Di tubuh Taki';
  if (s.babak === 3) peran = k === 0 ? 'Tessie & Sayaka' : 'Mitsuha';
  let bar = '';
  for (let i = 0; i < INGATAN_MAX; i++) bar += `<i class="${i < s.ingatan[k] ? (s.ingatan[k] <= 3 ? 'on low' : 'on') : ''}"></i>`;
  return {
    aktif,
    html:`<div class="ava">${k === 0 ? '瀧' : '三'}</div>
      <div class="info"><div class="nm">${esc(p.name || (k === 0 ? 'Taki' : 'Mitsuha'))}${k === app.me ? '<span class="me">KAMU</span>' : ''}</div>
      <div class="peran">${esc(peran)}</div>
      <div class="ingat" title="Ingatan ${s.ingatan[k]}/${INGATAN_MAX}"><b>Ingatan ${s.ingatan[k]}</b>${bar}</div></div>`,
  };
}

export function renderHUD() {
  const s = app.S, hud = $('#hud');
  if (!s || s.phase === 'lobby') { hud.hidden = true; return; }
  hud.hidden = false;
  const me = app.me == null ? 0 : app.me, them = 1 - me;
  for (const [el, k] of [[$('#chipMe'), me], [$('#chipThem'), them]]) {
    const c = chip(s, k);
    el.innerHTML = c.html;
    el.classList.toggle('aktif', c.aktif);
    el.style.setProperty('--c', WARNA[k]);
  }
  let when;
  if (s.phase === 'senja') when = 'Senja <small>kataware-doki</small>';
  else if (s.babak === 3) when = `Jam ${s.jam} dari ${JAM_B3} <small>Babak 3 · Evakuasi</small>`;
  else when = `Hari ${s.hari} <small>Babak ${s.babak} · ${s.babak === 1 ? (s.tukar ? 'Bertukar tubuh' : 'Hari biasa') : 'Pencarian'}</small>`;
  $('#when').innerHTML = when;
  $('#kometFill').style.width = (progresKomet(s) * 100).toFixed(1) + '%';
}
