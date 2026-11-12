// Página web «Del campo a tu mesa»: pizarra con huevo de tiza, paisaje con capas, repisa 3D y mezclador de sonidos.
// Fuente de web/js/viaje.js. Para reconstruir: en la carpeta herramientas, `npm install` y `npm run construir`.
// Todo es mejora progresiva: sin JavaScript, sin WebGL o con «reducir movimiento», la página se lee completa.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

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

/* =================== El viaje: de la avícola al Emporio, de la mañana a la noche =================== */
// Capas a distintas velocidades. La hora del día avanza con el recorrido: mañana en la avícola, día en Oro Verde,
// tarde en la Distribuidora y noche en el Emporio, con las luces encendidas.
if (!quieto) {
  const azar = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
  const svg = (w, cuerpo) => `<svg viewBox="0 0 ${w} 600" xmlns="http://www.w3.org/2000/svg">${cuerpo}</svg>`;
  const LETRA = 'font-family="DM Sans,system-ui,sans-serif" font-weight="700"';
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

  // Primer plano: avícola → Oro Verde → Chillán → Distribuidora Santa Bárbara → ciudad → Emporio
  const ANCHO = 6600, X0 = 600, X_EMPORIO = 5400;
  const ventanas = [], faroles = [];
  const arbol = (x, y, e = 1) => `<rect x="${x - 5 * e}" y="${y - 40 * e}" width="${10 * e}" height="${44 * e}" fill="#6b4a2b"/><circle cx="${x}" cy="${y - 62 * e}" r="${34 * e}" fill="#5f7d52"/><circle cx="${x + 18 * e}" cy="${y - 44 * e}" r="${22 * e}" fill="#7a9468"/>`;
  const pabellon = (x, y, w, techo) => `<rect x="${x}" y="${y}" width="${w}" height="46" fill="#f4f1e6"/><path d="M${x - 10} ${y} L${x + 14} ${y - 26} L${x + w - 14} ${y - 26} L${x + w + 10} ${y}Z" fill="${techo}"/>` +
    Array.from({ length: Math.floor(w / 46) }, (_, i) => `<rect x="${x + 16 + i * 46}" y="${y + 14}" width="22" height="14" fill="#9db7c4"/>`).join('');
  const silo = (x, y) => `<rect x="${x}" y="${y - 96}" width="44" height="96" fill="#cfd6da"/><path d="M${x} ${y - 96} L${x + 22} ${y - 122} L${x + 44} ${y - 96}Z" fill="#aeb8be"/><rect x="${x}" y="${y - 70}" width="44" height="4" fill="#aeb8be"/><rect x="${x}" y="${y - 40}" width="44" height="4" fill="#aeb8be"/>`;
  const ventana = (x, y, w, h, enciende = 0.72) => { if (azar() < enciende) ventanas.push([x, y, w, h]); return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#b9c6cc"/>`; };
  const edificio = (x, w, h, color) => `<rect x="${x}" y="${500 - h}" width="${w}" height="${h}" fill="${color}"/>` +
    Array.from({ length: Math.floor(h / 44) }, (_, f) => Array.from({ length: Math.floor(w / 36) }, (_, i) => ventana(x + 10 + i * 36, 500 - h + 14 + f * 44, 16, 22)).join('')).join('');
  const letrero = (x, texto, w) => `<rect x="${x + w / 2 - 5}" y="440" width="10" height="44" fill="#6b6b66"/><rect x="${x}" y="392" width="${w}" height="50" rx="6" fill="#2f6b3f" stroke="#fff" stroke-width="3"/><text x="${x + w / 2}" y="426" text-anchor="middle" ${LETRA} font-size="24" fill="#fff">${texto}</text>`;
  const cerco = x => `<path d="M${x} 482v-34m26 34v-34m26 34v-34M${x - 12} 458h76M${x - 12} 472h76" stroke="#6b4a2b" stroke-width="5"/>`;
  c = `<rect y="470" width="${ANCHO}" height="130" fill="#7a9468"/>`;
  // 1. La avícola
  c += pabellon(120, 430, 420, '#c8281f') + pabellon(600, 430, 380, '#b8bfc2') + silo(1010, 476) + silo(1062, 476) + arbol(70, 478) + arbol(1180, 478, 1.2);
  c += `<rect x="318" y="356" width="300" height="58" rx="8" fill="#1c1c1a"/><image href="img/huevo-sabroso-isotipo.png" x="328" y="361" width="52" height="48"/><text x="390" y="394" ${LETRA} font-size="23" fill="#ffd92f">EL HUEVO SABROSO</text><rect x="352" y="414" width="8" height="18" fill="#1c1c1a"/><rect x="576" y="414" width="8" height="18" fill="#1c1c1a"/>`;
  // 2. El campo de Oro Verde, camino a Chillán
  for (let x = 1320; x < 2700; x += 150 + azar() * 240) c += azar() > 0.35 ? arbol(x, 482, 0.8 + azar() * 0.7) : cerco(x);
  for (let x = 1500; x < 2600; x += 520) c += `<path d="M${x} 500 q60 -22 120 0 t120 0 t120 0" fill="none" stroke="#5f7d52" stroke-width="6"/>`;
  c += letrero(1640, 'ORO VERDE', 210) + letrero(2560, 'CHILLÁN', 170);
  // 3. Distribuidora Santa Bárbara
  const rotuloDistri = color => `<rect x="2960" y="368" width="590" height="42" rx="6" fill="${color}"/><text x="3255" y="397" text-anchor="middle" ${LETRA} font-size="21" fill="#fff">DISTRIBUIDORA SANTA BÁRBARA</text>`;
  c += `<path d="M2885 360 L2950 316 L3555 316 L3620 360Z" fill="#8e958f"/><rect x="2900" y="360" width="705" height="140" fill="#d9d5cb"/><rect x="2950" y="420" width="170" height="80" fill="#9a9e98"/>` +
    Array.from({ length: 9 }, (_, i) => `<rect x="2950" y="${426 + i * 8}" width="170" height="2" fill="#80847f"/>`).join('') + rotuloDistri('#2f6b3f');
  for (let i = 0; i < 6; i++) c += ventana(3160 + i * 70, 430, 50, 36, 1);
  // 4. Chillán
  for (const [x, w, h, col] of [[3760, 150, 190, '#d9c9a8'], [3930, 120, 260, '#c8b48e'], [4070, 160, 150, '#e6d9bd'], [4260, 140, 220, '#cdbf9f'], [4430, 170, 180, '#ddd0b4'], [4630, 130, 240, '#c8b48e'], [4790, 160, 170, '#e6d9bd'], [4970, 140, 210, '#d6c7a6']]) c += edificio(x, w, h, col);
  // 5. El Emporio: fachada negra, persianas metálicas y su letrero redondo a color sobre la puerta
  c += `<rect x="5150" y="296" width="500" height="204" fill="#191917"/><rect x="5168" y="310" width="464" height="56" fill="#262623"/>`;
  for (let i = 0; i < 5; i++) c += ventana(5182 + i * 92, 318, 72, 40, 1);
  c += `<rect x="5168" y="380" width="196" height="120" fill="#b4b8ba"/><rect x="5436" y="380" width="196" height="120" fill="#b4b8ba"/>` +
    Array.from({ length: 14 }, (_, i) => `<rect x="5168" y="${384 + i * 8.5}" width="196" height="2.5" fill="#8f9496"/><rect x="5436" y="${384 + i * 8.5}" width="196" height="2.5" fill="#8f9496"/>`).join('');
  c += `<rect x="5372" y="380" width="56" height="120" fill="#121211"/><rect x="5380" y="430" width="40" height="70" fill="#2c3a33"/><rect x="5385" y="408" width="30" height="16" fill="#fff"/><text x="5400" y="421" text-anchor="middle" ${LETRA} font-size="12" fill="#1c1c1a">720</text>`;
  const sello = '<circle cx="5400" cy="352" r="44" fill="#fff"/><image href="img/emporio-sello-chico.png" x="5356" y="308" width="88" height="88"/>';
  c += sello + '<image href="img/huevo-sabroso-isotipo.png" x="5370" y="238" width="62" height="57"/>';
  // 6. Más ciudad
  for (const [x, w, h, col] of [[5700, 170, 220, '#d9c9a8'], [5890, 140, 170, '#c8b48e'], [6050, 180, 250, '#e0d3b8'], [6250, 150, 190, '#cdbf9f'], [6420, 170, 230, '#d9c9a8']]) c += edificio(x, w, h, col);
  // Faroles de la ciudad
  for (let x = 2700; x < ANCHO; x += 320) { faroles.push(x); c += `<rect x="${x}" y="418" width="6" height="94" fill="#3b3b35"/><rect x="${x - 12}" y="412" width="30" height="8" rx="3" fill="#3b3b35"/>`; }
  // Calle
  c += `<rect y="512" width="${ANCHO}" height="62" fill="#3b3b35"/>` + Array.from({ length: Math.ceil(ANCHO / 80) }, (_, i) => `<rect x="${i * 80 + 10}" y="540" width="44" height="6" fill="#d8cfb8"/>`).join('') + `<rect y="574" width="${ANCHO}" height="26" fill="#5f7d52"/>`;
  // Lo que se enciende de noche
  const luces = '<defs><radialGradient id="halo"><stop offset="0" stop-color="#ffd98a" stop-opacity=".6"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>' +
    ventanas.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffd27a"/>`).join('') +
    faroles.map(f => `<circle cx="${f + 3}" cy="430" r="80" fill="url(#halo)"/><circle cx="${f + 3}" cy="421" r="6" fill="#fff4cf"/>`).join('') +
    `<circle cx="5400" cy="352" r="125" fill="url(#halo)"/>${sello}<rect x="5380" y="430" width="40" height="70" fill="#ffe2a0"/>` + rotuloDistri('#3e8f56');
  const frente = svg(ANCHO, c);
  const frenteCapa = `<div class="capa frente">${frente}<div class="copia tarde">${frente}</div><div class="copia noche">${frente}</div><div class="copia luces">${svg(ANCHO, luces)}</div></div>`;

  // El camión: solo con el sello del Emporio en la caja (David no quiere el logo de la avícola en el camión)
  const camion = '<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="14" width="190" height="100" rx="8" fill="#fbfaf6" stroke="#1c1c1a" stroke-width="4"/><rect x="6" y="88" width="190" height="10" fill="#1c1c1a"/>' +
    '<circle cx="100" cy="52" r="33" fill="#fff" stroke="#e6e1d6" stroke-width="2"/><image href="img/emporio-sello-chico.png" x="66" y="18" width="68" height="68"/>' +
    '<path d="M196 40h54l34 36v38h-88z" fill="#2b2b28" stroke="#1c1c1a" stroke-width="4" stroke-linejoin="round"/><path d="M208 50h36l24 26h-60z" fill="#cfe3ec" stroke="#1c1c1a" stroke-width="3" stroke-linejoin="round"/>' +
    '<rect x="276" y="88" width="10" height="9" rx="2" fill="#fff3c4"/><rect x="2" y="92" width="7" height="12" rx="2" fill="#c8281f"/><rect x="0" y="110" width="290" height="10" rx="4" fill="#1c1c1a"/>' +
    [66, 236].map(x => `<g class="rueda"><circle cx="${x}" cy="124" r="22" fill="#1a1a1a"/><circle cx="${x}" cy="124" r="9" fill="#cfd6da"/><path d="M${x - 20} 124h40M${x} 104v40" stroke="#cfd6da" stroke-width="3"/></g>`).join('') + '</svg>';

  const estrellas = Array.from({ length: 90 }, () => { const s = (0.8 + azar() * 1.8).toFixed(1); return `<i style="left:${(azar() * 100).toFixed(1)}%;top:${(azar() * 58).toFixed(1)}%;width:${s}px;height:${s}px;opacity:${(0.35 + azar() * 0.65).toFixed(2)}"></i>`; }).join('');
  const paisaje = $('#paisaje');
  paisaje.innerHTML = `<div class="cielo"></div><div class="v-sol"></div><div class="capa">${cordillera}</div><div class="capa">${cerros}</div>` +
    `<div class="velo tarde"></div><div class="velo noche"></div><div class="estrellas">${estrellas}</div><div class="v-luna"></div>${frenteCapa}<div class="camion">${camion}<div class="haz"></div></div>`;

  const viaje = vigila($('#viaje')), escena = $('.viaje-escena'), capas = $$(':scope > .capa', paisaje), frenteEl = $('.capa.frente', paisaje);
  const cielo = $('.cielo', paisaje), sol = $('.v-sol', paisaje), luna = $('.v-luna', paisaje), est = $('.estrellas', paisaje);
  const veloT = $('.velo.tarde', paisaje), veloN = $('.velo.noche', paisaje), copT = $('.copia.tarde', paisaje), copN = $('.copia.noche', paisaje), copL = $('.copia.luces', paisaje);
  const cam = $('.camion', paisaje), camSvg = $('svg', cam), haz = $('.haz', cam), hitos = $$('#hitos li');
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const tono = (a, b, k) => 'rgb(' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * k)).join(',') + ')';
  const CIELO = [[0, '#7f93bf', '#f3bf95'], [0.18, '#86bde6', '#e3eef4'], [0.4, '#7fb4e0', '#e8f1f4'], [0.56, '#6f74ad', '#f2a86e'], [0.7, '#3b3a6e', '#d9876a'], [0.86, '#0e1636', '#2b3463'], [1.01, '#0a1230', '#1c2550']];
  const cieloEn = u => { let i = 0; while (i < CIELO.length - 2 && u > CIELO[i + 1][0]) i++; const [a, t1, b1] = CIELO[i], [b, t2, b2] = CIELO[i + 1], k = limita((u - a) / (b - a)); return [tono(t1, t2, k), tono(b1, b2, k)]; };
  let pv = 0, hito = 0, ultimo = '';
  cuadros.push(t => {
    if (!enPantalla.get(viaje)) return;
    pv = mezcla(pv, avance(viaje), 0.12);
    const W = innerWidth, esc = frenteEl.offsetHeight / 600;
    let centro = X0;
    capas.forEach(capa => {
      let max = Math.max(0, capa.offsetWidth - W);
      if (capa === frenteEl) { max = Math.min(max, Math.max(0, X_EMPORIO * esc - W / 2)); centro = (pv * max + W / 2) / esc; } // al llegar, el Emporio queda al centro
      capa.style.transform = `translate3d(${(-pv * max).toFixed(1)}px,0,0)`;
    });
    const u = limita((centro - X0) / (X_EMPORIO - X0));
    const noche = suave(0.7, 0.88, u), tarde = suave(0.42, 0.56, u) * (1 - noche), luz = suave(0.64, 0.8, u);
    const clave = u.toFixed(3);
    if (clave !== ultimo) {
      ultimo = clave;
      const [arriba, abajo] = cieloEn(u);
      cielo.style.background = `linear-gradient(${arriba},${abajo} 78%)`;
      const s = limita(u / 0.74);
      sol.style.left = (4 + 88 * s).toFixed(2) + '%'; sol.style.top = (66 - 52 * Math.sin(Math.PI * s)).toFixed(2) + '%';
      sol.style.opacity = (1 - suave(0.7, 0.8, u)).toFixed(3);
      sol.style.background = u < 0.2 ? tono('#ffc89a', '#fff4c4', u / 0.2) : tono('#fff4c4', '#ff9f5a', limita((u - 0.4) / 0.3));
      luna.style.opacity = suave(0.78, 0.9, u).toFixed(3); est.style.opacity = suave(0.8, 0.95, u).toFixed(3);
      veloT.style.opacity = tarde.toFixed(3); veloN.style.opacity = noche.toFixed(3);
      copT.style.opacity = tarde.toFixed(3); copN.style.opacity = noche.toFixed(3); copL.style.opacity = luz.toFixed(3);
      haz.style.opacity = luz.toFixed(3); camSvg.style.filter = `brightness(${(1 - 0.45 * noche).toFixed(3)})`;
      escena.classList.toggle('noche', noche > 0.45);
    }
    cam.style.setProperty('--giro-rueda', (pv * 6400).toFixed(0) + 'deg');
    cam.style.transform = `translate3d(0,${(Math.sin(t * 9) * (pv > 0.005 && pv < 0.995 ? 1.6 : 0)).toFixed(1)}px,0)`;
    const h = u < 0.12 ? 0 : u < 0.4 ? 1 : u < 0.76 ? 2 : 3;
    if (h !== hito) { hitos[hito].classList.remove('activo'); hitos[h].classList.add('activo'); hito = h; }
  });
}

/* =================== La pizarra: el huevo de tiza recorre el camino, unas manos lo quiebran y cae a la paila =================== */
if (!quieto) {
  const av = $('#avicola'), piz = $('#pizarra');
  const [revela, borde, fondo, centro] = ['.tz-revela', '.tz-borde', '.tz-fondo', '.tz-centro'].map(s => $(s, piz));
  const notaIni = $('.tz-inicio', piz), notaFin = $('.tz-fin', piz), svg = $('.tz-camino', piz);
  const im = n => $('.tz-' + n, piz);
  const huevo = im('huevo'), mitadI = im('mitad-i'), mitadD = im('mitad-d'), grieta = im('grieta'), trazo = $('polyline', grieta), frito = im('frito'), paila = im('paila'), manoI = im('mano-i'), manoD = im('mano-d');
  // Coloca una imagen con su centro en (x, y), un ancho en px, giro, escala vertical y opacidad
  const pon = (el, x, y, w, giro = 0, op = 1, sy = 1) => {
    const h = w * el.height / el.width;
    el.style.width = w.toFixed(1) + 'px';
    el.style.transform = `translate(${(x - w / 2).toFixed(1)}px,${(y - h / 2).toFixed(1)}px) rotate(${giro.toFixed(2)}deg) scaleY(${sy.toFixed(3)})`;
    el.style.opacity = op.toFixed(3);
  };
  // Curva suave que pasa por todos los puntos (Catmull-Rom convertida a Bézier)
  const curva = P => {
    let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], e = P[Math.min(P.length - 1, i + 2)];
      d += ` C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)} ${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)} ${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
    }
    return d;
  };
  let L = {}, largo = 1, hitos = null;
  const pasos = $$('.paso', av);
  const arma = () => {
    const W = piz.clientWidth, H = piz.clientHeight, ancho = W >= 900;
    // En escritorio el camino ocupa la mitad derecha; en celular, la franja libre de arriba
    const P = ancho
      ? [[.53, .2], [.7, .14], [.92, .24], [.66, .36], [.6, .48], [.86, .52], [.76, .58]].map(([x, y]) => [x * W, y * H])
      : [[.08, .2], [.35, .14], [.62, .2], [.9, .16], [.82, .26], [.5, .27]].map(([x, y]) => [x * W, y * H]);
    const u = ancho ? Math.min(W * .5, H * 1.05) : Math.min(W, H * .62);
    L = {
      ancho, u, huevo: u * (ancho ? .13 : .14), via: u * (ancho ? .075 : .07),
      paila: [ancho ? .76 * W : .5 * W, ancho ? .8 * H : .38 * H], pailaW: u * (ancho ? .52 : .5)
    };
    const d = curva(P);
    for (const p of [revela, borde, fondo, centro]) p.setAttribute('d', d);
    borde.setAttribute('stroke-width', L.via.toFixed(1)); fondo.setAttribute('stroke-width', (L.via - 8).toFixed(1));
    revela.setAttribute('stroke-width', (L.via * 2).toFixed(1));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    largo = revela.getTotalLength();
    revela.style.strokeDasharray = `${largo} ${largo}`;
    const tam = Math.max(20, u * .055);
    notaIni.setAttribute('font-size', tam.toFixed(0)); notaFin.setAttribute('font-size', tam.toFixed(0));
    notaIni.setAttribute('x', P[0][0].toFixed(0)); notaIni.setAttribute('y', (P[0][1] + L.via * .5 + tam * 1.05).toFixed(0));
    // En celular el contenido tapa la pizarra salvo en la ventana libre al comienzo de cada paso: los momentos clave caen ahí
    hitos = null;
    if (!ancho && pasos.length >= 4) {
      const tope = av.getBoundingClientRect().top, rango = Math.max(1, av.offsetHeight - H);
      hitos = [1, 2, 3].map(i => limita((pasos[i].getBoundingClientRect().top - tope + H * .2) / rango));
    }
    if (ancho) { notaFin.setAttribute('text-anchor', 'end'); notaFin.setAttribute('x', (L.paila[0] - L.pailaW * .52).toFixed(0)); notaFin.setAttribute('y', (L.paila[1] + L.pailaW * .16).toFixed(0)); }
    else { notaFin.setAttribute('text-anchor', 'middle'); notaFin.setAttribute('x', (L.paila[0] - L.pailaW * .1).toFixed(0)); notaFin.setAttribute('y', (L.paila[1] + L.pailaW * .5).toFixed(0)); }
  };
  // Convierte el avance del desplazamiento en el avance de la historia (igual en escritorio; por tramos en celular)
  const tramo = p => {
    if (!hitos) return p;
    const X = [0, ...hitos, 1], Y = [0.08, 0.4, 0.675, 0.87, 1];
    for (let i = 0; i < X.length - 1; i++) if (p <= X[i + 1]) return mezcla(Y[i], Y[i + 1], limita((p - X[i]) / Math.max(1e-4, X[i + 1] - X[i])));
    return 1;
  };
  arma(); addEventListener('resize', arma); addEventListener('load', arma);
  let pH = 0;
  cuadros.push(t => {
    if (!enPantalla.get(av)) return;
    pH = mezcla(pH, avance(av), 0.09);
    const e = tramo(pH);
    // 1) El huevo rueda por el camino y la tiza se dibuja delante de él
    const viaje = suave(0.02, 0.5, e), s = viaje * largo;
    revela.style.strokeDashoffset = (largo - Math.min(largo, s + largo * .22 + 30)).toFixed(1);
    const q = revela.getPointAtLength(s), q2 = revela.getPointAtLength(Math.min(largo, s + 2));
    // Sobre la paila esperan las manos: el huevo sube del final del camino a ese punto
    const [px, py] = L.paila, alto = L.huevo * 561 / 420;
    const sobre = [px - L.pailaW * .06, py - L.pailaW * .62];
    const sube = suave(0.5, 0.58, e);
    const hx = mezcla(q.x, sobre[0], sube), hy = mezcla(q.y - alto * .42, sobre[1], sube);
    const rueda = (q2.x - q.x) * 8 * (1 - sube) + Math.sin(viaje * 40) * 7 * (1 - sube) + Math.sin(t * 1.6) * 2;
    // 2) Las manos entran y toman el huevo; 3) se dibuja la grieta; 4) el mismo huevo se parte en dos mitades
    //    que las manos separan; 5) sale solo la yema, cae y se extiende en la paila
    const entra = suave(0.54, 0.62, e), raja = suave(0.62, 0.652, e), abre = suave(0.652, 0.715, e);
    const asoma = suave(0.665, 0.7, e), cae = suave(0.698, 0.79, e), plano = suave(0.785, 0.85, e), sale = suave(0.78, 0.88, e);
    const tiemble = raja > 0 && abre < 0.3 ? Math.sin(t * 55) * 2.5 * (1 - abre) : 0;
    const partido = e >= 0.652;
    pon(huevo, hx + tiemble, hy, L.huevo, rueda, partido ? 0 : 1);
    // La grieta se dibuja sobre el huevo y se apaga cuando las mitades se separan
    pon(grieta, hx + tiemble, hy, L.huevo, rueda, raja > 0 ? 1 - suave(0, 0.35, abre) : 0);
    trazo.style.strokeDashoffset = (1 - raja).toFixed(3);
    const sep = abre * L.huevo * 0.34 + sale * L.u * 0.5;
    pon(mitadI, sobre[0] - sep + tiemble, sobre[1] - sale * L.u * .12, L.huevo, rueda + abre * 24 - sale * 10, partido ? 1 - sale : 0);
    pon(mitadD, sobre[0] + sep + tiemble, sobre[1] - sale * L.u * .18, L.huevo, rueda - abre * 24 + sale * 10, partido ? 1 - sale : 0);
    // Las manos sostienen cada mitad y se la llevan
    const mano = L.huevo * 1.9, aleja = (1 - entra) * L.u * .55 + sep;
    pon(manoI, sobre[0] - L.huevo * .95 - aleja, sobre[1] + alto * .34 + (1 - entra) * L.u * .16 - sale * L.u * .12, mano, -8 - abre * 12 - sale * 8, entra * (1 - sale));
    pon(manoD, sobre[0] + L.huevo * .95 + aleja, sobre[1] + alto * .02 - (1 - entra) * L.u * .1 - sale * L.u * .18, mano, 6 + abre * 12 + sale * 8, entra * (1 - sale));
    // La yema: el dibujo del huevo frito recortado a un círculo; al caer en la paila el recorte se abre
    // y aparece la clara, mientras se achata (la paila se ve de lado)
    const fondoPaila = [px - L.pailaW * .12, py - L.pailaW * .02];
    const fw = mezcla(L.huevo * 1.05, L.pailaW * .44, plano);
    const r = mezcla(fw * .211 * asoma, fw * .75, plano);
    const fy = mezcla(sobre[1] + alto * .18, fondoPaila[1], cae * cae);
    const estira = 1 + Math.sin(cae * Math.PI) * .12;
    frito.style.clipPath = `circle(${r.toFixed(1)}px at 50.1% 52.9%)`;
    pon(frito, mezcla(sobre[0], fondoPaila[0], cae), fy, fw, Math.sin(t * .8) * 2 * plano, asoma > 0 ? 1 : 0, mezcla(estira, .42, plano) * (1 + Math.sin(t * 2.2) * .015 * plano));
    pon(paila, px, py, L.pailaW, 0, 0.92 + suave(0.8, 0.9, e) * .08);
    notaIni.style.opacity = (0.85 * (1 - suave(0.1, 0.3, e))).toFixed(3);
    notaFin.style.opacity = (0.85 * suave(0.8, 0.92, e)).toFixed(3);
  });
}

/* =================== Del batch al saco: macro y micro caen, se revuelven y el alimento cae al saco =================== */
// Las fotos (montones, mezcladora y saco) son fijas; los granos que caen se dibujan en un lienzo encima.
if (!quieto) {
  const sec = $('#batch'), mesa = $('#batchMesa'), lienzo = $('#batchLienzo'), ctx = lienzo.getContext('2d');
  const mez = $('.mezcladora', mesa), saco = $('.saco', mesa), pasos = $$('#batchPasos li');
  const ings = $$('.ing', mesa).map((f, i) => ({ img: $('img', f), tipo: ['maiz', 'soya', 'afrechillo', 'premix'][i], acum: 0 }));
  const COL = { maiz: ['#f2a314', '#e38e0b', '#f7b93a'], soya: ['#d9b36d', '#caa057', '#e6c48b'], afrechillo: ['#b5773e', '#a46632', '#c98d54'], premix: ['#efe5cf', '#e4d8bd', '#f7f0e1'] };
  const TAM = { maiz: [3.4, 4.6], soya: [2.6, 3.8], afrechillo: [2.4, 3.6], premix: [1.1, 1.8] };
  const MEZCLA = [...COL.maiz, ...COL.soya, ...COL.afrechillo, '#d9c69a', '#c79a5a'];
  const elige = a => a[(Math.random() * a.length) | 0];
  const rel = (el, R) => { const r = el.getBoundingClientRect(); return { x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height }; };
  const rango = (p, a, b) => suave(a, a + 0.04, p) * (1 - suave(b - 0.04, b, p));
  let granos = [], pB = 0, antes = 0, paso = 0, acumSaco = 0;
  cuadros.push(t => {
    const dt = Math.min(0.05, Math.max(0, t - antes)); antes = t;
    if (!enPantalla.get(sec)) return;
    const R = mesa.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const W = Math.round(R.width * dpr), H = Math.round(R.height * dpr);
    if (lienzo.width !== W || lienzo.height !== H) { lienzo.width = W; lienzo.height = H; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, R.width, R.height);
    pB = mezcla(pB, avance(sec), 0.1);
    const macro = rango(pB, 0.04, 0.4), micro = rango(pB, 0.3, 0.54), revuelve = rango(pB, 0.38, 0.8), ensaca = rango(pB, 0.64, 1.01);
    const g = R.height * 1.6; // gravedad, en píxeles por segundo al cuadrado
    // Los montones se vacían y la pala del premix se inclina hacia la mezcladora
    const vacia = suave(0.04, 0.4, pB), vaciaMicro = suave(0.3, 0.54, pB);
    ings.forEach(o => {
      o.img.style.transform = o.tipo === 'premix'
        ? `rotate(${(-28 * Math.min(1, vaciaMicro * 3) * (1 - suave(0.5, 0.58, pB))).toFixed(1)}deg) scale(${(1 - 0.15 * vaciaMicro).toFixed(3)})`
        : `scale(${(1 - 0.5 * vacia).toFixed(3)})`;
    });
    const M = rel(mez, R), S = rel(saco, R);
    // La mezcladora vibra mientras revuelve
    mez.style.transform = revuelve > 0.01 ? `translate(${(Math.sin(t * 53) * 1.4 * revuelve).toFixed(2)}px,${(Math.cos(t * 47) * 1.1 * revuelve).toFixed(2)}px)` : '';
    const llenado = suave(0.66, 0.98, pB);
    saco.style.transform = `scale(${(1 + 0.06 * llenado).toFixed(3)},${(1 + 0.03 * llenado).toFixed(3)})`;
    // Macro y micro: caen en arco desde cada montón hasta la boca de la mezcladora
    ings.forEach(o => {
      o.acum += (o.tipo === 'premix' ? 110 * micro : 38 * macro) * dt;
      const I = rel(o.img, R), [a, b] = TAM[o.tipo];
      while (o.acum >= 1) {
        o.acum -= 1;
        const x0 = I.x + I.w * (0.3 + Math.random() * 0.4), y0 = I.y + I.h * (o.tipo === 'premix' ? 0.35 : 0.55);
        const tx = M.x + M.w * (0.16 + Math.random() * 0.44), ty = M.y + M.h * (0.24 + Math.random() * 0.1), T = 0.75 + Math.random() * 0.3;
        const w = a + Math.random() * (b - a);
        granos.push({ x: x0, y: y0, vx: (tx - x0) / T, vy: (ty - y0 - 0.5 * g * T * T) / T, fin: ty, edad: 0, c: elige(COL[o.tipo]), w,
          h: w * (o.tipo === 'maiz' ? 1.25 : o.tipo === 'premix' ? 1 : 0.6), r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, a: o.tipo === 'premix' ? 0.75 : 1 });
      }
    });
    // El alimento revuelto sale por la descarga y cae al saco
    const sx = M.x + M.w * 0.385, sy = M.y + M.h * 0.8, ky = S.y + S.h * 0.09;
    acumSaco += 170 * ensaca * dt;
    while (acumSaco >= 1) {
      acumSaco -= 1; const w = 2.2 + Math.random() * 2.4;
      granos.push({ x: sx + (Math.random() - 0.5) * M.w * 0.035, y: sy, vx: (Math.random() - 0.5) * 18, vy: 40 + Math.random() * 40, fin: ky + Math.random() * 6, edad: 0, c: elige(MEZCLA), w, h: w * 0.8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, a: 1 });
    }
    // Lo que hay dentro de la mezcladora: gira despacio y se acelera mientras revuelve
    const contenido = suave(0.08, 0.5, pB) * (1 - suave(0.72, 0.97, pB));
    const n = Math.round(110 * contenido), cx = M.x + M.w * 0.4, cy = M.y + M.h * 0.31, rx = M.w * 0.27, ry = M.h * 0.045, vel = 0.4 + 3.2 * revuelve;
    for (let i = 0; i < n; i++) {
      const k = (i * 0.6180339) % 1, ang = t * vel * (0.7 + k * 0.6) + i * 2.399;
      ctx.fillStyle = MEZCLA[i % MEZCLA.length]; ctx.beginPath();
      ctx.ellipse(cx + Math.cos(ang) * rx * (0.25 + 0.75 * k), cy + Math.sin(ang * 1.7) * ry * (0.5 + 0.5 * ((i * 0.381966) % 1)), 2.2 + (i % 3) * 0.6, 1.6 + (i % 2) * 0.6, ang, 0, Math.PI * 2); ctx.fill();
    }
    // El saco se va llenando
    if (llenado > 0.02) {
      const kx = S.x + S.w * 0.52, rs = S.w * 0.26 * Math.sqrt(llenado);
      for (let i = 0; i < 60 * llenado; i++) { const k = (i * 0.6180339) % 1, an = i * 2.399; ctx.fillStyle = MEZCLA[i % MEZCLA.length]; ctx.beginPath(); ctx.ellipse(kx + Math.cos(an) * rs * k, ky + 2 + Math.sin(an) * 4 * k, 2.4, 1.8, an, 0, Math.PI * 2); ctx.fill(); }
    }
    // Granos en el aire
    granos = granos.filter(p => {
      p.edad += dt; p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y >= p.fin && p.vy > 0) return false;
      ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w / 2, p.h / 2, p.r, 0, Math.PI * 2); ctx.fill();
      return p.edad < 4;
    });
    ctx.globalAlpha = 1;
    if (granos.length > 1400) granos.splice(0, granos.length - 1400);
    const ps = pB < 0.3 ? 0 : pB < 0.42 ? 1 : pB < 0.66 ? 2 : 3;
    if (ps !== paso) { pasos[paso].classList.remove('activo'); pasos[ps].classList.add('activo'); paso = ps; }
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
    // Cada producto es un modelo 3D hecho a partir de su foto (Tripo, aligerado con gltf-transform y meshopt).
    // Se escala para que quepa en su espacio, se apoya en la repisa y se centra; si el modelo no carga, queda la foto.
    // Mientras el modelo no llega se ve la foto; los modelos (unos 700 KB cada uno) se piden recién cuando la repisa se acerca.
    const lectorGLB = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), porCargar = [];
    const modelo = (archivo, ancho = 1.45, alto = 1.05) => {
      const g = new THREE.Group(), lamina = foto(archivo, ancho, alto);
      g.add(lamina);
      porCargar.push(() => lectorGLB.load('modelos/' + archivo + '.glb', gltf => {
        const m = gltf.scene, caja3 = new THREE.Box3().setFromObject(m), tam = caja3.getSize(new THREE.Vector3()), c = caja3.getCenter(new THREE.Vector3());
        const e = Math.min(ancho / Math.max(tam.x, tam.z * 0.8), alto / tam.y);
        m.scale.setScalar(e); m.position.set(-c.x * e, -caja3.min.y * e, -c.z * e);
        m.traverse(o => { if (o.isMesh && o.material && o.material.map) o.material.map.anisotropy = 8; });
        g.remove(lamina); g.add(m);
      }));
      return g;
    };
    let modelosPedidos = false;
    const pideModelos = () => { if (modelosPedidos) return; modelosPedidos = true; porCargar.forEach(f => f()); };
    const vigiaRep = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { pideModelos(); vigiaRep.disconnect(); } }, { rootMargin: '150% 0px' });
    vigiaRep.observe($('#repisa'));
    const productos = botones.map((b, i) => {
      const g = new THREE.Group(), tipo = b.dataset.tipo;
      if (tipo === 'promo') g.add(pon(modelo('bandeja', 1.05, 0.75), -0.3, 0, 0), pon(modelo('monster', 0.5, 1.05), 0.6, 0, 0.14)); else g.add(modelo(tipo));
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
