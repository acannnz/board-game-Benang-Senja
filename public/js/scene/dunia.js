// Dunia 3D: renderer, kamera, langit, bintang, komet, cahaya, dan loop animasi.
// THREE dan OrbitControls dimuat sebagai skrip global di index.html (r128).
const THREE = window.THREE;

export const dunia = {
  scene:null, camera:null, renderer:null, controls:null,
  tick:[],            // fungsi (dt, t) yang dipanggil setiap frame
};

// warna langit per suasana: [atas, bawah]
const SUASANA = {
  pagi:  { atas:0x2f63c9, bawah:0xf5c7a6, cahaya:1.0,  ambien:0.75, kabut:0x9fb3e0, bintang:0,    hemi:0xdfe8ff, sinar:0xfff1dc },
  redup: { atas:0x1d2756, bawah:0x8d84ad, cahaya:0.6,  ambien:0.55, kabut:0x4b4d7a, bintang:0.25, hemi:0xb8c0e8, sinar:0xe6e2f5 },
  senja: { atas:0x2b1d5e, bawah:0xff8f5e, cahaya:0.85, ambien:0.5,  kabut:0x8a4f6a, bintang:0.5,  hemi:0xffc9b0, sinar:0xffb07a },
  malam: { atas:0x050821, bawah:0x2a2152, cahaya:0.3,  ambien:0.32, kabut:0x1a1838, bintang:1,    hemi:0x6f7fd8, sinar:0x9fb4ff },
};
let langit, matLangit, bintang, matahari, ambien, komet, kometTarget = 0, kometNow = 0;
let suasanaKini = { ...SUASANA.pagi }, suasanaTuju = SUASANA.pagi;

export function initDunia(el) {
  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(el.clientWidth, el.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9fb3e0, 45, 110);
  const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 400);
  camera.position.set(0, 24, 27);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 2);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 7; controls.maxDistance = 55;
  controls.maxPolarAngle = 1.32;
  controls.screenSpacePanning = false;

  // langit gradasi
  matLangit = new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{ atas:{ value:new THREE.Color(SUASANA.pagi.atas) }, bawah:{ value:new THREE.Color(SUASANA.pagi.bawah) } },
    vertexShader:'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:'uniform vec3 atas; uniform vec3 bawah; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.15,0.0,1.0); gl_FragColor = vec4(mix(bawah, atas, pow(h,0.8)),1.0); }',
  });
  langit = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), matLangit);
  scene.add(langit);

  // bintang
  const pos = [];
  for (let i = 0; i < 700; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.2, r = 160;
    pos.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.9 + 10, r * Math.sin(ph) * Math.sin(th));
  }
  const gB = new THREE.BufferGeometry(); gB.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bintang = new THREE.Points(gB, new THREE.PointsMaterial({ color:0xffffff, size:0.9, transparent:true, opacity:0, fog:false, depthWrite:false }));
  scene.add(bintang);

  // cahaya
  ambien = new THREE.HemisphereLight(0xdfe8ff, 0x3a3050, 0.75);
  scene.add(ambien);
  matahari = new THREE.DirectionalLight(0xfff1dc, 1.0);
  matahari.position.set(-18, 30, 16);
  matahari.castShadow = true;
  matahari.shadow.mapSize.set(2048, 2048);
  const sc = matahari.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 90;
  matahari.shadow.bias = -0.0008;
  scene.add(matahari);

  // meja
  const meja = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color:0x26224a, roughness:1 }));
  meja.rotation.x = -Math.PI / 2; meja.position.y = -0.42; meja.receiveShadow = true;
  scene.add(meja);

  komet = buatKomet();
  scene.add(komet);

  Object.assign(dunia, { scene, camera, renderer, controls });
  window.addEventListener('resize', () => ukurUlang(el));
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    for (const f of dunia.tick) f(dt, t);
    animasiSuasana(dt);
    animasiKomet(dt, t);
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return dunia;
}

function ukurUlang(el) {
  const { camera, renderer } = dunia;
  camera.aspect = el.clientWidth / el.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(el.clientWidth, el.clientHeight);
}

/* ---------- suasana langit ---------- */
export function setSuasana(nama) { suasanaTuju = SUASANA[nama] || SUASANA.pagi; }
const cA = new THREE.Color(), cB = new THREE.Color();
function animasiSuasana(dt) {
  const k = Math.min(1, dt * 1.2), T = suasanaTuju;
  cA.set(T.atas); cB.set(T.bawah);
  matLangit.uniforms.atas.value.lerp(cA, k);
  matLangit.uniforms.bawah.value.lerp(cB, k);
  dunia.scene.fog.color.lerp(cA.set(T.kabut), k);
  matahari.intensity += (T.cahaya - matahari.intensity) * k;
  ambien.intensity += (T.ambien - ambien.intensity) * k;
  bintang.material.opacity += (T.bintang - bintang.material.opacity) * k;
  matahari.color.lerp(cB.set(T.sinar), k);
  ambien.color.lerp(cB.set(T.hemi), k);
}

/* ---------- komet ---------- */
function teksturCahaya(warnaDalam, warnaLuar) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, warnaDalam); gr.addColorStop(0.35, warnaLuar); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function buatKomet() {
  const grup = new THREE.Group();
  const inti = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshBasicMaterial({ color:0xeaf6ff, fog:false }));
  grup.add(inti);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map:teksturCahaya('rgba(255,255,255,1)', 'rgba(140,200,255,.55)'), blending:THREE.AdditiveBlending, depthWrite:false, fog:false }));
  glow.scale.set(7, 7, 1); grup.add(glow);
  // ekor: kerucut panjang dengan gradasi
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(120,180,255,0)'); gr.addColorStop(0.6, 'rgba(160,210,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,.9)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  const ekor = new THREE.Mesh(new THREE.ConeGeometry(1.4, 26, 16, 1, true), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(c), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false }));
  ekor.position.y = 13; grup.add(ekor);
  const ekor2 = ekor.clone(); ekor2.material = ekor.material.clone(); ekor2.material.color = new THREE.Color(0xff9ab0);
  ekor2.scale.set(0.6, 0.8, 0.6); ekor2.rotation.z = 0.12; ekor2.position.set(-0.8, 10, 0); grup.add(ekor2);
  grup.userData = { inti, glow, ekor, ekor2 };
  return grup;
}
// p: 0 (jauh) … 1 (menghantam Itomori)
export function setKomet(p) { kometTarget = p; }
const AWAL = new THREE.Vector3(-70, 75, -120), UJUNG = new THREE.Vector3(7.5, 0, 0), tmp = new THREE.Vector3();
function animasiKomet(dt, t) {
  kometNow += (kometTarget - kometNow) * Math.min(1, dt * 0.8);
  const p = kometNow, e = Math.pow(p, 2.2);
  tmp.copy(AWAL).lerp(UJUNG, e * 0.9);
  komet.position.copy(tmp);
  // ekor menjauhi arah datang
  komet.lookAt(AWAL); komet.rotateX(Math.PI / 2);
  const s = 0.6 + p * 1.3;
  komet.scale.setScalar(s);
  komet.userData.glow.material.opacity = 0.7 + Math.sin(t * 3) * 0.15;
  komet.userData.ekor2.visible = p > 0.7;
}

/* ---------- kamera ---------- */
let tween = null;
export function arahkanKamera(target, jarak = 17, tinggi = 0.85, durasi = 1.1) {
  const { camera, controls } = dunia;
  const t0 = controls.target.clone(), p0 = camera.position.clone();
  const t1 = new THREE.Vector3(target[0], 0, target[1]);
  const dir = p0.clone().sub(t0); dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
  dir.normalize();
  const p1 = t1.clone().add(dir.multiplyScalar(jarak * Math.cos(tinggi))).setY(jarak * Math.sin(tinggi));
  const mulai = performance.now();
  if (tween) dunia.tick.splice(dunia.tick.indexOf(tween), 1);
  tween = () => {
    const k = Math.min(1, (performance.now() - mulai) / (durasi * 1000)), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    controls.target.lerpVectors(t0, t1, e);
    camera.position.lerpVectors(p0, p1, e);
    if (k >= 1) { dunia.tick.splice(dunia.tick.indexOf(tween), 1); tween = null; }
  };
  dunia.tick.push(tween);
}

/* ---------- memilih objek dengan ketukan ---------- */
export function pasangPilih(objek, cb) {
  const ray = new THREE.Raycaster(), m = new THREE.Vector2(), el = dunia.renderer.domElement;
  let down = null;
  el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  el.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8) return;
    const r = el.getBoundingClientRect();
    m.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(m, dunia.camera);
    const hit = ray.intersectObjects(objek(), false).find(h => h.object.visible !== false);
    if (hit) cb(hit.object.userData.pilih);
  });
}

export function kilatan(posisi, warna = 0xffa040, kuat = 6) {
  const lampu = new THREE.PointLight(warna, kuat, 16);
  lampu.position.set(posisi[0], 2, posisi[1]);
  dunia.scene.add(lampu);
  const mulai = performance.now();
  const f = () => {
    const k = (performance.now() - mulai) / 1400;
    lampu.intensity = kuat * Math.max(0, 1 - k);
    if (k >= 1) { dunia.scene.remove(lampu); dunia.tick.splice(dunia.tick.indexOf(f), 1); }
  };
  dunia.tick.push(f);
}
