// Papan 3D: diorama Tokyo dan Itomori, jalur, bangunan tiap lokasi, tokoh, pion, warga, dan peta desa Hida.
import { PAPAN, LOKASI, JALUR, TOKOH, DESA, DANAU } from '../data/peta.js';
import { statusDesa } from '../engine/aturan.js';
import { dunia, kilatan } from './dunia.js';
const THREE = window.THREE;

export const WARNA_PEMAIN = [0x5b8cff, 0xff6f91];
const WARNA_PION = { taki:0x3d5fb8, mitsuha:0xd2506f, tessie:0xe0a73a, sayaka:0x4fae7d };
const WARNA_TOKOH = { tsukasa:0x7a8bb0, okudera:0xb07a9c, nenek:0x9b8a78, yotsuha:0xe88fa8, tessie:0xe0a73a, sayaka:0x4fae7d, ayah:0x5d6470 };

const pilihan = [];          // mesh tak terlihat untuk raycast
const sorot = {};            // id lokasi / slot desa -> mesh cincin sorot
const pion = {};             // nama pion -> Group
const tokoh = {};            // id tokoh -> Group
const wargaGrup = {};        // lokasi -> Group
const desaTile = [];         // slot -> { mesh, label, silang }
let hidaGrup, matJendelaItomori, matJendelaTokyo, sedangGerak = new Set(), aktif = [];

/* ---------- pembantu ---------- */
const cacheMat = {};
function mat(warna, opt = {}) {
  const k = warna + JSON.stringify(opt);
  return cacheMat[k] || (cacheMat[k] = new THREE.MeshStandardMaterial(Object.assign({ color:warna, roughness:0.85, metalness:0.02 }, opt)));
}
function kotak(w, h, d, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === 'number' ? mat(m) : m);
  o.position.set(x, y + h / 2, z); o.castShadow = true; o.receiveShadow = true;
  return o;
}
function silinder(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 16) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof m === 'number' ? mat(m) : m);
  o.position.set(x, y + h / 2, z); o.castShadow = true; o.receiveShadow = true;
  return o;
}
// atap pelana: prisma segitiga memanjang ke sumbu x, alasnya di ketinggian y
function atapPelana(w, h, d, warna, y) {
  const geo = new THREE.CylinderGeometry(h, h, w, 3, 1, false, Math.PI / 2);
  geo.rotateZ(Math.PI / 2);
  geo.scale(1, 1, (d / 2) / (0.866 * h));
  const o = new THREE.Mesh(geo, mat(warna));
  o.position.y = y + h * 0.5; o.castShadow = true;
  return o;
}
function torii(warna = 0xd23a2c, s = 1) {
  const g = new THREE.Group();
  g.add(silinder(0.04 * s, 0.04 * s, 0.6 * s, warna, -0.25 * s, 0, 0, 8));
  g.add(silinder(0.04 * s, 0.04 * s, 0.6 * s, warna, 0.25 * s, 0, 0, 8));
  g.add(kotak(0.75 * s, 0.06 * s, 0.08 * s, warna, 0, 0.6 * s, 0));
  g.add(kotak(0.62 * s, 0.04 * s, 0.06 * s, warna, 0, 0.47 * s, 0));
  return g;
}
export function teksSprite(teks, opt = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const fs = 44, pad = 22, font = `700 ${fs}px "Zen Maru Gothic", system-ui, sans-serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(teks).width) + pad * 2, h = fs + pad;
  c.width = w; c.height = h;
  g.font = font;
  g.fillStyle = opt.bg || 'rgba(16,19,52,.78)';
  const r = h / 2;
  g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill();
  g.fillStyle = opt.warna || '#fbf3e4'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(teks, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, depthWrite:false, transparent:true }));
  const tinggi = opt.tinggi || 0.36;
  sp.scale.set(tinggi * w / h, tinggi, 1);
  sp.renderOrder = 5;
  return sp;
}
function teksturJendela(warnaDinding) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = warnaDinding; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 124; y += 14) for (let x = 6; x < 60; x += 14) {
    g.fillStyle = Math.random() < 0.7 ? '#ffd890' : '#2a2a40'; g.fillRect(x, y, 8, 8);
  }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  return t;
}

export function posisiDunia(id) {
  if (id === 'hida') return [PAPAN.hida.pusat[0] - 5.0, PAPAN.hida.pusat[1] + 0.2];
  if (id === 'h_gunung') { const p = posisiDunia('i_gunung'); return [p[0] + 0.55, p[1] + 0.45]; }
  const L = LOKASI[id], P = PAPAN[L.papan].pusat;
  return [P[0] + L.xz[0], P[1] + L.xz[1]];
}
// tinggi permukaan di lokasi (Kuil Gunung ada di atas bukit)
const tinggiDi = id => (id === 'i_gunung' || id === 'h_gunung' ? 1.25 : 0);

/* ---------- membangun papan ---------- */
export function buatPapan() {
  const scene = dunia.scene;
  matJendelaTokyo = new THREE.MeshStandardMaterial({ map:teksturJendela('#5a6286'), emissiveMap:teksturJendela('#000'), emissive:0xffd890, emissiveIntensity:0.25, roughness:0.7 });
  matJendelaItomori = new THREE.MeshStandardMaterial({ color:0xf3e6cc, emissive:0xffc070, emissiveIntensity:0.15, roughness:0.8 });

  scene.add(alas('tokyo', 0x3c4363, 0x4a5276));
  scene.add(alas('itomori', 0x5b8a4c, 0x6a9a58));
  scene.add(danau());
  scene.add(gunung());

  for (const [a, b, biaya] of JALUR) scene.add(jalan(a, b, biaya));
  for (const id in LOKASI) scene.add(lokasi(id));
  scene.add(isiKota());
  for (const id in TOKOH) {
    const g = sosok(WARNA_TOKOH[id], 0.75), [x, z] = posisiDunia(TOKOH[id].lokasi);
    g.position.set(x + 0.62, 0, z - 0.05);
    tokoh[id] = g; scene.add(g);
  }
  for (const nama in WARNA_PION) { pion[nama] = buatPion(nama); scene.add(pion[nama]); }
  scene.add(buatHida());

  const judul = (teks, p, dz) => { const s = teksSprite(teks, { tinggi:0.7, bg:'rgba(255,122,69,.85)' }); s.position.set(p[0], 0.5, p[1] + dz); scene.add(s); };
  judul('TOKYO', PAPAN.tokyo.pusat, 6.1);
  judul('ITOMORI', PAPAN.itomori.pusat, 6.1);

  dunia.tick.push(animasi);
}

function alas(papan, warna, warnaTepi) {
  const g = new THREE.Group(), [cx, cz] = PAPAN[papan].pusat;
  const dasar = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.5, 11.6), [mat(warnaTepi), mat(warnaTepi), mat(warna), mat(warnaTepi), mat(warnaTepi), mat(warnaTepi)]);
  dasar.position.set(cx, -0.25, cz); dasar.receiveShadow = true;
  g.add(dasar);
  return g;
}
function danau() {
  const [cx, cz] = PAPAN.itomori.pusat, d = DANAU;
  const m = new THREE.Mesh(new THREE.CircleGeometry(d.r, 48), new THREE.MeshStandardMaterial({ color:0x3f86c6, roughness:0.15, metalness:0.2, emissive:0x10305a, emissiveIntensity:0.4 }));
  m.rotation.x = -Math.PI / 2; m.position.set(cx + d.pusat[0], 0.015, cz + d.pusat[1]); m.receiveShadow = true;
  const tepi = new THREE.Mesh(new THREE.RingGeometry(d.r, d.r + 0.18, 48), mat(0xcbbb8a));
  tepi.rotation.x = -Math.PI / 2; tepi.position.set(cx + d.pusat[0], 0.012, cz + d.pusat[1]);
  const g = new THREE.Group(); g.add(m, tepi);
  dunia.tick.push((dt, t) => { m.material.emissiveIntensity = 0.35 + Math.sin(t * 0.8) * 0.08; });
  return g;
}
function gunung() {
  const [x, z] = posisiDunia('i_gunung'), g = new THREE.Group();
  const bukit = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 2.1, 1.25, 20), mat(0x4c7340));
  bukit.position.set(x, 0.62, z - 0.2); bukit.castShadow = true; bukit.receiveShadow = true;
  const kawah = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), mat(0x3e5d33));
  kawah.rotation.x = -Math.PI / 2; kawah.position.set(x, 1.26, z - 0.2);
  g.add(bukit, kawah);
  // perbukitan di belakang Itomori
  const [cx, cz] = PAPAN.itomori.pusat;
  [[-1.2, -5.2, 1.3], [1.4, -5.3, 1.1], [4.9, -4.6, 1.2], [5.2, -1.4, 0.9], [-5.2, 4.8, 0.8]].forEach(([dx, dz, h]) => {
    const b = new THREE.Mesh(new THREE.ConeGeometry(1.0, h, 7), mat(0x557d46));
    b.position.set(cx + dx, h / 2, cz + dz); b.castShadow = true; g.add(b);
  });
  return g;
}
function jalan(a, b, biaya) {
  const [x1, z1] = posisiDunia(a), [x2, z2] = posisiDunia(b);
  const tokyo = LOKASI[a].papan === 'tokyo', dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, len), mat(biaya > 1 ? 0xa88f5f : tokyo ? 0x8c91aa : 0xd8c597));
  m.position.set((x1 + x2) / 2, 0.015, (z1 + z2) / 2); m.rotation.y = Math.atan2(dx, dz); m.receiveShadow = true;
  if (biaya > 1) { m.position.y = 0.62; m.rotation.x = -Math.atan2(1.25, len) * Math.sign(z1 - z2 || 1); m.scale.z = 1.08; }
  return m;
}

function lokasi(id) {
  const L = LOKASI[id], [x, z] = posisiDunia(id), y0 = tinggiDi(id), g = new THREE.Group();
  g.position.set(x, y0, z);
  const tokyo = L.papan === 'tokyo';
  const alasL = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.04, 32), mat(tokyo ? 0x555d82 : 0x7aa863));
  alasL.position.y = 0.02; alasL.receiveShadow = true; g.add(alasL);
  const model = bangunan(L.bentuk); model.position.z = -0.25; g.add(model);

  const cincin = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.05, 40), new THREE.MeshBasicMaterial({ color:0xffcf70, transparent:true, opacity:0.9, side:THREE.DoubleSide }));
  cincin.rotation.x = -Math.PI / 2; cincin.position.y = 0.06; cincin.visible = false;
  g.add(cincin); sorot[id] = cincin;

  const label = teksSprite(L.nama); label.position.set(0, 1.85, 0.2); g.add(label);

  const pick = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.2, 12), new THREE.MeshBasicMaterial({ visible:false }));
  pick.position.y = 1.1; pick.userData.pilih = { jenis:'lokasi', id };
  g.add(pick); pilihan.push(pick);
  return g;
}

// model kecil untuk setiap bentuk bangunan (ukuran ± 1 × 1)
function bangunan(bentuk) {
  const g = new THREE.Group();
  switch (bentuk) {
    case 'apartemen': g.add(kotak(0.8, 1.4, 0.6, matJendelaTokyo)); g.add(kotak(0.86, 0.06, 0.66, 0x2d3150, 0, 1.4)); break;
    case 'stasiun': g.add(kotak(1.1, 0.45, 0.6, 0xc9ccd8)); g.add(kotak(1.3, 0.06, 0.8, 0x3d6fbf, 0, 0.45)); g.add(kotak(0.12, 0.12, 0.62, 0x2a8a4a, -0.3, 0.2)); break;
    case 'sekolah': g.add(kotak(1.15, 0.55, 0.5, 0xe8e2d0)); g.add(kotak(0.3, 0.9, 0.3, 0xe8e2d0, 0, 0, 0.05)); g.add(silinder(0.1, 0.1, 0.02, 0x333344, 0, 0.75, 0.21)); break;
    case 'perpus': g.add(kotak(0.95, 0.5, 0.6, 0xb98f6a)); for (let i = -1; i <= 1; i++) g.add(silinder(0.05, 0.05, 0.5, 0xf2e8d5, i * 0.3, 0, 0.33, 8)); g.add(kotak(1.05, 0.08, 0.7, 0x6a4a3a, 0, 0.5)); break;
    case 'menara': g.add(silinder(0.12, 0.22, 1.7, 0xd94a3a, 0, 0, 0, 8)); g.add(silinder(0.28, 0.28, 0.2, 0xf2f2f2, 0, 1.25, 0, 12)); g.add(silinder(0.02, 0.02, 0.35, 0xdddddd, 0, 1.7, 0, 6)); break;
    case 'resto': g.add(kotak(0.9, 0.55, 0.6, 0xf0e1c8)); g.add(kotak(0.95, 0.06, 0.3, 0xc0392b, 0, 0.45, 0.38)); break;
    case 'kafe': g.add(kotak(0.75, 0.5, 0.55, 0xf7c6d0)); g.add(kotak(0.8, 0.05, 0.25, 0xffffff, 0, 0.42, 0.34)); g.add(silinder(0.12, 0.12, 0.04, 0xff7a45, 0.28, 0.6, 0.28)); break;
    case 'tangga': for (let i = 0; i < 5; i++) g.add(kotak(0.6, 0.12, 0.18, 0xbfb5a0, 0, i * 0.12, 0.3 - i * 0.16)); { const t = torii(0xd23a2c, 0.8); t.position.set(0, 0.6, -0.5); g.add(t); } break;
    case 'gunung': g.add(kotak(0.4, 0.3, 0.35, 0x8a6a4a)); g.add(atapPelana(0.5, 0.22, 0.45, 0x3a3030, 0.3)); { const t = torii(0xd23a2c, 0.6); t.position.set(0, 0, 0.45); g.add(t); } break;
    case 'kuil': g.add(kotak(0.7, 0.4, 0.55, 0x9c7650)); { const r = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.4, 4), mat(0x2f2a33)); r.rotation.y = Math.PI / 4; r.position.y = 0.6; r.castShadow = true; g.add(r); const t = torii(); t.position.set(0, 0, 0.55); g.add(t); } break;
    case 'rumah': g.add(kotak(0.7, 0.42, 0.55, matJendelaItomori)); g.add(atapPelana(0.8, 0.28, 0.65, 0x4a4a5a, 0.42)); break;
    case 'bangku': g.add(kotak(0.6, 0.06, 0.2, 0x8a5a3a, -0.15, 0.18)); g.add(kotak(0.06, 0.18, 0.18, 0x5a3a2a, -0.4)); g.add(kotak(0.06, 0.18, 0.18, 0x5a3a2a, 0.1));
      g.add(kotak(0.3, 0.6, 0.25, new THREE.MeshStandardMaterial({ color:0xd8433a, emissive:0xffffff, emissiveIntensity:0.05 }), 0.35, 0)); break;
    case 'dermaga': g.add(kotak(0.35, 0.05, 1.0, 0x9a7650, 0, 0.05, -0.3)); g.add(silinder(0.04, 0.04, 0.3, 0x6a4a30, 0.15, -0.1, -0.75, 6)); g.add(silinder(0.04, 0.04, 0.3, 0x6a4a30, -0.15, -0.1, -0.75, 6)); break;
    case 'gardu': g.add(kotak(0.9, 0.04, 0.7, 0x777777)); g.add(kotak(0.3, 0.45, 0.3, 0x9aa0a8, -0.2)); g.add(kotak(0.25, 0.35, 0.25, 0x9aa0a8, 0.2, 0, 0.1));
      g.add(silinder(0.03, 0.03, 1.0, 0x555555, 0.35, 0, -0.25, 6)); g.add(kotak(0.4, 0.04, 0.04, 0x555555, 0.35, 0.92, -0.25)); break;
    case 'balai': g.add(kotak(1.0, 0.6, 0.55, 0xd9d4c4)); g.add(kotak(0.4, 0.2, 0.4, 0xd9d4c4, 0, 0.6)); g.add(silinder(0.02, 0.02, 1.0, 0xcccccc, 0.55, 0, 0.3, 6)); g.add(kotak(0.25, 0.15, 0.01, 0xffffff, 0.68, 0.82, 0.3)); break;
    case 'siaran': g.add(silinder(0.04, 0.04, 1.3, 0x888888, 0, 0, 0, 6));
      for (const a of [0, 2.1, 4.2]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 10, 1, true), mat(0xdddddd)); c.position.set(Math.cos(a) * 0.12, 1.15, Math.sin(a) * 0.12); c.rotation.z = Math.PI / 2; c.rotation.y = -a; g.add(c); }
      g.add(kotak(0.5, 0.35, 0.35, 0xe8e2d0, 0.35)); break;
  }
  return g;
}

// gedung pengisi Tokyo dan rumah/pohon pengisi Itomori
function isiKota() {
  const g = new THREE.Group(), locs = Object.keys(LOKASI);
  const dekatJalan = (x, z, papan) => JALUR.some(([a, b]) => {
    if (LOKASI[a].papan !== papan) return false;
    const [x1, z1] = posisiDunia(a), [x2, z2] = posisiDunia(b), dx = x2 - x1, dz = z2 - z1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz)) < 0.55;
  });
  const dekatLokasi = (x, z) => locs.some(id => { const [lx, lz] = posisiDunia(id); return Math.hypot(x - lx, z - lz) < 1.45; });
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const [tx, tz] = PAPAN.tokyo.pusat;
  for (let ix = -5; ix <= 5; ix++) for (let iz = -5; iz <= 5; iz++) {
    const x = tx + ix * 1.0 + (rnd() - 0.5) * 0.2, z = tz + iz * 1.0 + (rnd() - 0.5) * 0.2;
    if (Math.abs(ix) > 5 || dekatLokasi(x, z) || dekatJalan(x, z, 'tokyo') || rnd() < 0.25) continue;
    const h = 0.4 + Math.pow(rnd(), 2) * 2.4;
    g.add(kotak(0.6, h, 0.6, matJendelaTokyo, x, 0, z));
  }
  const [ix0, iz0] = PAPAN.itomori.pusat, [gx, gz] = posisiDunia('i_gunung');
  for (let i = 0; i < 140; i++) {
    const x = ix0 + (rnd() - 0.5) * 10.8, z = iz0 + (rnd() - 0.5) * 10.8;
    const dDanau = Math.hypot(x - ix0 - DANAU.pusat[0], z - iz0 - DANAU.pusat[1]);
    if (dDanau < DANAU.r + 0.4 || dekatLokasi(x, z) || dekatJalan(x, z, 'itomori') || Math.hypot(x - gx, z - gz + 0.2) < 2.2) continue;
    if (rnd() < 0.3) {
      const r = new THREE.Group(); r.add(kotak(0.35, 0.25, 0.3, matJendelaItomori)); r.add(atapPelana(0.42, 0.16, 0.36, 0x5a4a4a, 0.25));
      r.position.set(x, 0, z); r.rotation.y = rnd() * Math.PI; g.add(r);
    } else {
      const h = 0.4 + rnd() * 0.5, p = new THREE.Mesh(new THREE.ConeGeometry(0.18 + rnd() * 0.08, h, 7), mat(rnd() < 0.5 ? 0x2f6b3a : 0x3e7d44));
      p.position.set(x, h / 2, z); p.castShadow = true; g.add(p);
    }
  }
  return g;
}

function sosok(warna, s = 1) {
  const g = new THREE.Group();
  const badan = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 0.45 * s, 12), mat(warna));
  badan.position.y = 0.225 * s; badan.castShadow = true;
  const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 14, 10), mat(0xf3d6bd));
  kepala.position.y = 0.56 * s; kepala.castShadow = true;
  g.add(badan, kepala);
  return g;
}
function buatPion(nama) {
  const g = new THREE.Group(), tubuh = sosok(WARNA_PION[nama], 1.6);
  const rambut = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(nama === 'tessie' ? 0x6a4a2a : 0x1e1a24));
  rambut.position.y = 0.92; rambut.scale.setScalar(1.28); tubuh.add(rambut);
  if (nama === 'mitsuha') {
    const pita = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), mat(0xff3b30));
    pita.position.set(0, 1.02, -0.13); pita.rotation.x = 0.4; tubuh.add(pita);
  }
  if (nama === 'taki') {
    const gelang = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 14), mat(0xff7a45, { emissive:0xff5a20, emissiveIntensity:0.5 }));
    gelang.position.set(0.26, 0.38, 0); gelang.rotation.x = Math.PI / 2; tubuh.add(gelang);
  }
  g.add(tubuh);
  // cincin jiwa: warna pemain yang sedang menjalankan tubuh ini
  const jiwa = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.44, 32), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.95, side:THREE.DoubleSide }));
  jiwa.rotation.x = -Math.PI / 2; jiwa.position.y = 0.05;
  g.add(jiwa);
  g.userData = { tubuh, jiwa, lokasi:null };
  return g;
}

function buatHida() {
  hidaGrup = new THREE.Group();
  const [cx, cz] = PAPAN.hida.pusat;
  const dasar = kotak(12.4, 0.4, 5.8, 0x6d7a4f, cx, -0.4, cz);
  hidaGrup.add(dasar);
  const judul = teksSprite('PETA HIDA · cari desa di sketsa', { tinggi:0.5, bg:'rgba(255,122,69,.85)' });
  judul.position.set(cx, 0.6, cz + 3.4); hidaGrup.add(judul);
  const stasiun = kotak(0.9, 0.35, 0.5, 0xc9ccd8, cx - 5.0, 0, cz - 0.6); hidaGrup.add(stasiun);
  for (let i = 0; i < DESA.length; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    const x = cx - 2.9 + col * 2.2, z = cz - 1.9 + row * 1.9;
    const tile = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.2, 6), new THREE.MeshStandardMaterial({ color:0xf1e3c8, roughness:0.8 }));
    tile.position.set(x, 0.1, z); tile.castShadow = true; tile.receiveShadow = true;
    tile.userData.pilih = { jenis:'desa', slot:i };
    hidaGrup.add(tile); pilihan.push(tile);
    const atap = new THREE.Group();
    atap.add(kotak(0.28, 0.18, 0.24, 0xe8dcc0, -0.2, 0.2, 0.05));
    const genteng = atapPelana(0.34, 0.12, 0.28, 0x6a5040, 0.38); genteng.position.set(-0.2, genteng.position.y, 0.05); atap.add(genteng);
    const pohon = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 6), mat(0x2f6b3a)); pohon.position.set(0.25, 0.4, -0.15); atap.add(pohon);
    atap.position.set(x, 0, z); hidaGrup.add(atap);
    const label = teksSprite(`Desa ${i + 1}`, { tinggi:0.32 }); label.position.set(x, 0.95, z + 0.4); hidaGrup.add(label);
    const silang = new THREE.Group();
    const s1 = kotak(1.3, 0.05, 0.14, mat(0xc0392b, { emissive:0x801010, emissiveIntensity:0.4 })); s1.rotation.y = Math.PI / 4;
    const s2 = s1.clone(); s2.rotation.y = -Math.PI / 4;
    silang.add(s1, s2); silang.position.set(x, 0.25, z); silang.visible = false; hidaGrup.add(silang);
    const cincin = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 6), new THREE.MeshBasicMaterial({ color:0xffcf70, side:THREE.DoubleSide, transparent:true }));
    cincin.rotation.x = -Math.PI / 2; cincin.position.set(x, 0.22, z); cincin.visible = false; hidaGrup.add(cincin);
    sorot['desa' + i] = cincin;
    desaTile[i] = { tile, silang, label, x, z };
  }
  hidaGrup.visible = false;
  return hidaGrup;
}

/* ---------- sinkron dengan state ---------- */
export const objekPilih = () => pilihan.filter(o => { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; });

function pionTerlihat(s) {
  if (s.babak === 3) return ['mitsuha', 'tessie', 'sayaka'];
  return ['taki', 'mitsuha'];
}
function pengendali(s, nama) {
  if (s.babak === 3) return nama === 'mitsuha' ? 1 : 0;
  const tukar = s.babak === 1 && s.tukar;
  if (nama === 'taki') return tukar ? 1 : 0;
  return tukar ? 0 : 1;
}

// susun pion yang berbagi lokasi supaya tidak bertumpuk
function titikPion(s, nama) {
  const loc = s.pos[nama], sama = pionTerlihat(s).filter(p => s.pos[p] === loc), i = sama.indexOf(nama), n = sama.length;
  const [x, z] = posisiDunia(loc), off = (i - (n - 1) / 2) * 0.48;
  return new THREE.Vector3(x + off, tinggiDi(loc), z + 0.55);
}

export function perbarui(s, me) {
  if (!s || s.phase === 'lobby') return;
  const tampil = pionTerlihat(s);
  for (const nama in pion) {
    const p = pion[nama], ada = tampil.includes(nama) && s.pos[nama];
    p.visible = !!ada;
    if (!ada) continue;
    p.userData.jiwa.material.color.setHex(WARNA_PEMAIN[pengendali(s, nama)]);
    if (!sedangGerak.has(nama)) p.position.copy(titikPion(s, nama));
  }
  for (const id in tokoh) tokoh[id].visible = !(s.babak === 3 && (id === 'tessie' || id === 'sayaka'));
  hidaGrup.visible = s.babak >= 2;
  for (let i = 0; i < desaTile.length; i++) {
    const st = statusDesa(s, i), d = desaTile[i];
    d.silang.visible = st === 'coret';
    d.tile.material.color.setHex(st === 'itomori' ? 0xff9a5c : st === 'coret' ? 0x4a4560 : 0xf1e3c8);
    d.tile.material.emissive.setHex(st === 'itomori' ? 0xff5a20 : 0x000000);
    d.tile.material.emissiveIntensity = st === 'itomori' ? 0.6 : 0;
  }
  aturWarga(s);
  const malam = s.babak === 3 || s.phase === 'senja';
  matJendelaItomori.emissiveIntensity = s.evak && s.evak.listrikMati ? 0 : malam ? 0.9 : 0.15;
  matJendelaTokyo.emissiveIntensity = s.babak === 2 ? 0.6 : 0.25;
  aktif = s.phase === 'main' ? pionAktif(s) : [];
}
function pionAktif(s) {
  if (s.babak === 3) return s.giliran === 1 ? ['mitsuha'] : ['tessie', 'sayaka'];
  const tukar = s.babak === 1 && s.tukar;
  if (s.giliran === 0) return [tukar ? 'mitsuha' : 'taki'];
  return [tukar ? 'taki' : 'mitsuha'];
}

function aturWarga(s) {
  const data = s.evak ? Object.assign({}, s.evak.warga, { aman:s.evak.aman }) : {};
  for (const loc of Object.keys(wargaGrup)) if (!(loc in data)) { dunia.scene.remove(wargaGrup[loc]); delete wargaGrup[loc]; }
  for (const loc in data) {
    const n = data[loc];
    let g = wargaGrup[loc];
    if (!g) { g = new THREE.Group(); wargaGrup[loc] = g; dunia.scene.add(g); }
    if (g.userData.n === n) continue;
    g.clear(); g.userData.n = n;
    const [x, z] = loc === 'aman' ? posisiDunia('i_sekolah') : posisiDunia(loc);
    // warga yang sudah aman berkumpul di halaman belakang Sekolah, yang menunggu di samping lokasinya
    const aman = loc === 'aman', kol = aman ? 6 : 2;
    const cx = aman ? x + 0.6 : x - 0.7, cz = aman ? z - 0.95 : z + 0.1, arahZ = aman ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const w = sosok(aman ? 0x9fe0b8 : 0xf4f0e6, 0.55);
      w.position.set(cx - (i % kol) * 0.24, 0, cz + arahZ * Math.floor(i / kol) * 0.24);
      g.add(w);
    }
  }
}

/* ---------- sorotan target ---------- */
export function setSorot(ids) {
  for (const k in sorot) sorot[k].visible = false;
  for (const id of ids) if (sorot[id]) sorot[id].visible = true;
}

/* ---------- animasi ---------- */
function animasi(dt, t) {
  for (const k in sorot) if (sorot[k].visible) sorot[k].material.opacity = 0.55 + Math.sin(t * 5) * 0.35;
  for (const nama in pion) {
    const p = pion[nama], on = aktif.includes(nama);
    p.userData.tubuh.position.y = on && !sedangGerak.has(nama) ? Math.abs(Math.sin(t * 3)) * 0.12 : 0;
    p.userData.jiwa.scale.setScalar(on ? 1 + Math.sin(t * 4) * 0.12 : 0.85);
  }
}

export function gerakPion(s, nama, dari, ke) {
  const p = pion[nama];
  if (!p || !p.visible) return Promise.resolve();
  const a = p.position.clone(), b = titikPion(s, nama);
  const tinggi = 0.9 + a.distanceTo(b) * 0.15, durasi = Math.min(1.1, 0.45 + a.distanceTo(b) * 0.06);
  sedangGerak.add(nama);
  return new Promise(res => {
    const mulai = performance.now();
    const f = () => {
      const k = Math.min(1, (performance.now() - mulai) / (durasi * 1000)), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      p.position.lerpVectors(a, b, e);
      p.position.y = a.y + (b.y - a.y) * e + Math.sin(Math.PI * k) * tinggi;
      if (k >= 1) { dunia.tick.splice(dunia.tick.indexOf(f), 1); sedangGerak.delete(nama); res(); }
    };
    dunia.tick.push(f);
  });
}

export function efekLedak() { kilatan(posisiDunia('i_gardu'), 0xff8a30, 14); }
export function efekSiaran() { kilatan(posisiDunia('i_siaran'), 0x7fd0ff, 8); }
export function efekTemu(slot) { const d = desaTile[slot]; if (d) kilatan([d.x, d.z], 0xff9a5c, 10); }
export function efekSenja() { kilatan(posisiDunia('i_gunung'), 0xff9a5c, 12); }
