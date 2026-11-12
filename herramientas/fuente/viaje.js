// Página web «Del campo a tu mesa»: huevo 3D, paisaje con capas, repisa 3D y mezclador de sonidos.
// Fuente de web/js/viaje.js. Para reconstruir: en la carpeta herramientas, `npm install` y `npm run construir`.
// Todo es mejora progresiva: sin JavaScript, sin WebGL o con «reducir movimiento», la página se lee completa.
import * as THREE from 'three';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const limita = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mezcla = (a, b, t) => a + (b - a) * t;
const suave = (a, b, v) => { const t = limita((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const raiz = document.documentElement;
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
const avance = el => { const r = el.getBoundingClientRect(); return limita(-r.top / Math.max(1, r.height - innerHeight)); };

/* ---------- Fechas: apertura del local y fin del descuento ---------- */
{
  const ahora = Date.now();
  if (ahora >= new Date('2026-11-23T00:00:00-03:00')) $('#estado').textContent = 'Abierto de lunes a sábado, 8:30 a 17:00';
  if (ahora >= new Date('2026-12-05T00:00:00-03:00')) $('#bienvenida').hidden = true;
}

/* ---------- Qué secciones están en pantalla (para no dibujar lo que no se ve) ---------- */
const fuera = r => r.bottom < -innerHeight * 0.15 || r.top > innerHeight * 1.15;
const enPantalla = { get: el => !fuera(el.getBoundingClientRect()) };
const vigila = el => el;
const cursor = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', e => { cursor.x = e.clientX / innerWidth * 2 - 1; cursor.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });

const cuadros = []; // funciones que corren en cada cuadro de animación

/* =================== Paneles y cuadros flotantes =================== */
if (!quieto) {
  raiz.classList.add('mov');
  const entran = $$('[data-entra]').map(vigila), flotan = $$('[data-vel]').map(vigila);
  flotan.forEach(el => { el._giro = parseFloat(getComputedStyle(el).getPropertyValue('--giro')) || 0; el._vel = parseFloat(el.dataset.vel); el._ty = 0; });
  entran.forEach(el => { el._ty = 0; });
  cuadros.push(() => {
    for (const el of entran) {
      const r = el.getBoundingClientRect(); if (fuera(r)) continue;
      const t = limita((innerHeight - (r.top - el._ty)) / (innerHeight * 0.42));
      el._ty = (1 - t) * 70;
      el.style.transform = `translate3d(0,${el._ty.toFixed(1)}px,0) rotate(${((1 - t) * -2.5).toFixed(2)}deg) scale(${(0.93 + 0.07 * t).toFixed(3)})`;
      el.style.opacity = (0.2 + 0.8 * t).toFixed(2);
    }
    for (const el of flotan) {
      const r = el.getBoundingClientRect(); if (fuera(r)) continue;
      const centro = r.top - el._ty + r.height / 2 - innerHeight / 2;
      el._ty = centro * el._vel;
      el.style.transform = `translate3d(${(cursor.sx * el._vel * 90).toFixed(1)}px,${el._ty.toFixed(1)}px,0) rotate(${(el._giro + cursor.sx * el._vel * 14).toFixed(2)}deg)`;
    }
  });
}

/* =================== El viaje: paisaje con capas a distintas velocidades =================== */
if (!quieto) {
  const azar = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
  const svg = (w, cuerpo) => `<svg viewBox="0 0 ${w} 600" xmlns="http://www.w3.org/2000/svg">${cuerpo}</svg>`;
  // Cordillera: lejos, se mueve poco
  let c = '';
  for (let x = -100; x < 2500; x += 150 + azar() * 130) {
    const h = 150 + azar() * 170, a = 150 + azar() * 110;
    c += `<path d="M${x} 470 L${x + a} ${470 - h} L${x + a * 2} 470Z" fill="#aab3a6"/><path d="M${x + a * 0.72} ${470 - h * 0.72} L${x + a} ${470 - h} L${x + a * 1.28} ${470 - h * 0.72} L${x + a * 1.1} ${470 - h * 0.62} L${x + a} ${470 - h * 0.7} L${x + a * 0.9} ${470 - h * 0.6}Z" fill="#fff"/>`;
  }
  const cordillera = svg(2400, c + '<rect y="468" width="2400" height="132" fill="#aab3a6"/>');
  // Cerros: a media distancia
  c = '';
  for (let x = -200; x < 3800; x += 260 + azar() * 220) c += `<ellipse cx="${x}" cy="520" rx="${260 + azar() * 200}" ry="${90 + azar() * 80}" fill="${azar() > 0.5 ? '#93a886' : '#839a76'}"/>`;
  const cerros = svg(3600, c);
  // Primer plano: la avícola al partir, el campo en el camino y la ciudad al llegar
  const arbol = (x, y, e = 1) => `<rect x="${x - 5 * e}" y="${y - 40 * e}" width="${10 * e}" height="${44 * e}" fill="#6b4a2b"/><circle cx="${x}" cy="${y - 62 * e}" r="${34 * e}" fill="#5f7d52"/><circle cx="${x + 18 * e}" cy="${y - 44 * e}" r="${22 * e}" fill="#7a9468"/>`;
  const pabellon = (x, y, w, techo) => `<rect x="${x}" y="${y}" width="${w}" height="46" fill="#f4f1e6"/><path d="M${x - 10} ${y} L${x + 14} ${y - 26} L${x + w - 14} ${y - 26} L${x + w + 10} ${y}Z" fill="${techo}"/>` +
    Array.from({ length: Math.floor(w / 46) }, (_, i) => `<rect x="${x + 16 + i * 46}" y="${y + 14}" width="22" height="14" fill="#9db7c4"/>`).join('');
  const silo = (x, y) => `<rect x="${x}" y="${y - 96}" width="44" height="96" fill="#cfd6da"/><path d="M${x} ${y - 96} L${x + 22} ${y - 122} L${x + 44} ${y - 96}Z" fill="#aeb8be"/><rect x="${x}" y="${y - 70}" width="44" height="4" fill="#aeb8be"/><rect x="${x}" y="${y - 40}" width="44" height="4" fill="#aeb8be"/>`;
  const edificio = (x, w, h, color) => `<rect x="${x}" y="${500 - h}" width="${w}" height="${h}" fill="${color}"/>` +
    Array.from({ length: Math.floor(h / 44) }, (_, f) => Array.from({ length: Math.floor(w / 36) }, (_, i) => `<rect x="${x + 10 + i * 36}" y="${500 - h + 14 + f * 44}" width="16" height="22" fill="#fff6c9"/>`).join('')).join('');
  c = '<rect y="470" width="6000" height="130" fill="#7a9468"/>';
  c += pabellon(120, 430, 420, '#c8281f') + pabellon(600, 430, 380, '#b8bfc2') + silo(1010, 476) + silo(1062, 476) + arbol(70, 478) + arbol(1180, 478, 1.2);
  c += '<rect x="330" y="372" width="250" height="40" rx="6" fill="#1a1a1a"/><text x="455" y="400" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="24" fill="#ffd92f">EL HUEVO SABROSO</text><rect x="352" y="412" width="8" height="18" fill="#1a1a1a"/><rect x="550" y="412" width="8" height="18" fill="#1a1a1a"/>';
  for (let x = 1320; x < 4500; x += 150 + azar() * 240) c += azar() > 0.35 ? arbol(x, 482, 0.8 + azar() * 0.7) : `<path d="M${x} 482v-34m26 34v-34m26 34v-34M${x - 12} 458h76M${x - 12} 472h76" stroke="#6b4a2b" stroke-width="5"/>`;
  for (let x = 1500; x < 4300; x += 520) c += `<path d="M${x} 500 q60 -22 120 0 t120 0 t120 0" fill="none" stroke="#5f7d52" stroke-width="6"/>`;
  c += '<rect x="2860" y="392" width="170" height="52" rx="6" fill="#1d5c36"/><text x="2945" y="426" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="26" fill="#fff">CHILLÁN</text><rect x="2938" y="444" width="10" height="40" fill="#6b4a2b"/>';
  c += edificio(4560, 150, 190, '#d9c9a8') + edificio(4730, 120, 260, '#c8b48e') + edificio(4870, 160, 150, '#e6d9bd');
  // El Emporio: fachada verde con toldo
  c += '<rect x="5080" y="330" width="560" height="170" fill="#1d5c36"/><rect x="5080" y="300" width="560" height="44" fill="#154428"/><text x="5360" y="332" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="30" fill="#fff">EMPORIO SABROSO</text>';
  c += Array.from({ length: 14 }, (_, i) => `<path d="M${5080 + i * 40} 344h40l-6 40h-40z" fill="${i % 2 ? '#f9b21b' : '#f07d1a'}"/>`).join('');
  c += '<rect x="5120" y="400" width="150" height="100" fill="#fff6c9"/><rect x="5300" y="390" width="90" height="110" fill="#fbf6ec"/><rect x="5420" y="400" width="180" height="100" fill="#fff6c9"/>';
  c += edificio(5680, 170, 220, '#d9c9a8') + edificio(5870, 140, 170, '#c8b48e');
  c += '<rect y="512" width="6000" height="62" fill="#3b3b35"/>' + Array.from({ length: 75 }, (_, i) => `<rect x="${i * 80 + 10}" y="540" width="44" height="6" fill="#f9b21b"/>`).join('') + '<rect y="574" width="6000" height="26" fill="#5f7d52"/>';
  const cerca = svg(6000, c);
  const camion = '<svg viewBox="0 0 280 150" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="18" width="178" height="96" rx="8" fill="#fffbea" stroke="#1a1a1a" stroke-width="5"/><rect x="6" y="84" width="178" height="14" fill="#1d5c36"/><ellipse cx="95" cy="52" rx="20" ry="26" fill="#ffd92f" stroke="#1a1a1a" stroke-width="4"/><path d="M184 44h52l32 34v36h-84z" fill="#1d5c36" stroke="#1a1a1a" stroke-width="5" stroke-linejoin="round"/><path d="M198 54h34l22 24h-56z" fill="#cfe9f5" stroke="#1a1a1a" stroke-width="4" stroke-linejoin="round"/><rect x="0" y="110" width="272" height="10" rx="4" fill="#1a1a1a"/>' +
    [62, 222].map(x => `<g class="rueda"><circle cx="${x}" cy="122" r="22" fill="#1a1a1a"/><circle cx="${x}" cy="122" r="9" fill="#cfd6da"/><path d="M${x - 20} 122h40M${x} 102v40" stroke="#cfd6da" stroke-width="3"/></g>`).join('') + '</svg>';
  const paisaje = $('#paisaje');
  paisaje.innerHTML = `<div class="cielo a"></div><div class="cielo b"></div><div class="astro"></div><div class="capa">${cordillera}</div><div class="capa">${cerros}</div><div class="capa">${cerca}</div><div class="camion">${camion}</div>`;
  const viaje = vigila($('#viaje')), capas = $$('.capa', paisaje), cieloB = $('.cielo.b', paisaje), astro = $('.astro', paisaje), cam = $('.camion', paisaje), hitos = $$('#hitos li');
  let pv = 0, hito = 0;
  cuadros.push(t => {
    if (!enPantalla.get(viaje)) return;
    pv = mezcla(pv, avance(viaje), 0.12);
    capas.forEach((capa, i) => {
      let max = Math.max(0, capa.offsetWidth - innerWidth);
      if (i === 2) max = Math.min(max, Math.max(0, capa.offsetWidth * (5360 / 6000) - innerWidth / 2)); // al llegar, el Emporio queda al centro
      capa.style.transform = `translate3d(${(-pv * max).toFixed(1)}px,0,0)`;
    });
    cieloB.style.opacity = suave(0.45, 0.95, pv).toFixed(3);
    astro.style.transform = `translate3d(${(-pv * 34).toFixed(1)}vw,${(pv * 9).toFixed(1)}vh,0)`;
    cam.style.setProperty('--giro-rueda', (pv * 5200).toFixed(0) + 'deg');
    cam.style.transform = `translate3d(0,${(Math.sin(t * 9) * (pv > 0.005 && pv < 0.995 ? 1.6 : 0)).toFixed(1)}px,0)`;
    const h = pv < 0.3 ? 0 : pv < 0.74 ? 1 : 2;
    if (h !== hito) { hitos[hito].classList.remove('activo'); hitos[h].classList.add('activo'); hito = h; }
  });
}

/* =================== El huevo (fotografía): se mece, pasa de blanco a café y se abre al bajar =================== */
if (!quieto) {
  const av = $('#avicola'), huevo = $('#huevo'), [, hCafe, hAbierto] = $$('img', huevo), hBlanco = $('img', huevo);
  let pH = 0;
  cuadros.push(t => {
    if (!enPantalla.get(av)) return;
    pH = mezcla(pH, avance(av), 0.08);
    const cafe = suave(0.3, 0.48, pH), abre = suave(0.66, 0.84, pH);
    hBlanco.style.opacity = (1 - abre).toFixed(3); hCafe.style.opacity = (cafe * (1 - abre)).toFixed(3); hAbierto.style.opacity = abre.toFixed(3);
    const mece = Math.sin(pH * Math.PI * 7) * 9 + cursor.sx * 6;
    huevo.style.transform = `translate(-50%,-50%) translateY(${(Math.sin(t * 1.2) * 10).toFixed(1)}px) perspective(900px) rotateY(${(cursor.sx * 20).toFixed(1)}deg) rotateX(${(-cursor.sy * 12).toFixed(1)}deg) rotate(${mece.toFixed(1)}deg) scale(${(1 + abre * 0.08 + Math.sin(pH * Math.PI) * 0.06).toFixed(3)})`;
  });
}

/* =================== Escenas 3D =================== */
function creaRender(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  return r;
}
function ajusta(r, cam, canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas._w === w && canvas._h === h) return;
  canvas._w = w; canvas._h = h; r.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix();
}
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const caja = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cil = (ra, rb, h, mat, abierto = false) => new THREE.Mesh(new THREE.CylinderGeometry(ra, rb, h, 36, 1, abierto), mat);
const torno = (pts, mat) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 40), mat);
const perfilHuevo = (t0, t1, n = 36) => Array.from({ length: n + 1 }, (_, i) => { const t = mezcla(t0, t1, i / n); return [Math.max(0, Math.sin(t) * (0.74 + 0.1 * Math.cos(t))), -Math.cos(t)]; });
const pon = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const luces = esc => { esc.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.25)); const d = new THREE.DirectionalLight(0xffffff, 1.9); d.position.set(3, 6, 5); esc.add(d); };

let hay3d = false;
if (!quieto) {
  try {
    /* ---------- La repisa: un espacio 3D que rueda con el desplazamiento ---------- */
    const lr = $('#lienzoRepisa'), rep = vigila($('#repisa')), escenaRep = $('.rep-escena');
    const rR = creaRender(lr), escR = new THREE.Scene(), camR = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    escR.background = new THREE.Color('#141412'); luces(escR);
    const botones = $$('#repLista button'), n = botones.length, SEP = 2.1, largo = (n - 1) * SEP + 14;
    const madera = M('#8f7355'), carton = M('#c9a777'), blanco = M('#f7f3ea'), metal = M('#cfd6da', { metalness: 0.85, roughness: 0.3 });
    const naranjo = M('#f07d1a'), amarillo = M('#f9b21b'), verde = M('#4f8a2f'), rojo = M('#c8281f'), kraft = M('#c69c6d');
    const cristal = M('#eef4f5', { transparent: true, opacity: 0.55, roughness: 0.15, side: THREE.DoubleSide });
    escR.add(pon(caja(largo, 9, 0.2, M('#24241f', { roughness: 0.95 })), (n - 1) * SEP / 2, 2, -1.1));
    escR.add(pon(caja(largo, 0.1, 1.5, madera), (n - 1) * SEP / 2, 0, 0), pon(caja(largo, 0.1, 1.2, madera), (n - 1) * SEP / 2, 2.55, -0.3));
    escR.add(pon(caja(largo, 0.36, 0.06, M('#141412')), (n - 1) * SEP / 2, -0.23, 0.74));
    new THREE.TextureLoader().load('../img/logo-emporio.webp', tx => {
      tx.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0.12 });
      for (let x = SEP * 1.5; x < (n - 1) * SEP; x += SEP * 4) escR.add(pon(new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.7), mat), x, 1.5, -0.98));
    });
    // Cada producto es una fotografía real recortada, puesta como lámina que flota sobre la repisa
    const cargador = new THREE.TextureLoader();
    const foto = (archivo, ancho = 1.45, alto = 1.05) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.04, side: THREE.DoubleSide }));
      m.visible = false;
      cargador.load('img/productos/' + archivo + '.webp', tx => {
        tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; m.material.map = tx; m.material.needsUpdate = true;
        const r = tx.image.width / tx.image.height, e = Math.min(ancho / r, alto); m.scale.set(e * r, e, 1); m.position.y = e / 2; m.visible = true;
      });
      return m;
    };
    const rotulo = texto => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 128; const x = c.getContext('2d');
      x.fillStyle = '#fbf6ec'; x.beginPath(); x.roundRect(4, 4, 632, 120, 26); x.fill();
      x.fillStyle = '#1d5c36'; x.textAlign = 'center'; x.textBaseline = 'middle';
      let px = 50; do { x.font = `800 ${px}px system-ui, sans-serif`; px -= 3; } while (x.measureText(texto).width > 590 && px > 20);
      x.fillText(texto, 320, 68);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.32), new THREE.MeshBasicMaterial({ map: t }));
    };
    const productos = botones.map((b, i) => {
      const g = new THREE.Group(), tipo = b.dataset.tipo;
      if (tipo === 'promo') g.add(pon(foto('bandeja', 1.05, 0.75), -0.3, 0, 0), pon(foto('monster', 0.5, 1.05), 0.6, 0, 0.14)); else g.add(foto(tipo));
      g.position.set(i * SEP, 0.05, 0.05); g.userData.idx = i; g.userData.a = 0; g.userData.giro = 0;
      const sombra = pon(new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })), i * SEP, 0.052, 0.05);
      sombra.rotation.x = -Math.PI / 2; g.userData.sombra = sombra; escR.add(sombra);
      escR.add(g, pon(rotulo(b.textContent), i * SEP, -0.23, 0.775));
      return g;
    });

    hay3d = true; raiz.classList.add('mov3d'); rep.style.height = 'calc(100vh + ' + n + ' * 46vh)';
    $('#repAyuda').textContent = 'Baja con la rueda, desliza con el dedo o arrastra la repisa. Toca un producto para girarlo y verlo de cerca.';
    const ficha = { nombre: $('#repNombre'), desc: $('#repDesc'), n: $('#repN'), abrir: $('#repAbrir') }, lista = $('#repLista');
    const DIST = [7.4, 5.2, 3.9];
    let pR = 0, foco = -1, abierto = false, zoom = 1, dist = DIST[1], arrastre = 0;
    const rango = () => rep.offsetHeight - innerHeight;
    const inicio = () => rep.getBoundingClientRect().top + scrollY;
    const ir = i => scrollTo({ top: inicio() + limita(i, 0, n - 1) / (n - 1) * rango(), behavior: 'smooth' });
    const ponAbierto = v => { abierto = v; ficha.abrir.setAttribute('aria-pressed', v); ficha.abrir.textContent = v ? 'Detener' : 'Girar y acercar'; zoom = v ? 2 : 1; };
    const enfoca = i => {
      foco = i; ponAbierto(false);
      const b = botones[i]; ficha.nombre.textContent = b.textContent; ficha.desc.textContent = b.nextElementSibling.textContent; ficha.n.textContent = `${i + 1} de ${n}`;
      botones.forEach((x, k) => k === i ? x.setAttribute('aria-current', 'true') : x.removeAttribute('aria-current'));
      const li = b.parentElement; lista.scrollTo({ left: li.offsetLeft - lista.clientWidth / 2 + li.offsetWidth / 2, behavior: 'smooth' });
    };
    botones.forEach((b, i) => b.addEventListener('click', () => ir(i)));
    enfoca(0); // la ficha parte con el primer producto, aunque la repisa todavía no esté en pantalla
    $('#repAnt').onclick = () => ir(foco - 1); $('#repSig').onclick = () => ir(foco + 1);
    $('#repMas').onclick = () => { zoom = Math.min(2, zoom + 1); }; $('#repMenos').onclick = () => { zoom = Math.max(0, zoom - 1); };
    ficha.abrir.onclick = () => ponAbierto(!abierto);
    // Arrastrar con mouse o dedo en horizontal; el desplazamiento vertical sigue siendo el del navegador
    const rayo = new THREE.Raycaster(), punto = new THREE.Vector2();
    let ar = null;
    lr.addEventListener('pointerdown', e => { ar = { x: e.clientX, y: e.clientY, top: scrollY, mov: false }; lr.setPointerCapture(e.pointerId); });
    lr.addEventListener('pointermove', e => {
      if (!ar) return; const dx = e.clientX - ar.x;
      if (!ar.mov && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - ar.y)) { ar.mov = true; lr.classList.add('arrastra'); }
      if (ar.mov) scrollTo({ top: ar.top - dx * 1.7, behavior: 'instant' });
    });
    const suelta = e => {
      if (!ar) return; const fue = ar.mov, quietoClic = Math.hypot(e.clientX - ar.x, e.clientY - ar.y) < 8; ar = null; lr.classList.remove('arrastra');
      if (fue || !quietoClic || e.type === 'pointercancel') return;
      const r = lr.getBoundingClientRect(); punto.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rayo.setFromCamera(punto, camR);
      const toca = rayo.intersectObjects(productos, true)[0]; if (!toca) return;
      let o = toca.object; while (o && o.userData.idx === undefined) o = o.parent;
      if (!o) return; if (o.userData.idx === foco) { ponAbierto(!abierto); if (abierto) zoom = 2; } else ir(o.userData.idx);
    };
    lr.addEventListener('pointerup', suelta); lr.addEventListener('pointercancel', suelta);
    // Panel táctil: el gesto de lado también hace rodar la repisa
    escenaRep.addEventListener('wheel', e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); scrollBy(0, e.deltaX); } }, { passive: false });
    lr.addEventListener('dblclick', () => { zoom = zoom === 2 ? 1 : 2; });

    let antes = 0;
    cuadros.push(t => {
      const dt = Math.min(0.05, t - antes); antes = t;
      if (!enPantalla.get(rep)) return;
      ajusta(rR, camR, lr);
      pR = mezcla(pR, avance(rep), 0.1);
      const camX = pR * (n - 1) * SEP, f = Math.round(avance(rep) * (n - 1));
      if (f !== foco) enfoca(f);
      dist = mezcla(dist, DIST[zoom] * (camR.aspect < 0.8 ? 1.25 : 1), 0.08);
      camR.position.set(camX + cursor.sx * 0.25, 1.15 - cursor.sy * 0.12, dist);
      camR.lookAt(camX, [0.1, 0.25, 0.3][zoom], 0);
      for (const g of productos) {
        const u = g.userData, cerca = 1 - limita(Math.abs(g.position.x - camX) / SEP), es = u.idx === foco;
        g.scale.setScalar(1 + cerca * 0.15 + u.a * 0.15);
        u.a = mezcla(u.a, es && abierto ? 1 : 0, 0.09); if (u.abrir) u.abrir(u.a);
        // Todos los productos flotan y se mecen; al pedirlo, el del centro da vueltas completas
        u.giro = es && abierto ? u.giro + dt * 1.5 : mezcla(u.giro, Math.round(u.giro / (Math.PI * 2)) * Math.PI * 2, 0.1);
        const flota = 0.16 + Math.sin(t * 1.3 + u.idx * 1.7) * 0.07 + cerca * 0.05 + u.a * 0.1;
        g.rotation.set(0, u.giro + Math.sin(t * 0.9 + u.idx * 1.3) * (es ? 0.36 : 0.24), Math.cos(t * 0.9 + u.idx * 2) * 0.05); g.position.y = 0.05 + flota;
        u.sombra.scale.setScalar(1.15 - flota * 0.9); u.sombra.material.opacity = Math.max(0.05, 0.3 - flota * 0.35);
      }
      rR.render(escR, camR);
    });
  } catch (e) {
    raiz.classList.remove('mov3d'); hay3d = false; console.warn('Sin 3D: se muestra la versión simple.', e);
  }
}

/* ---------- Bucle de animación ---------- */
if (cuadros.length) {
  const paso = ms => { cursor.sx = mezcla(cursor.sx, cursor.x, 0.07); cursor.sy = mezcla(cursor.sy, cursor.y, 0.07); const t = ms / 1000; for (const f of cuadros) f(t); };
  const cuadro = ms => { paso(ms); requestAnimationFrame(cuadro); };
  requestAnimationFrame(cuadro);
  // Para pruebas: avanza n cuadros de una vez (el navegador pausa la animación cuando la ventana no está a la vista).
  let tPrueba = 0; window.viajeAvanza = (k = 60) => { for (let i = 0; i < k; i++) { tPrueba += 16; paso(performance.now() + tPrueba); } };
}

/* =================== La banda del gallinero: capas de sonido generadas en el equipo =================== */
{
  const PISTAS = {
    bombo:   [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    palmas:  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    maiz:    [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1],
    bajo:    [45, 0, 0, 45, 0, 0, 48, 0, 50, 0, 0, 50, 0, 48, 0, 0],
    melodia: [69, 0, 72, 0, 76, 0, 72, 0, 74, 0, 72, 0, 69, 0, 0, 67],
    cacareo: [0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 2, 0],
  };
  const PASO = 60 / 104 / 4, hz = n => 440 * 2 ** ((n - 69) / 12);
  const pads = $$('#pads .pad'), estado = $('#bandaEstado'), luz = $('#bandaLuz');
  let ctx, salida, ruido, reloj = null, prox = 0, paso = 0;
  const env = (t, pico, dur, ataque = 0.004) => { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pico, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(salida); return g; };
  const osc = (tipo, f, t, dur, destino) => { const o = ctx.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t); o.connect(destino); o.start(t); o.stop(t + dur + 0.05); return o; };
  const sopla = (t, dur, tipo, f, q, pico) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(); s.buffer = ruido; fl.type = tipo; fl.frequency.value = f; fl.Q.value = q; s.connect(fl); fl.connect(env(t, pico, dur, 0.002)); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); };
  const TOCA = {
    bombo: t => { osc('sine', 150, t, 0.3, env(t, 0.9, 0.3)).frequency.exponentialRampToValueAtTime(45, t + 0.12); },
    palmas: t => { sopla(t, 0.13, 'bandpass', 1700, 0.8, 0.5); sopla(t + 0.012, 0.1, 'bandpass', 2300, 0.8, 0.3); },
    maiz: t => sopla(t, 0.05, 'highpass', 7000, 0.7, 0.16),
    bajo: (t, n) => { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.connect(env(t, 0.5, 0.24)); osc('triangle', hz(n), t, 0.24, f); },
    melodia: (t, n) => { osc('sine', hz(n), t, 0.36, env(t, 0.2, 0.36)); osc('sine', hz(n) * 2, t, 0.2, env(t, 0.05, 0.2)); },
    cacareo: (t, n) => {
      const dur = n === 2 ? 0.3 : 0.11, f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 4; f.connect(env(t, 0.34, dur, 0.012));
      const o = osc('sawtooth', 520, t, dur, f); o.frequency.exponentialRampToValueAtTime(n === 2 ? 980 : 820, t + dur * 0.55); o.frequency.exponentialRampToValueAtTime(600, t + dur);
    },
  };
  const activas = () => pads.filter(p => p.getAttribute('aria-pressed') === 'true');
  const pinta = () => {
    const a = activas(); luz.classList.toggle('on', a.length > 0);
    estado.textContent = a.length ? 'Suenan: ' + a.map(p => p.firstChild.nextSibling.textContent.trim()).join(', ') + '.' : 'La banda está en silencio.';
  };
  const tic = () => {
    while (prox < ctx.currentTime + 0.1) {
      for (const p of activas()) {
        const v = PISTAS[p.dataset.pista][paso]; if (!v) continue;
        TOCA[p.dataset.pista](prox, v);
        setTimeout(() => { p.classList.add('golpe'); setTimeout(() => p.classList.remove('golpe'), 120); }, Math.max(0, (prox - ctx.currentTime) * 1000));
      }
      prox += PASO; paso = (paso + 1) % 16;
    }
  };
  const parte = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor(); salida = ctx.createGain(); salida.gain.value = 0.55; salida.connect(comp); comp.connect(ctx.destination);
      ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    ctx.resume(); if (!reloj) { prox = ctx.currentTime + 0.06; paso = 0; reloj = setInterval(tic, 25); }
  };
  const calla = () => { pads.forEach(p => p.setAttribute('aria-pressed', 'false')); if (reloj) { clearInterval(reloj); reloj = null; } if (ctx) ctx.suspend(); pinta(); };
  pads.forEach(p => p.addEventListener('click', () => {
    const on = p.getAttribute('aria-pressed') !== 'true'; p.setAttribute('aria-pressed', on);
    if (on) parte(); else if (!activas().length) return calla();
    pinta();
  }));
  $('#bandaSilencio').addEventListener('click', calla);
  document.addEventListener('visibilitychange', () => { if (document.hidden) calla(); });
}
