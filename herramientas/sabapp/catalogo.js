// Catálogo para «Agregar producto» de SabAPP (David, 23/11/2026: «quiero agregar un producto del catálogo yo como vendedor al pedido,
// no de los que ya me pidió el comprador, sino poder buscarlo por código y agregarlo»).
// Arma sabapp/catalogo.json con cada producto que se ve en la carta del Emporio y sus formas de venta (unidad, paquete, bandeja, caja,
// bolsa, ¼ kg, saco…), con el precio de 1 y los precios por mayor, calculados como la carta (lector y cálculos del editor del catálogo).
// Se arma solo en cada publicación (GitHub Actions, «Publicar sitio») y al correr herramientas/sabapp/construir.js. No va en git.
// Uso: node herramientas/sabapp/catalogo.js
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const C = require('../editor/cambios.js'), P = require('../editor/planilla.js');
const html = fs.readFileSync(path.join(RAIZ, 'carta', 'index.html'), 'utf8');
const datos = C.leerCatalogo(html), k = P.calculos(datos);
const objeto = (nombre) => { const m = html.match(new RegExp('const ' + nombre + '=(\\{[^\\n]*?\\});')); if (!m) throw new Error('No se encontró ' + nombre); return JSON.parse(m[1]); };
const COD_MY = objeto('COD_MYPYME'), COD_ET = objeto('COD_ETIQ'), ALI_COD = objeto('ALI_COD');
const codMy = (c) => Object.prototype.hasOwnProperty.call(COD_MY, c) ? COD_MY[c] : c;
const redondear = k.redondear, MINP = k.MINP;

// Formas de venta de los huevos (como FORMATOS en la carta)
const HUEVO = [['U', 'Unidad', 1], ['F6', 'Media docena', 6], ['F12', 'Docena', 12], ['F15', '15 huevos', 15], ['F30', 'Bandeja de 30', 30], ['F180', 'Caja de 180', 180]];
const FORMATOS = { huevo: HUEVO, huevoGrande: HUEVO.slice(0, 4).concat([['F20', 'Bandeja de 20', 20], ['F100', 'Caja de 100', 100]]), huevoTercera: HUEVO.filter((f) => f[0] !== 'F180') };
const bolsaNombre = (p, g) => p.porcion ? ({ 250: '¼ kg', 500: '½ kg', 1000: '1 kg' }[g] || `${g} g`) : g >= 20000 ? `Saco de ${g / 1000} kg`
  : g >= 1000 ? (g === 1000 ? 'Bolsa de 1 kg' : `Bolsa de ${String(g / 1000).replace('.', ',')} kg`) : `Bolsa de ${g} g`;
const pieza = (t) => t && t.cat === 'Blondas' ? 'blonda' : 'tapa';
const sinTapa = (n) => { const s = n.replace(/^(tapas?|blondas?)\s+(para\s+)?/i, ''); return s ? s[0].toUpperCase() + s.slice(1) : n; };

// Alimento para aves: la carta los agrega como productos al abrirse (ver ALIMENTOS y ALI_COD en carta/index.html)
const alimentos = (datos.alimentos || []).map((a) => {
  const cod = ALI_COD[a.n] || 'ALI-' + a.n.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  const nombre = a.msj ? a.msj[0].toUpperCase() + a.msj.slice(1) : a.n, kg = +((String(a.d).match(/(\d+) kg/) || [])[1] || 0);
  if (a.k != null) return { cod, cat: a.g, nombre, detalle: 'Precio por kilo', precio: a.k, bolsas: kg ? [[1000, a.k], [kg * 1000, a.p]] : [[1000, a.k]], alimento: true };
  const tramos = []; String(a.m || '').replace(/desde (\d+)(?: sacos?)?: \$([\d.]+)/gi, (x, d, pr) => { tramos.push([+d, +pr.replace(/\./g, '')]); });
  return { cod, cat: a.g, nombre, detalle: 'Precio por ' + String(a.d).toLowerCase(), precio: a.p, tramos, uni: 'saco', alimento: true };
});
const esPieza = (p) => p.cat === 'Tapas' || p.cat === 'Blondas';
const vivos = datos.productos.concat(alimentos).filter((p) => !esPieza(p) && !p.retirado && !p.porLlegar && !/^PROMO-/.test(p.cod));
const cal = datos.calHuevo || {}, lista = datos.listaHuevos || {}, ofertas = datos.ofertasFormato || {}, tramosCaja = datos.tramosCaja || [1];

const productos = vivos.map((p) => {
  const t = k.tapaDe(p);
  const nom = t ? (new RegExp('con ' + pieza(t), 'i').test(p.nombre) ? `${p.nombre} (${sinTapa(t.nombre).toLowerCase()})` : `${p.nombre} con ${pieza(t)} (${sinTapa(t.nombre).toLowerCase()})`) : p.nombre;
  const tapa = t ? { c: t.cod, m: codMy(t.cod), n: t.nombre } : undefined;
  const ops = [];
  // tramos por mayor que bajan el precio (sin repetir un precio igual al del tramo anterior)
  const may = (base, esc) => { let ant = base; return esc.filter((e) => { const ok = e[1] != null && (ant == null || e[1] < ant); if (ok) ant = e[1]; return ok; }); };
  if (FORMATOS[p.formatos] || Array.isArray(p.bolsas)) {
    const fmts = FORMATOS[p.formatos] || p.bolsas.map((b) => ['Fb' + b[0], bolsaNombre(p, b[0]), b[0]]);
    const b = k.precioBase(p);
    fmts.forEach(([fid, nombre, n]) => {
      if (fid === 'U') { ops.push({ f: 'U', t: 'Unidad', n: nom, u: 1, p: b == null ? null : b, may: may(b, k.escalones(p).map((e) => [e.desde, e.precio])) }); return; }
      const of = (ofertas[p.cod] || {})[fid];
      let pr, esc = [];
      if (p.bolsas) pr = (p.bolsas.find((x) => 'Fb' + x[0] === fid) || [])[1];
      else {
        const v = (lista[cal[p.cod]] || {})[fid];
        if (Array.isArray(v)) { pr = v[0]; esc = tramosCaja.slice(1).map((d, i) => [d, v[i + 1]]); } else pr = v;
        if (pr == null && b != null) pr = redondear(b * n);
      }
      if (of != null) { pr = of; esc = []; }
      ops.push({ f: fid, t: nombre, n: `${nom} · ${nombre.toLowerCase()}${p.bolsas ? '' : ` (${n} u)`}`, u: p.bolsas ? n / 1000 : n, kg: p.bolsas ? 1 : undefined, p: pr == null ? null : pr, may: may(pr, esc) });
    });
  } else {
    const b = k.precioBase(p);
    if (k.tienePaq(p)) {
      ops.push({ f: 'U', t: 'Unidad', n: nom, u: 1, p: b, may: [], tapa });
      const pq = k.precioPaq(p, 1), pqm = k.precioPaq(p, MINP);
      ops.push({ f: 'P', t: `Paquete de ${p.upp} u`, n: `${nom} · paquete de ${p.upp} u`, u: p.upp, p: pq, may: pqm != null && pq != null && pqm < pq ? [[MINP, pqm]] : [], tapa });
    } else {
      const d = (p.detalle || '').replace(/^Precio por /i, '');
      ops.push({ f: 'U', t: d ? d[0].toUpperCase() + d.slice(1) : 'Unidad', n: nom, u: 1, p: b, may: may(b, k.escalones(p).map((e) => [e.desde, e.precio])), tapa });
    }
  }
  const o = { c: p.cod, m: codMy(p.cod), n: p.nombre, s: p.cat, o: ops };
  if (COD_ET[p.cod]) o.e = COD_ET[p.cod];
  if (p.sinStock) o.a = 1;
  return o;
}).filter((x) => x.o.length);
const salida = { generado: new Date().toISOString(), productos };
fs.writeFileSync(path.join(RAIZ, 'sabapp', 'catalogo.json'), JSON.stringify(salida));
console.log('sabapp/catalogo.json listo: ' + productos.length + ' productos, ' + productos.reduce((a, x) => a + x.o.length, 0) + ' formas de venta');
