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
  // Desde el día de la apertura (23/11/2026) ya no se anuncia «abrimos el 23»: se muestra el horario y se quita la fila «Apertura»
  if (ahora >= new Date('2026-11-23T00:00:00-03:00')) { $('#estado').textContent = 'Abierto de lunes a sábado, 8:30 a 17:00'; const f = $('#filaApertura'); if (f) f.remove(); }
  if (ahora >= new Date('2026-12-05T00:00:00-03:00')) $('#bienvenida').hidden = true;
}

/* ---------- Aprende el manejo de las aves: pestañas por tema (accesibles con teclado; sin JavaScript se ven todos los temas) ---------- */
{
  const tabs = $$('.apr-temas [role=tab]'), paneles = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
  const elige = (i, foco) => { tabs.forEach((t, k) => { const si = k === i; t.setAttribute('aria-selected', si); t.tabIndex = si ? 0 : -1; paneles[k].hidden = !si; }); if (foco) tabs[i].focus(); };
  tabs.forEach((t, i) => { t.addEventListener('click', () => elige(i)); t.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); elige((i + d + tabs.length) % tabs.length, true); } }); });
  if (tabs.length) elige(0);
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
  // Lo que se mueve en el paisaje (capa aparte encima del frente): autos por el otro carril, una carreta con caballo
  // saliendo de Oro Verde, gente entrando al Emporio y la bodega donde entra el camión al final.
  const COLORES_AUTO = ['#c8281f', '#2f5f8a', '#e8e4da', '#3b3b35', '#d9a520', '#5f7d52', '#8a8f94'];
  const auto = (i, color) => `<g class="auto" data-i="${i}"><path d="M0 22 q2 -12 18 -13 l14 -9 h30 l14 9 h10 q8 1 8 13 v6 h-94z" fill="${color}"/><path d="M36 2 h24 l11 8 h-46z" fill="#cfe3ec"/>` +
    `<circle cx="20" cy="29" r="7" fill="#1a1a1a"/><circle cx="76" cy="29" r="7" fill="#1a1a1a"/><circle class="faro" cx="2" cy="16" r="9" fill="#fff1b8" opacity="0"/><rect x="0" y="14" width="4" height="4" fill="#fff3c4"/></g>`;
  const AUTOS = COLORES_AUTO.map((col, i) => ({ x0: i * (ANCHO / COLORES_AUTO.length) + azar() * 300, v: 210 + azar() * 140, col }));
  const carreta = '<g class="carreta"><g class="caballo"><path d="M0 0 q10 -16 34 -14 q16 1 22 -14 l8 -10 4 6 -4 14 q-2 12 -12 18 v26 h-6 v-22 h-30 v22 h-6 v-24 q-10 -2 -10 -2z" fill="#6b4a2b"/><path d="M58 -32 l6 -8 2 8z" fill="#4a3320"/></g>' +
    '<path d="M-6 -6 h-30" stroke="#4a3320" stroke-width="3"/><rect x="-96" y="-22" width="60" height="22" rx="3" fill="#a0784a"/><path d="M-96 -22 h60" stroke="#6b4a2b" stroke-width="4"/>' +
    '<g class="rueda-c"><circle cx="-66" cy="4" r="14" fill="none" stroke="#4a3320" stroke-width="4"/><path d="M-80 4h28M-66 -10v28" stroke="#4a3320" stroke-width="2.5"/></g></g>';
  const persona = (i, col) => `<g class="persona" data-i="${i}"><circle cx="0" cy="-46" r="6" fill="#c99a76"/><rect x="-6" y="-39" width="12" height="20" rx="4" fill="${col}"/>` +
    `<path class="pi" d="M-2 -20 v20" stroke="#2b2b28" stroke-width="4" stroke-linecap="round"/><path class="pd" d="M2 -20 v20" stroke="#2b2b28" stroke-width="4" stroke-linecap="round"/></g>`;
  const GENTE = [['#2f6b3f', -1], ['#c8281f', 1], ['#2f5f8a', -1], ['#d9a520', 1], ['#8a5a9e', -1]].map(([col, lado], i) => ({ col, lado, fase: i / 5 }));
  const vivosSvg = `<svg class="vivos" viewBox="0 0 ${ANCHO} 600" xmlns="http://www.w3.org/2000/svg">` +
    `<g class="bodega"><rect x="5168" y="380" width="196" height="120" fill="#141412"/><g class="cortina"><rect x="5168" y="380" width="196" height="120" fill="#b4b8ba"/>` +
    Array.from({ length: 14 }, (_, i) => `<rect x="5168" y="${384 + i * 8.5}" width="196" height="2.5" fill="#8f9496"/>`).join('') + `</g><rect x="5168" y="372" width="196" height="10" fill="#262623"/>` +
    `<text x="5266" y="376" text-anchor="middle" ${LETRA} font-size="11" fill="#e8e4da">BODEGA</text></g>` +
    AUTOS.map((a, i) => auto(i, a.col)).join('') + carreta + GENTE.map((g, i) => persona(i, g.col)).join('') + '</svg>';
  const frenteCapa = `<div class="capa frente">${frente}<div class="copia tarde">${frente}</div><div class="copia noche">${frente}</div><div class="copia luces">${svg(ANCHO, luces)}</div>${vivosSvg}</div>`;

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
  const vivos = $('.vivos', paisaje), autosEl = $$('.auto', vivos), farosEl = $$('.faro', vivos), carretaEl = $('.carreta', vivos), caballoEl = $('.caballo', vivos), ruedaC = $('.rueda-c', vivos);
  const genteEl = $$('.persona', vivos), cortina = $('.cortina', vivos);
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
    // Autos por el carril contrario (van hacia la izquierda, de forma continua)
    AUTOS.forEach((a, i) => { const x = ((a.x0 - t * a.v) % ANCHO + ANCHO) % ANCHO - 100; autosEl[i].setAttribute('transform', `translate(${x.toFixed(1)},512) scale(.82)`); });
    farosEl.forEach(f => f.setAttribute('opacity', luz.toFixed(2)));
    vivos.style.filter = noche > 0.01 ? `brightness(${(1 - 0.55 * noche).toFixed(3)})` : '';
    // Carreta con caballo saliendo de Oro Verde por la orilla del camino (vuelta cada 26 s)
    const kc = (t % 26) / 26, xc = 1960 + kc * 900, pasoC = Math.sin(t * 7);
    carretaEl.setAttribute('transform', `translate(${xc.toFixed(1)},${(494 - Math.abs(pasoC) * 1.5).toFixed(1)}) scale(.9)`);
    caballoEl.setAttribute('transform', `rotate(${(pasoC * 2).toFixed(2)})`); ruedaC.setAttribute('transform', `rotate(${(t * 160 % 360).toFixed(1)} -66 4)`);
    carretaEl.setAttribute('opacity', (kc < 0.06 ? kc / 0.06 : kc > 0.92 ? (1 - kc) / 0.08 : 1).toFixed(2));
    // Gente que camina por la vereda y entra al Emporio (se desvanece en la puerta)
    GENTE.forEach((g, i) => {
      const k = ((t / 9 + g.fase) % 1), x = 5400 + g.lado * (1 - k) * 330, paso = Math.sin(t * 9 + i) * 22;
      genteEl[i].setAttribute('transform', `translate(${x.toFixed(1)},508) scale(${g.lado > 0 ? -1 : 1},1)`);
      genteEl[i].setAttribute('opacity', (k > 0.9 ? (1 - k) / 0.1 : k < 0.08 ? k / 0.08 : 1).toFixed(2));
      genteEl[i].querySelector('.pi').setAttribute('transform', `rotate(${paso.toFixed(1)} -2 -20)`); genteEl[i].querySelector('.pd').setAttribute('transform', `rotate(${(-paso).toFixed(1)} 2 -20)`);
    });
    // Al final, la cortina de la bodega sube y el camión entra
    const entra = suave(0.93, 1, pv), abre = suave(0.88, 0.95, pv);
    cortina.setAttribute('transform', `translate(0,${(-abre * 112).toFixed(1)})`);
    cam.style.setProperty('--giro-rueda', (pv * 6400).toFixed(0) + 'deg');
    const puertaX = (5266 - 5400) * esc + W / 2, camX = cam.offsetLeft + cam.offsetWidth * 0.5;
    cam.style.transform = `translate3d(${(entra * (puertaX - camX)).toFixed(1)}px,${(Math.sin(t * 9) * (pv > 0.005 && pv < 0.93 ? 1.6 : 0) - entra * frenteEl.offsetHeight * 0.1).toFixed(1)}px,0) scale(${(1 - entra * 0.35).toFixed(3)})`;
    cam.style.opacity = (1 - suave(0.97, 1, pv)).toFixed(3);
    const h = u < 0.12 ? 0 : u < 0.4 ? 1 : u < 0.76 ? 2 : 3;
    if (h !== hito) { hitos[hito].classList.remove('activo'); hitos[h].classList.add('activo'); hito = h; }
  });
}

/* =================== La pizarra: el huevo de tiza recorre el camino, unas manos lo quiebran y cae a la paila =================== */
// Para que sea fluida en el celular: el camino con su textura de tiza se pinta UNA vez en un mapa de bits y en cada cuadro
// solo se recorta la parte ya dibujada (lienzo 2D); los dibujos se mueven solo con transform y opacity (sin cambiar tamaños),
// y el avance sigue al desplazamiento con un suavizado que no depende de cuántos cuadros por segundo dé el equipo.
if (!quieto) {
  const av = $('#avicola'), piz = $('#pizarra');
  const revela = $('.tz-revela', piz), svg = $('.tz-camino', piz), via = $('.tz-via', piz), cv = via.getContext('2d');
  const notaIni = $('.tz-inicio', piz), notaFin = $('.tz-fin', piz), txtIni = $('text', notaIni), txtFin = $('text', notaFin);
  const im = n => $('.tz-' + n, piz);
  const huevo = im('huevo'), mitadI = im('mitad-i'), mitadD = im('mitad-d'), grieta = im('grieta'), trazo = $('polyline', grieta), frito = im('frito'), paila = im('paila'), manoI = im('mano-i'), manoD = im('mano-d');
  const proporcion = el => (+el.getAttribute('height')) / (+el.getAttribute('width'));
  // Tamaño base de cada dibujo: se fija al armar (no en cada cuadro); después solo se escala con transform
  const base = (el, w) => { el._w = w; el._h = w * proporcion(el); el.style.width = w.toFixed(1) + 'px'; el.style.height = el._h.toFixed(1) + 'px'; el._t = el._o = null; };
  // Coloca un dibujo con su centro en (x, y), un ancho en px, giro, opacidad y escala vertical; escribe solo si cambió
  const pon = (el, x, y, w, giro = 0, op = 1, sy = 1) => {
    const e = w / el._w, t = `translate3d(${(x - el._w / 2).toFixed(1)}px,${(y - el._h / 2).toFixed(1)}px,0) rotate(${giro.toFixed(2)}deg) scale(${e.toFixed(4)},${(e * sy).toFixed(4)})`;
    if (t !== el._t) { el.style.transform = t; el._t = t; }
    const o = op.toFixed(3); if (o !== el._o) { el.style.opacity = o; el._o = o; }
    return e;
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
  let L = {}, largo = 1, hitos = null, puntos = [], trazado = null, mapa = null, dpr = 1, visto = -1, version = 0;
  const N = 720; // puntos guardados a lo largo del camino (el huevo se interpola entre ellos)
  const punto = s => { const f = (largo > 0 ? limita(s / largo || 0) : 0) * N, i = Math.min(N - 1, Math.floor(f)), k = f - i, a = puntos[i], b = puntos[i + 1]; return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }; };
  const pasos = $$('.paso', av);
  // Pinta el camino con la textura de tiza en un mapa de bits (una vez por tamaño de pantalla)
  const pintaMapa = (W, H, d) => {
    const f = $('#tiza').outerHTML.replace('id="tiza"', 'id="t"');
    const v = L.via, svgTxt = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * dpr)}" height="${Math.round(H * dpr)}" viewBox="0 0 ${W} ${H}"><defs>${f}</defs><g filter="url(#t)" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="${d}" stroke="#f3f1ea" stroke-width="${v.toFixed(1)}"/><path d="${d}" stroke="#24302a" stroke-width="${(v - 8).toFixed(1)}"/>` +
      `<path d="${d}" stroke="#f3f1ea" stroke-width="3" stroke-dasharray="16 18" opacity=".8"/></g></svg>`;
    const yo = ++version, img = new Image();
    img.onload = () => {
      if (yo !== version) return;
      const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); mapa = c; visto = -1;
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgTxt);
  };
  const arma = () => {
    const W = piz.clientWidth, H = piz.clientHeight, ancho = W >= 900;
    if (!W || !H) return;
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
    revela.setAttribute('d', d); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    largo = revela.getTotalLength();
    if (!(largo > 0)) { puntos = []; return; }
    puntos = Array.from({ length: N + 1 }, (_, i) => revela.getPointAtLength(largo * i / N));
    trazado = new Path2D(d);
    dpr = Math.min(2, devicePixelRatio || 1);
    via.width = Math.round(W * dpr); via.height = Math.round(H * dpr); mapa = null; visto = -1;
    pintaMapa(W, H, d);
    // Tamaños base de los dibujos
    for (const el of [huevo, mitadI, mitadD, grieta]) base(el, L.huevo);
    base(manoI, L.huevo * 1.9); base(manoD, L.huevo * 1.9); base(paila, L.pailaW); base(frito, L.pailaW * .44);
    // Letreros «Oro Verde» y «a tu mesa»
    const tam = Math.max(20, u * .055);
    for (const s of [notaIni, notaFin]) s.setAttribute('viewBox', `0 0 ${W} ${H}`);
    for (const t of [txtIni, txtFin]) t.setAttribute('font-size', tam.toFixed(0));
    txtIni.setAttribute('x', P[0][0].toFixed(0)); txtIni.setAttribute('y', (P[0][1] + L.via * .5 + tam * 1.05).toFixed(0));
    if (ancho) { txtFin.setAttribute('text-anchor', 'end'); txtFin.setAttribute('x', (L.paila[0] - L.pailaW * .52).toFixed(0)); txtFin.setAttribute('y', (L.paila[1] + L.pailaW * .16).toFixed(0)); }
    else { txtFin.setAttribute('text-anchor', 'middle'); txtFin.setAttribute('x', (L.paila[0] - L.pailaW * .1).toFixed(0)); txtFin.setAttribute('y', (L.paila[1] + L.pailaW * .5).toFixed(0)); }
    // En celular el contenido tapa la pizarra salvo en la ventana libre al comienzo de cada paso: los momentos clave caen ahí
    hitos = null;
    if (!ancho && pasos.length >= 4) {
      const tope = av.getBoundingClientRect().top, rango = Math.max(1, av.offsetHeight - H);
      hitos = [1, 2, 3].map(i => limita((pasos[i].getBoundingClientRect().top - tope + H * .2) / rango));
    }
  };
  // Convierte el avance del desplazamiento en el avance de la historia (igual en escritorio; por tramos en celular)
  const tramo = p => {
    if (!hitos) return p;
    const X = [0, ...hitos, 1], Y = [0.08, 0.4, 0.675, 0.87, 1];
    for (let i = 0; i < X.length - 1; i++) if (p <= X[i + 1]) return mezcla(Y[i], Y[i + 1], limita((p - X[i]) / Math.max(1e-4, X[i + 1] - X[i])));
    return 1;
  };
  // Dibuja en el lienzo solo la parte del camino ya recorrida (más un poco delante del huevo)
  const pintaVia = s => {
    if (!mapa) return;
    const vis = Math.min(largo, s + largo * .22 + 30);
    if (Math.abs(vis - visto) < 0.4) return;
    visto = vis;
    cv.setTransform(1, 0, 0, 1, 0, 0); cv.globalCompositeOperation = 'source-over'; cv.clearRect(0, 0, via.width, via.height);
    cv.setTransform(dpr, 0, 0, dpr, 0, 0); cv.lineWidth = L.via * 2; cv.lineCap = 'round'; cv.strokeStyle = '#000';
    cv.setLineDash([Math.max(0.01, vis), largo + 200]); cv.lineDashOffset = 0; cv.stroke(trazado);
    cv.globalCompositeOperation = 'source-in'; cv.setTransform(1, 0, 0, 1, 0, 0); cv.drawImage(mapa, 0, 0);
    cv.globalCompositeOperation = 'source-over';
  };
  let ancho0 = 0, alto0 = 0;
  const reArma = () => { const W = piz.clientWidth, H = piz.clientHeight; if (W === ancho0 && Math.abs(H - alto0) < 120) return; ancho0 = W; alto0 = H; arma(); };
  arma(); ancho0 = piz.clientWidth; alto0 = piz.clientHeight;
  addEventListener('resize', reArma); addEventListener('load', arma);
  let pH = 0, tAnt = 0, opIni = '', opFin = '';
  cuadros.push(t => {
    const dt0 = t - tAnt, dt = dt0 > 0 && dt0 < 0.1 ? dt0 : 1 / 60; tAnt = t; // si el reloj salta o retrocede, cuenta como un cuadro
    if (!enPantalla.get(av) || !puntos.length) return;
    // Suavizado independiente de los cuadros por segundo: sigue al dedo sin saltos ni retraso
    pH = mezcla(pH, avance(av), 1 - Math.pow(1 - 0.2, dt * 60));
    const e = tramo(pH);
    // 1) El huevo rueda por el camino y la tiza se dibuja delante de él
    const viaje = suave(0.02, 0.5, e), s = viaje * largo;
    pintaVia(s);
    const q = punto(s), q2 = punto(Math.min(largo, s + 2));
    // Sobre la paila esperan las manos: el huevo sube del final del camino a ese punto
    const [px, py] = L.paila, alto = L.huevo * proporcion(huevo);
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
    if (trazo._r !== raja) { trazo.style.strokeDashoffset = (1 - raja).toFixed(3); trazo._r = raja; }
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
    const esc = pon(frito, mezcla(sobre[0], fondoPaila[0], cae), fy, fw, Math.sin(t * .8) * 2 * plano, asoma > 0 ? 1 : 0, mezcla(estira, .42, plano) * (1 + Math.sin(t * 2.2) * .015 * plano));
    const cp = asoma > 0 ? `circle(${(r / esc).toFixed(1)}px at 50.1% 52.9%)` : 'circle(0px at 50% 50%)';
    if (cp !== frito._cp) { frito.style.clipPath = cp; frito._cp = cp; }
    pon(paila, px, py, L.pailaW, 0, 0.92 + suave(0.8, 0.9, e) * .08);
    const oi = (0.85 * (1 - suave(0.1, 0.3, e))).toFixed(2), of = (0.85 * suave(0.8, 0.92, e)).toFixed(2);
    if (oi !== opIni) { notaIni.style.opacity = oi; opIni = oi; }
    if (of !== opFin) { notaFin.style.opacity = of; opFin = of; }
  });
}

/* =================== Del batch al saco: macro y micro caen, se revuelven y el alimento cae al saco =================== */
// Las fotos (montones, molino y saco) son fijas; las manos se mueven con transform y los granos se dibujan en un lienzo encima.
if (!quieto) {
  const sec = $('#batch'), mesa = $('#batchMesa'), lienzo = $('#batchLienzo'), ctx = lienzo.getContext('2d');
  const mez = $('.mezcladora', mesa), saco = $('.saco', mesa), pasos = $$('#batchPasos li');
  const ings = $$('.ing', mesa).map((f, i) => ({ img: $('img', f), tipo: ['maiz', 'soya', 'afrechillo', 'premix'][i], acum: 0 }));
  const COL = { maiz: ['#f2a314', '#e38e0b', '#f7b93a'], soya: ['#d9b36d', '#caa057', '#e6c48b'], afrechillo: ['#b5773e', '#a46632', '#c98d54'], premix: ['#efe5cf', '#e4d8bd', '#f7f0e1'] };
  // Manos que echan cada ingrediente al molino: ventana de tiempo, punta (fracción de la imagen), giro y caudal
  const manos = [['.mano-maiz', 'maiz', 0.04, 0.17, [0.77, 0.65], 9, 0], ['.mano-soya', 'soya', 0.16, 0.29, [0.24, 0.52], -9, 0.02], ['.mano-afrechillo', 'afrechillo', 0.28, 0.39, [0.77, 0.65], 9, -0.01], ['.mano-premix', 'premix', 0.4, 0.53, [0.13, 0.6], -7, 0.01]]
    .map(([sel, tipo, a, b, tip, giro, dx]) => ({ el: $(sel, mesa), tipo, a, b, tip, giro, dx, ancho: tipo === 'premix' ? 0.34 : 0.4, flujo: tipo === 'premix' ? 120 : 75, acum: 0 }));
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
    const macro = rango(pB, 0.04, 0.4), micro = rango(pB, 0.38, 0.54), revuelve = rango(pB, 0.46, 0.8), ensaca = rango(pB, 0.64, 1.01);
    const g = R.height * 1.6; // gravedad, en píxeles por segundo al cuadrado
    // Los montones se van achicando a medida que las manos sacan de cada uno
    ings.forEach(o => {
      const v = o.tipo === 'premix' ? suave(0.4, 0.52, pB) : o.tipo === 'maiz' ? suave(0.05, 0.16, pB) : o.tipo === 'soya' ? suave(0.17, 0.28, pB) : suave(0.29, 0.38, pB);
      o.img.style.transform = `scale(${(1 - 0.45 * v).toFixed(3)})`;
    });
    const M = rel(mez, R), S = rel(saco, R);
    // El molino vibra suave mientras revuelve
    mez.style.transform = revuelve > 0.01 ? `translate(${(Math.sin(t * 41) * 1.1 * revuelve).toFixed(2)}px,${(Math.cos(t * 37) * 0.9 * revuelve).toFixed(2)}px)` : '';
    const llenado = suave(0.66, 0.98, pB);
    saco.style.transform = `scale(${(1 + 0.06 * llenado).toFixed(3)},${(1 + 0.03 * llenado).toFixed(3)})`;
    // Las manos: cada una entra en su turno, se inclina con cuidado sobre la tolva y vuelve a salir.
    // La punta de la pala (o del bol) queda siempre sobre la boca del molino; desde ahí caen los granos.
    const bocaX = M.x + M.w * 0.45, bocaY = M.y + M.h * 0.05;
    manos.forEach(m => {
      const vis = rango(pB, m.a, m.b), inclina = suave(m.a + 0.02, m.a + 0.05, pB) * (1 - suave(m.b - 0.04, m.b - 0.01, pB));
      const w = M.w * m.ancho, h = w, tx = bocaX + m.dx * M.w, ty = bocaY - M.h * 0.2;
      const entra = (1 - vis) * h * 0.7, bal = Math.sin(t * 2.3 + m.a * 9) * 1.2 * vis;
      m.el.style.width = w.toFixed(1) + 'px';
      m.el.style.transformOrigin = `${m.tip[0] * 100}% ${m.tip[1] * 100}%`;
      m.el.style.transform = `translate3d(${(tx - m.tip[0] * w).toFixed(1)}px,${(ty - m.tip[1] * h - entra).toFixed(1)}px,0) rotate(${(m.giro * inclina + bal).toFixed(2)}deg)`;
      m.el.style.opacity = vis.toFixed(3);
      // Granos que caen desde la punta hasta la tolva
      m.acum += m.flujo * inclina * vis * dt;
      const [a, b] = TAM[m.tipo];
      while (m.acum >= 1) {
        m.acum -= 1;
        const x0 = tx + (Math.random() - 0.5) * w * 0.06, y0 = ty;
        const fx = bocaX + (Math.random() - 0.5) * M.w * 0.22, fy = bocaY + M.h * (0.04 + Math.random() * 0.06), T = 0.32 + Math.random() * 0.18;
        const s = a + Math.random() * (b - a);
        granos.push({ x: x0, y: y0, vx: (fx - x0) / T, vy: (fy - y0 - 0.5 * g * T * T) / T, fin: fy, edad: 0, c: elige(COL[m.tipo]), w: s,
          h: s * (m.tipo === 'maiz' ? 1.25 : m.tipo === 'premix' ? 1 : 0.6), r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, a: m.tipo === 'premix' ? 0.8 : 1 });
      }
    });
    // El alimento revuelto sale por el canal de madera y cae al saco
    const sx = M.x + M.w * 0.33, sy = M.y + M.h * 0.78, ky = S.y + S.h * 0.09;
    acumSaco += 170 * ensaca * dt;
    while (acumSaco >= 1) {
      acumSaco -= 1; const w = 2.2 + Math.random() * 2.4;
      granos.push({ x: sx + (Math.random() - 0.5) * M.w * 0.035, y: sy, vx: (Math.random() - 0.5) * 18, vy: 40 + Math.random() * 40, fin: ky + Math.random() * 6, edad: 0, c: elige(MEZCLA), w, h: w * 0.8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, a: 1 });
    }
    // Lo que se ve dentro de la tolva: gira despacio y se acelera mientras revuelve
    const contenido = suave(0.08, 0.5, pB) * (1 - suave(0.72, 0.97, pB));
    const n = Math.round(70 * contenido), cx = bocaX, cy = M.y + M.h * 0.1, rx = M.w * 0.13, ry = M.h * 0.022, vel = 0.4 + 3.2 * revuelve;
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
    const ps = pB < 0.38 ? 0 : pB < 0.54 ? 1 : pB < 0.66 ? 2 : 3;
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
    new THREE.TextureLoader().load('img/logo-emporio.webp', tx => {
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

    // La repisa ya no secuestra el desplazamiento: bajar con la rueda o el dedo sigue de largo por la página.
    // Los productos se recorren deslizando de lado (dedo, mouse o panel táctil), con las flechas o tocando un nombre.
    hay3d = true; raiz.classList.add('mov3d');
    $('#repAyuda').textContent = 'Desliza de lado o arrastra la repisa para ver los productos; para seguir, solo baja. Toca un producto para girarlo y verlo de cerca.';
    const ficha = { nombre: $('#repNombre'), desc: $('#repDesc'), n: $('#repN'), abrir: $('#repAbrir') }, lista = $('#repLista');
    const DIST = [7.4, 5.2, 3.9];
    let pR = 0, objetivo = 0, foco = -1, abierto = false, zoom = 1, dist = DIST[1];
    const porProducto = () => Math.max(120, lr.clientWidth * 0.32); // píxeles de arrastre para pasar de un producto al siguiente
    const ir = i => { objetivo = limita(Math.round(i), 0, n - 1); };
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
    lr.addEventListener('pointerdown', e => { ar = { x: e.clientX, y: e.clientY, obj: objetivo, mov: false }; lr.setPointerCapture(e.pointerId); });
    lr.addEventListener('pointermove', e => {
      if (!ar) return; const dx = e.clientX - ar.x;
      if (!ar.mov && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - ar.y)) { ar.mov = true; lr.classList.add('arrastra'); }
      if (ar.mov) objetivo = limita(ar.obj - dx / porProducto(), -0.3, n - 0.7);
    });
    const suelta = e => {
      if (!ar) return; const fue = ar.mov, quietoClic = Math.hypot(e.clientX - ar.x, e.clientY - ar.y) < 8; ar = null; lr.classList.remove('arrastra');
      if (fue) ir(objetivo); // al soltar, se acomoda en el producto más cercano
      if (fue || !quietoClic || e.type === 'pointercancel') return;
      const r = lr.getBoundingClientRect(); punto.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rayo.setFromCamera(punto, camR);
      const toca = rayo.intersectObjects(productos, true)[0]; if (!toca) return;
      let o = toca.object; while (o && o.userData.idx === undefined) o = o.parent;
      if (!o) return; if (o.userData.idx === foco) { ponAbierto(!abierto); if (abierto) zoom = 2; } else ir(o.userData.idx);
    };
    lr.addEventListener('pointerup', suelta); lr.addEventListener('pointercancel', suelta);
    // Panel táctil: el gesto de lado también hace rodar la repisa
    // (la rueda vertical no se toca: la página sigue bajando)
    let ruedaFin = 0;
    escenaRep.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault(); objetivo = limita(objetivo + e.deltaX / porProducto(), -0.3, n - 0.7);
      clearTimeout(ruedaFin); ruedaFin = setTimeout(() => ir(objetivo), 140);
    }, { passive: false });
    lr.addEventListener('dblclick', () => { zoom = zoom === 2 ? 1 : 2; });

    let antes = 0;
    cuadros.push(t => {
      const dt = limita(t - antes, 0, 0.05); antes = t;
      if (!enPantalla.get(rep)) return;
      ajusta(rR, camR, lr);
      pR = mezcla(pR, objetivo, 1 - Math.pow(1 - 0.14, Math.max(0.5, Math.min(4, dt * 60))));
      const camX = pR * SEP, f = limita(Math.round(objetivo), 0, n - 1);
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
