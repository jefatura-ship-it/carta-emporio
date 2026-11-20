/* Editor del Catálogo Sabroso — planilla Excel de actualización masiva de precios (navegador y Node).
   filasPrecios(datos, ref)          → una fila por producto y formato de venta (unidad, paquete, kilo, bolsa, bandeja, caja…)
   crearXlsx(filas, opciones)        → bytes del .xlsx (Uint8Array), con la hoja «Precios» y la hoja «Cómo usar»
   leerXlsx(bytes)                   → Promise con las filas leídas de la hoja «Precios» ({clave, nuevo, mayorNuevo, fila})
   compararPlanilla(datos, leidas)   → {cambios, avisos, iguales}: solo lo que cambia respecto del catálogo actual
   aplicarEnEstado(estado, cambios)  → aplica esos cambios al estado del editor (después se descargan como siempre)
   La columna «Clave» identifica qué precio es cada fila: P|código|precio, P|código|pq (paquete), P|código|b250 (bolsa
   de 250 g), H|calibre|F30 o H|calibre|F180.0 (huevos), A|nombre|p (alimentos), R|código|precio (promos). Un cuarto
   trozo opcional (u50, p100, kg, rollo) es el formato de venta que toma el producto cuando se le pone precio.
   Este archivo no se publica en la web (herramientas/ queda fuera del despliegue). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.PlanillaPrecios = fabrica();
})(this, function () {
  'use strict';

  var HOJA = 'Precios';
  var COLUMNAS = [
    ['seccion', 'Sección', 24], ['cod', 'Código carta', 11], ['codMy', 'Código MyPyme', 11], ['producto', 'Producto', 40],
    ['formato', 'Formato de venta', 34], ['actual', 'Precio actual', 12], ['planilla', 'Precio planilla (7)', 12],
    ['nuevo', 'Precio nuevo ✎', 13], ['mayorDesde', 'Por mayor desde', 12], ['mayorActual', 'Por mayor actual', 12],
    ['mayorNuevo', 'Por mayor nuevo ✎', 13], ['nota', 'Notas', 60], ['clave', 'Clave (no tocar)', 24]
  ];
  var NOMBRE_CAL = { superJumbo: 'Huevo súper jumbo', jumbo: 'Huevo jumbo', super: 'Huevo súper', extra: 'Huevo extra', primera: 'Huevo primera', segunda: 'Huevo segunda', tercera: 'Huevo tercera', quintaJumbo: 'Huevo quinta jumbo' };
  var NOMBRE_FMT = { F20: 'Bandeja de 20', F30: 'Bandeja de 30', F100: 'Caja de 100', F180: 'Caja de 180' };
  var FORMATO_PISTA = { kg: { detalle: 'Precio por kilo' }, rollo: { detalle: 'Precio por rollo' }, u: { detalle: 'Precio por unidad' } };

  function clp(n) { return n === null || n === undefined || n === '' ? 'sin precio' : '$' + Math.round(n).toLocaleString('es-CL'); }
  function pista(cod) { // u50 → por unidad, paquete de 50; p100 → por paquete de 100; kg; rollo; u
    if (!cod) return null; if (FORMATO_PISTA[cod]) return { detalle: FORMATO_PISTA[cod].detalle, upp: null };
    var m = String(cod).match(/^([up])(\d+)$/); if (!m) return null;
    return m[1] === 'u' ? { detalle: 'Precio por unidad · paquete de ' + m[2] + ' u', upp: +m[2] } : { detalle: 'Precio por paquete de ' + m[2] + ' u', upp: null };
  }

  /* ---------- Precios como los calcula la carta (carta/index.html) ---------- */
  function calculos(datos) {
    var M = datos.mayor || { dctos: [0, 0], sinPaquete: [10, 50], paquetes: 3 };
    var DPAQ = M.dctos[0], DMAY = M.dctos[1], MINP = M.paquetes || 3;
    var tapasDe = {};
    datos.productos.forEach(function (t) { if (t.retirado) return; (t.envase || []).forEach(function (c) { (tapasDe[c] = tapasDe[c] || []).push(t); }); });
    var k = {};
    k.redondear = function (n) { return n >= 100 ? Math.round(n / 10) * 10 : Math.round(n); };
    k.tapaDe = function (p) { var ts = tapasDe[p.cod]; return ts ? ts[0] : null; };
    k.precioDe = function (p) { return p.oferta != null ? p.oferta : p.precio; };
    k.precioBase = function (p) { var t = k.tapaDe(p), b = k.precioDe(p); if (!t) return b; return b == null || t.precio == null ? null : b + k.precioDe(t); };
    k.porUnidad = function (p) { return /por unidad/i.test(p.detalle || ''); };
    k.tienePaq = function (p) { return p.upp > 1 && k.porUnidad(p); };
    k.soloPaq = function (p) { return /por paquete/i.test(p.detalle || '') && !k.porUnidad(p); };
    k.tapaCobra = function (p) { var t = k.tapaDe(p); return !!t && (k.precioDe(t) || 0) > 0; }; // las tapas y blondas de $0 van incluidas
    k.pmDe = function (p) { return datos.mayor && p.pm != null && p.oferta == null && !k.tapaCobra(p) ? p.pm : null; };
    k.precioPaq = function (p, n) {
      if (!k.tienePaq(p)) return null;
      var b = k.precioBase(p), pq = p.pq != null && p.oferta == null && !k.tapaCobra(p) ? p.pq : null;
      var normal = pq != null ? pq : b == null ? null : k.redondear(b * p.upp * (1 - DPAQ / 100));
      if (normal == null || n < MINP) return normal;
      var pm = k.pmDe(p); if (pm != null) return Math.min(pm, normal);
      return pq != null ? k.redondear(pq * (100 - DMAY) / (100 - DPAQ)) : k.redondear(b * p.upp * (1 - DMAY / 100));
    };
    k.escalones = function (p) {
      var base = k.precioBase(p);
      if (!datos.mayor || base == null || p.oferta != null || k.tienePaq(p)) return [];
      if (Array.isArray(p.tramos)) return p.tramos.map(function (t) { return { desde: t[0], precio: t[1] }; }).filter(function (e) { return e.precio < base; });
      var pm = k.pmDe(p); if (pm != null) return pm < base ? [{ desde: k.soloPaq(p) ? MINP : M.sinPaquete[0], precio: pm }] : [];
      if (!k.porUnidad(p)) return [];
      return M.sinPaquete.map(function (d, i) { return { desde: d, precio: k.redondear(base * (1 - M.dctos[i] / 100)) }; }).filter(function (e) { return e.precio < base; });
    };
    k.M = M; k.MINP = MINP; k.DPAQ = DPAQ; k.DMAY = DMAY;
    return k;
  }

  function medida(p, k) {
    var d = p.detalle || '', m;
    if (k.tienePaq(p)) return 'Unidad (viene en paquete de ' + p.upp + ' u)';
    if ((m = d.match(/por paquete de (\d+) u/i))) return 'Paquete de ' + m[1] + ' u';
    if (/por paquete/i.test(d)) return 'Paquete';
    if (/por kilo/i.test(d)) return 'Kilo';
    if (/por unidad/i.test(d)) return 'Unidad';
    m = d.match(/^Precio por (.+)$/i); return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : (d || 'Unidad');
  }
  function unidadesMayor(p, k) {
    if (k.tienePaq(p) || k.soloPaq(p)) return k.MINP + ' paquetes';
    if (/por kilo/i.test(p.detalle || '')) return k.M.sinPaquete[0] + ' kg';
    var m = (p.detalle || '').match(/^Precio por (\w+)/i);
    if (m && !/unidad/i.test(m[1])) return k.M.sinPaquete[0] + ' ' + m[1].toLowerCase() + (/[aeiou]$/i.test(m[1]) ? 's' : 'es');
    return k.M.sinPaquete[0] + ' u';
  }
  function gramos(g) { return g >= 1000 ? (g === 1000 ? '1 kg' : String(g / 1000).replace('.', ',') + ' kg') : g + ' g'; }

  /* ---------- Filas de la planilla ---------- */
  function filasPrecios(datos, ref) {
    ref = ref || {}; var R = ref.productos || {}, k = calculos(datos), filas = [];
    var vivos = datos.productos.filter(function (p) { return !p.retirado && !p.porLlegar; }); // los por llegar van en la hoja «Productos nuevos»
    var esPieza = function (p) { return p.cat === 'Tapas' || p.cat === 'Blondas'; };
    var cal = datos.calHuevo || {};
    var fila = function (o) { o.clave = o.clave || ''; filas.push(o); return o; };
    var extra = function (cod) { return R[cod] || {}; };
    var notas = function () { return [].slice.call(arguments).filter(Boolean).join(' · '); };

    // 1) Huevos por bandeja y caja (tabla de la carta, por calibre) y el huevo suelto de cada producto
    Object.keys(datos.listaHuevos || {}).forEach(function (c) {
      var prods = vivos.filter(function (p) { return cal[p.cod] === c; });
      var colores = prods.map(function (p) { return /blanc/i.test(p.nombre) ? 'blanco' : /caf|color/i.test(p.nombre) ? 'café' : ''; }).filter(Boolean);
      var nombre = (NOMBRE_CAL[c] || c) + (colores.length ? ' (' + colores.join(' y ') + ')' : '');
      var cods = prods.map(function (p) { return p.cod; }).join(' · ');
      var codsMy = prods.map(function (p) { return extra(p.cod).codMy; }).filter(Boolean).join(' · ');
      var tabla = datos.listaHuevos[c], tr = datos.tramosCaja || [1];
      Object.keys(tabla).forEach(function (fid) {
        var v = tabla[fid];
        if (Array.isArray(v)) v.forEach(function (x, i) {
          var rango = i === tr.length - 1 ? tr[i] + ' cajas o más' : tr[i] + ' a ' + (tr[i + 1] - 1) + ' cajas';
          fila({ seccion: 'Huevos por bandeja y caja', cod: cods, codMy: codsMy, producto: nombre, formato: (NOMBRE_FMT[fid] || fid) + ' · ' + rango, actual: x, clave: 'H|' + c + '|' + fid + '.' + i,
            nota: i === 0 ? 'Precio de 1 caja; los tramos siguientes son el precio por caja al llevar más. «-» = sin precio en ese tramo.' : '' });
        });
        else fila({ seccion: 'Huevos por bandeja y caja', cod: cods, codMy: codsMy, producto: nombre, formato: NOMBRE_FMT[fid] || fid, actual: v, clave: 'H|' + c + '|' + fid });
      });
      prods.forEach(function (p) {
        fila({ seccion: 'Huevos por bandeja y caja', cod: p.cod, codMy: extra(p.cod).codMy, producto: p.nombre, formato: 'Huevo suelto (precio c/u)', actual: p.precio, clave: 'P|' + p.cod + '|precio',
          nota: 'La unidad, media docena, docena y 15 huevos se calculan con este precio por huevo.' });
      });
    });

    // 2) Productos de la carta, en el orden de la carta
    vivos.filter(function (p) { return !esPieza(p) && !(p.formatos && cal[p.cod]); }).forEach(function (p) {
      var x = extra(p.cod), t0 = k.tapaDe(p), t = k.tapaCobra(p) ? t0 : null, base = { seccion: p.cat, cod: p.cod, codMy: x.codMy, producto: p.nombre };
      var conTapa = t ? 'En la carta se cobra con su ' + (t.cat === 'Blondas' ? 'blonda' : 'tapa') + ' (' + t.cod + ' ' + clp(k.precioDe(t)) + '): ' + clp(k.precioBase(p)) + ' c/u' : '';
      var oferta = p.oferta != null ? 'En oferta a ' + clp(p.oferta) + ' (el por mayor no corre con oferta)' : '';
      if (Array.isArray(p.bolsas) && p.bolsas.length) {
        fila(Object.assign({}, base, { formato: 'Kilo (referencia)', actual: p.precio, planilla: x.planilla, clave: 'P|' + p.cod + '|precio',
          nota: notas('Se vende en bolsas: cada bolsa tiene su propio precio (cambiar el kilo no cambia las bolsas).', x.nota) }));
        p.bolsas.forEach(function (b) {
          fila(Object.assign({}, base, { formato: 'Bolsa de ' + gramos(b[0]), actual: b[1], planilla: (x.bolsas || {})[b[0]], clave: 'P|' + p.cod + '|b' + b[0] }));
        });
        return;
      }
      if (k.tienePaq(p)) {
        fila(Object.assign({}, base, { formato: medida(p, k), actual: p.precio, planilla: x.planilla, clave: 'P|' + p.cod + '|precio' + (x.pista ? '|' + x.pista : ''),
          nota: notas(conTapa, oferta, 'Precio por unidad suelta; el por mayor va en el paquete.', x.nota) }));
        var editable = !t && p.oferta == null;
        fila(Object.assign({}, base, { formato: 'Paquete de ' + p.upp + ' u', actual: k.precioPaq(p, 1), planilla: x.planillaPaq,
          mayorDesde: k.MINP + ' paquetes', mayorActual: k.precioPaq(p, k.MINP), mayorEditable: editable, editable: editable, clave: 'P|' + p.cod + '|pq',
          nota: editable ? notas(p.pq == null ? 'Hoy se calcula solo: ' + p.upp + ' × precio unitario − ' + k.DPAQ + ' %. Si escribes un precio, queda fijo.' : 'Precio fijo del paquete.', p.pm == null ? 'Por mayor automático: −' + k.DMAY + ' % desde ' + k.MINP + ' paquetes.' : '', x.notaPaq)
            : notas(conTapa ? 'Se calcula solo con el precio del envase y de su tapa: cambia el precio por unidad.' : oferta, 'No se puede fijar aquí.') }));
        return;
      }
      // tramos propios: con un solo tramo (ej. desde 20 u) el «Por mayor nuevo» cambia su precio; [] = precio fijo; con varios tramos se cambia pidiéndoselo a Claude
      var tr = Array.isArray(p.tramos) ? p.tramos : null, uniT = k.soloPaq(p) ? ' paquetes' : p.uni ? ' ' + p.uni + 's' : ' u';
      var esc = k.escalones(p), mayorEd = !t && p.oferta == null && !!datos.mayor && (!tr || tr.length === 1);
      if (tr) x = Object.assign({}, x, { nota: notas(!tr.length ? 'Precio fijo: sin precio por mayor.' : tr.length === 1 ? 'Por mayor propio desde ' + tr[0][0] + uniT + ' («-» lo quita y vuelve el automático).' : 'Por mayor por tramos: ' + tr.map(function (e) { return clp(e[1]) + ' desde ' + e[0]; }).join(' y ') + ' (se cambia pidiéndoselo a Claude).', x.nota) });
      var auto = !p.pm && esc.length > 1 && !tr ? 'Por mayor automático: ' + esc.map(function (e) { return clp(e.precio) + ' desde ' + e.desde + ' u'; }).join(' y ') + '. Si escribes un precio, queda ese desde ' + esc[0].desde + ' u.' : '';
      fila(Object.assign({}, base, { formato: medida(p, k), actual: p.precio, planilla: x.planilla, clave: 'P|' + p.cod + '|precio' + (x.pista ? '|' + x.pista : ''),
        mayorDesde: tr ? (tr.length ? tr[0][0] + uniT : '') : mayorEd || esc.length ? unidadesMayor(p, k) : '', mayorActual: tr ? (tr.length ? tr[0][1] : null) : esc.length ? esc[0].precio : null, mayorEditable: mayorEd && !(tr && !tr.length),
        nota: notas(conTapa, oferta, auto, x.nota) }));
    });

    // 3) Tapas y blondas: no se venden solas, su precio se suma al envase o a la bandeja
    vivos.filter(esPieza).forEach(function (p) {
      var x = extra(p.cod), donde = (p.envase || []).join(', ');
      fila({ seccion: p.cat === 'Tapas' ? 'Tapas (se cobran con su envase)' : 'Blondas (se cobran con su bandeja)', cod: p.cod, codMy: x.codMy, producto: p.nombre,
        formato: 'Unidad (se suma al ' + (p.cat === 'Tapas' ? 'envase' : 'precio de la bandeja') + ')', actual: p.precio, planilla: x.planilla, clave: 'P|' + p.cod + '|precio',
        nota: notas(donde ? 'Va con: ' + donde : 'No tiene envase asignado: no se muestra.', x.nota) });
    });

    // 4) Alimento para aves (se pide por WhatsApp a la Distribuidora o a Ventas Avícola)
    (datos.alimentos || []).forEach(function (a) {
      var x = (ref.alimentos || {})[a.n] || {};
      fila({ seccion: 'Alimento para aves (en el menú y por WhatsApp)', cod: '', codMy: x.codMy, producto: a.n, formato: a.d || 'Saco', actual: a.p, planilla: x.planilla, clave: 'A|' + a.n + '|p',
        nota: a.m ? 'Tramos (texto fijo en la carta, no cambia con esta planilla): ' + a.m : '' });
      if (a.k != null) fila({ seccion: 'Alimento para aves (en el menú y por WhatsApp)', cod: '', producto: a.n, formato: 'Kilo', actual: a.k, clave: 'A|' + a.n + '|k' });
    });

    // 5) Promos
    (datos.promos || []).forEach(function (p) {
      fila({ seccion: 'Promos', cod: p.cod, producto: p.nombre, formato: 'Promo', actual: p.precio, clave: 'R|' + p.cod + '|precio' });
    });
    filas.forEach(function (f) { if (f.editable === undefined) f.editable = true; if (!f.mayorEditable) f.mayorEditable = false; });
    return filas;
  }

  /* ---------- ZIP (sin compresión al escribir; al leer, también comprimido como lo guarda Excel) ---------- */
  var TABLA_CRC = null;
  function crc32(u8) {
    if (!TABLA_CRC) { TABLA_CRC = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABLA_CRC[n] = c >>> 0; } }
    var r = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) r = TABLA_CRC[(r ^ u8[i]) & 0xFF] ^ (r >>> 8);
    return (r ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(archivos) {
    var enc = new TextEncoder(), partes = [], central = [], pos = 0, ahora = new Date();
    var fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate(), hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5);
    archivos.forEach(function (a) {
      var nom = enc.encode(a.nombre), dat = typeof a.datos === 'string' ? enc.encode(a.datos) : a.datos, crc = crc32(dat);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, hora, true); h.setUint16(12, fecha, true);
      h.setUint32(14, crc, true); h.setUint32(18, dat.length, true); h.setUint32(22, dat.length, true); h.setUint16(26, nom.length, true); h.setUint16(28, 0, true);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, hora, true); c.setUint16(14, fecha, true);
      c.setUint32(16, crc, true); c.setUint32(20, dat.length, true); c.setUint32(24, dat.length, true); c.setUint16(28, nom.length, true); c.setUint32(42, pos, true);
      partes.push(new Uint8Array(h.buffer), nom, dat); central.push(new Uint8Array(c.buffer), nom);
      pos += 30 + nom.length + dat.length;
    });
    var tamC = central.reduce(function (s, x) { return s + x.length; }, 0), fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true); fin.setUint32(12, tamC, true); fin.setUint32(16, pos, true);
    var todo = partes.concat(central, [new Uint8Array(fin.buffer)]), largo = todo.reduce(function (s, x) { return s + x.length; }, 0), out = new Uint8Array(largo), o = 0;
    todo.forEach(function (x) { out.set(x, o); o += x.length; });
    return out;
  }
  function unzip(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('El archivo no es un Excel (.xlsx).');
    var n = dv.getUint16(e + 10, true), off = dv.getUint32(e + 16, true), dec = new TextDecoder(), out = {};
    for (var i = 0; i < n; i++) {
      if (dv.getUint32(off, true) !== 0x02014b50) throw new Error('El Excel está dañado.');
      var metodo = dv.getUint16(off + 10, true), tam = dv.getUint32(off + 20, true), ln = dv.getUint16(off + 28, true), lx = dv.getUint16(off + 30, true), lc = dv.getUint16(off + 32, true), loc = dv.getUint32(off + 42, true);
      var nombre = dec.decode(u8.subarray(off + 46, off + 46 + ln)), ini = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true);
      out[nombre.replace(/^\//, '')] = { metodo: metodo, datos: u8.subarray(ini, ini + tam) };
      off += 46 + ln + lx + lc;
    }
    return out;
  }
  function inflar(e) {
    if (!e) return Promise.resolve(null);
    if (e.metodo === 0) return Promise.resolve(e.datos);
    if (e.metodo !== 8) return Promise.reject(new Error('El Excel usa una compresión que no conozco.'));
    if (typeof window === 'undefined' && typeof require === 'function') return Promise.resolve(new Uint8Array(require('zlib').inflateRawSync(e.datos)));
    var s = new Blob([e.datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  /* ---------- Escribir el .xlsx ---------- */
  function x(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function letra(n) { var s = ''; n++; while (n) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function celda(ref, v, s) {
    if (v === null || v === undefined || v === '') return '<c r="' + ref + '" s="' + s + '"/>';
    if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '" s="' + s + '"><v>' + v + '</v></c>';
    return '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + x(v) + '</t></is></c>';
  }
  // Estilos: 0 normal, 1 encabezado, 2 texto, 3 pesos, 4 pesos a rellenar (amarillo), 5 nota, 6 clave, 7 no aplica (gris), 8 título, 9 negrita, 10 texto largo, 11 pesos de referencia (gris claro), 12 texto a rellenar (amarillo)
  var ESTILOS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0"/></numFmts>'
    + '<fonts count="6"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><sz val="9"/><color rgb="FF7F7F7F"/><name val="Arial"/></font>'
    + '<font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FF1D5C36"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF595959"/><name val="Arial"/></font></fonts>'
    + '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D5C36"/><bgColor indexed="64"/></patternFill></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill></fills>'
    + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="13">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'
    + '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'
    + '<xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'
    + '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
    + '<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'
    + '<xf numFmtId="164" fontId="2" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'
    + '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
    + '<xf numFmtId="164" fontId="5" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'
    + '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'
    + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  var NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

  function hojaPrecios(filas) {
    var ultima = filas.length + 1, col = function (k) { for (var i = 0; i < COLUMNAS.length; i++) if (COLUMNAS[i][0] === k) return letra(i); };
    var filasXml = ['<row r="1" ht="30" customHeight="1">' + COLUMNAS.map(function (c, i) { return celda(letra(i) + '1', c[1], 1); }).join('') + '</row>'];
    filas.forEach(function (f, n) {
      var r = n + 2;
      filasXml.push('<row r="' + r + '">' + COLUMNAS.map(function (c, i) {
        var k = c[0], v = f[k], s = 2;
        if (k === 'actual' || k === 'mayorActual') s = 3;
        else if (k === 'planilla') s = 11;
        else if (k === 'nuevo') { s = f.editable ? 4 : 7; v = f.nuevoTexto || null; }
        else if (k === 'mayorNuevo') { s = f.mayorEditable ? 4 : 7; v = null; }
        else if (k === 'nota') s = 5;
        else if (k === 'clave') s = 6;
        else if (k === 'mayorDesde' && !v) s = 7;
        if ((k === 'mayorActual') && !f.mayorEditable && v == null) s = 7;
        return celda(letra(i) + r, v, s);
      }).join('') + '</row>');
    });
    var nuevo = col('nuevo'), mayor = col('mayorNuevo');
    var regla = function (c) { return '<dataValidation type="custom" allowBlank="1" showErrorMessage="1" errorTitle="Precio" error="Escribe el precio en pesos, sin puntos (ej.: 1990), o un guion «-» para dejarlo sin precio." sqref="' + c + '2:' + c + ultima + '"><formula1>OR(' + c + '2="-",AND(ISNUMBER(' + c + '2),' + c + '2&gt;=0))</formula1></dataValidation>'; };
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet ' + NS + '><sheetPr><tabColor rgb="FF1D5C36"/></sheetPr><dimension ref="A1:' + letra(COLUMNAS.length - 1) + ultima + '"/>'
      + '<sheetViews><sheetView tabSelected="1" zoomScaleNormal="100" workbookViewId="0"><pane xSplit="4" ySplit="1" topLeftCell="E2" activePane="bottomRight" state="frozen"/><selection pane="topRight"/><selection pane="bottomLeft"/><selection pane="bottomRight" activeCell="' + nuevo + '2" sqref="' + nuevo + '2"/></sheetView></sheetViews>'
      + '<sheetFormatPr defaultRowHeight="15"/><cols>' + COLUMNAS.map(function (c, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + c[2] + '" customWidth="1"/>'; }).join('') + '</cols>'
      + '<sheetData>' + filasXml.join('') + '</sheetData><autoFilter ref="A1:' + letra(COLUMNAS.length - 1) + ultima + '"/>'
      + '<dataValidations count="2">' + regla(nuevo) + regla(mayor) + '</dataValidations><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/></worksheet>';
  }
  function hojaTexto(lineas, anchos) { // lineas: [[texto, estilo], …] o [[[celdas…], estilo]]
    var filasXml = lineas.map(function (l, n) {
      var celdas = Array.isArray(l[0]) ? l[0] : [l[0]];
      return '<row r="' + (n + 1) + '">' + celdas.map(function (v, i) { return celda(letra(i) + (n + 1), v, Array.isArray(l[1]) ? l[1][i] : l[1]); }).join('') + '</row>';
    });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet ' + NS + '><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>'
      + (anchos || [110]).map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('')
      + '</cols><sheetData>' + filasXml.join('') + '</sheetData><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/></worksheet>';
  }
  /* ---------- Productos nuevos (también los que aún no llegan) ---------- */
  var HOJA_NUEVOS = 'Productos nuevos', FILAS_VACIAS = 40;
  var COMO = ['Por unidad', 'Por unidad y por paquete', 'Solo por paquete', 'Por kilo', 'Por rollo'];
  var COL_NUEVOS = [['seccion', 'Sección ✎', 26], ['producto', 'Producto ✎', 40], ['como', 'Cómo se vende ✎', 23], ['upp', 'Unidades del paquete ✎', 12],
    ['precio', 'Precio ✎', 12], ['mayor', 'Por mayor ✎', 12], ['llego', '¿Ya llegó? ✎', 11], ['codMy', 'Código MyPyme ✎', 13], ['nota', 'Notas', 54], ['clave', 'Clave (no tocar)', 16]];
  function plano(t) { return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function comoNormal(t) { // texto de «Cómo se vende» → u | paq | soloPaq | kg | rollo
    var s = plano(t); if (!s) return 'u';
    if (/kilo|\bkg\b/.test(s)) return 'kg'; if (/rollo/.test(s)) return 'rollo';
    if (/solo/.test(s) || (/paquete/.test(s) && !/unidad/.test(s))) return 'soloPaq';
    if (/paquete/.test(s)) return 'paq'; return 'u';
  }
  function detalleDe(como, upp) {
    return { u: 'Precio por unidad', paq: 'Precio por unidad · paquete de ' + upp + ' u', soloPaq: 'Precio por paquete de ' + upp + ' u', kg: 'Precio por kilo', rollo: 'Precio por rollo' }[como];
  }
  function comoDe(p) { // producto → [texto de «Cómo se vende», unidades del paquete]
    var d = p.detalle || '', m = d.match(/por paquete de (\d+)/i);
    if (/por unidad/i.test(d) && p.upp > 1) return [COMO[1], p.upp];
    if (m) return [COMO[2], +m[1]]; if (/por kilo/i.test(d)) return [COMO[3], null]; if (/por rollo/i.test(d)) return [COMO[4], null];
    return [COMO[0], null];
  }
  function seccionesDe(datos) {
    var r = []; datos.productos.forEach(function (p) { if (p.cat !== 'Tapas' && p.cat !== 'Blondas' && r.indexOf(p.cat) < 0) r.push(p.cat); });
    return r;
  }
  function usadosDe(datos) { var u = {}; datos.productos.forEach(function (p) { u[p.cod] = true; }); (datos.codigosAntes || []).forEach(function (c) { u[c] = true; }); return u; }
  function codigoNuevo(codMy, usados, avisos, donde) { // el código MyPyme si está libre; si no, NUE001, NUE002…
    var c = String(codMy == null ? '' : codMy).trim().toUpperCase();
    if (c && /^[A-Z0-9][A-Z0-9-]{2,19}$/.test(c) && !usados[c]) { usados[c] = true; return c; }
    if (c) avisos.push(donde + ': el código «' + c + '» ' + (usados[c] ? 'ya lo usa otro producto de la carta' : 'no sirve como código') + '; queda con un código NUE.');
    for (var n = 1; n < 1000; n++) { var k = 'NUE' + String(n).padStart(3, '0'); if (!usados[k]) { usados[k] = true; return k; } }
    return null;
  }
  /* Arma un producto desde una fila de «Productos nuevos» o del formulario del editor.
     fila: {seccion, producto, como, upp, precio, mayor, llego, codMy}; op: {cod (si ya existe), usados, secciones, donde} → {p, errores, avisos} */
  function crearProducto(fila, op) {
    op = op || {}; var errores = [], avisos = [], donde = op.donde || 'Producto nuevo';
    var nombre = String(fila.producto == null ? '' : fila.producto).replace(/\s+/g, ' ').trim();
    if (!nombre) errores.push('falta el nombre');
    var como = comoNormal(fila.como), upp = Math.round(Number(fila.upp) || 0);
    if ((como === 'paq' || como === 'soloPaq') && !(upp > 1)) errores.push('falta «Unidades del paquete» (más de 1)');
    var vp = valor(fila.precio), vm = valor(fila.mayor);
    if (vp.error) errores.push('«' + fila.precio + '» no es un precio'); if (vm.error) errores.push('«' + fila.mayor + '» no es un precio por mayor');
    var seccion = String(fila.seccion == null ? '' : fila.seccion).trim() || 'Otros';
    if (op.secciones && op.secciones.indexOf(seccion) < 0) avisos.push(donde + ': la sección «' + seccion + '» no existe en la carta; queda como página nueva dentro de «Otros» del menú.');
    if (errores.length) return { p: null, errores: errores, avisos: avisos };
    var cod = op.cod || codigoNuevo(fila.codMy, op.usados || {}, avisos, donde);
    var p = { cod: cod, cat: seccion, nombre: nombre, detalle: detalleDe(como, upp), precio: vp.n != null ? vp.n : null };
    if (como === 'paq') p.upp = upp;
    if (vm.n != null) p.pm = vm.n;
    if (!/^s[ií]/i.test(String(fila.llego == null ? '' : fila.llego).trim())) p.porLlegar = true; // en blanco o «No»: aún no llega (oculto)
    p.nuevo = true;
    return { p: p, errores: [], avisos: avisos };
  }
  function hojaNuevos(datos) {
    var porLlegar = datos.productos.filter(function (p) { return p.porLlegar && !p.retirado; });
    var n = porLlegar.length + FILAS_VACIAS, ultima = n + 2, L = function (k) { for (var i = 0; i < COL_NUEVOS.length; i++) if (COL_NUEVOS[i][0] === k) return letra(i); };
    var filas = ['<row r="1" ht="48" customHeight="1">' + celda('A1', 'Escribe aquí los productos nuevos, también los que aún no llegan, en las filas vacías de abajo. Con «¿Ya llegó?» en «No» o en blanco quedan cargados pero ocultos en la carta; cuando llegue el producto, cámbialo a «Sí» y vuelve a subir la planilla. El precio va por la medida de «Cómo se vende» (por unidad, kilo, rollo o paquete); en «Por unidad y por paquete» es el precio de 1 unidad. Los que ya cargaste y aún no llegan aparecen primero.', 10) + '</row>',
      '<row r="2" ht="30" customHeight="1">' + COL_NUEVOS.map(function (c, i) { return celda(letra(i) + '2', c[1], 1); }).join('') + '</row>'];
    porLlegar.forEach(function (p, j) {
      var r = j + 3, cm = comoDe(p);
      var v = { seccion: p.cat, producto: p.nombre, como: cm[0], upp: cm[1], precio: p.precio, mayor: p.pm, llego: 'No', codMy: p.cod, nota: 'Ya cargado, oculto en la carta hasta que llegue (código ' + p.cod + ').', clave: 'N|' + p.cod };
      filas.push('<row r="' + r + '">' + COL_NUEVOS.map(function (c, i) {
        var k = c[0], s = k === 'precio' || k === 'mayor' ? 4 : k === 'nota' ? 5 : k === 'clave' ? 6 : k === 'codMy' ? 7 : 12;
        return celda(letra(i) + r, k === 'codMy' ? p.cod : v[k], s);
      }).join('') + '</row>');
    });
    for (var j = porLlegar.length; j < n; j++) {
      var r = j + 3;
      filas.push('<row r="' + r + '">' + COL_NUEVOS.map(function (c, i) { var k = c[0]; return celda(letra(i) + r, k === 'clave' ? 'N|nuevo' : null, k === 'precio' || k === 'mayor' ? 4 : k === 'nota' ? 5 : k === 'clave' ? 6 : 12); }).join('') + '</row>');
    }
    var nSec = seccionesDe(datos).length, rango = function (k) { return L(k) + '3:' + L(k) + ultima; };
    var lista = function (k, f, titulo, error) { return '<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="' + x(titulo) + '" error="' + x(error) + '" sqref="' + rango(k) + '"><formula1>' + x(f) + '</formula1></dataValidation>'; };
    var numero = function (k) { var c = L(k); return '<dataValidation type="custom" allowBlank="1" showErrorMessage="1" errorTitle="Número" error="Escribe un número sin puntos (ej.: 1990)." sqref="' + rango(k) + '"><formula1>AND(ISNUMBER(' + c + '3),' + c + '3&gt;=0)</formula1></dataValidation>'; };
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet ' + NS + '><sheetPr><tabColor rgb="FFE8A33D"/></sheetPr><dimension ref="A1:' + letra(COL_NUEVOS.length - 1) + ultima + '"/>'
      + '<sheetViews><sheetView zoomScaleNormal="100" workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A' + (porLlegar.length + 3) + '" sqref="A' + (porLlegar.length + 3) + '"/></sheetView></sheetViews>'
      + '<sheetFormatPr defaultRowHeight="15"/><cols>' + COL_NUEVOS.map(function (c, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + c[2] + '" customWidth="1"/>'; }).join('') + '</cols>'
      + '<sheetData>' + filas.join('') + '</sheetData><mergeCells count="1"><mergeCell ref="A1:' + letra(COL_NUEVOS.length - 1) + '1"/></mergeCells>'
      + '<dataValidations count="6">' + lista('seccion', 'Listas!$A$1:$A$' + Math.max(1, nSec), 'Sección', 'Elige una sección de la lista.') + lista('como', '"' + COMO.join(',') + '"', 'Cómo se vende', 'Elige una opción de la lista.')
      + lista('llego', '"Sí,No"', '¿Ya llegó?', 'Elige Sí o No.') + numero('upp') + numero('precio') + numero('mayor') + '</dataValidations>'
      + '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/></worksheet>';
  }
  function hojaListas(datos) { return hojaTexto(seccionesDe(datos).map(function (s) { return [s, 0]; }), [40]); }

  function instrucciones(op) {
    var L = [['Actualización masiva de precios — Catálogo Emporio Sabroso', 8], ['Generada el ' + (op.fecha || new Date().toLocaleString('es-CL')) + (op.origen ? ' · ' + op.origen : ''), 10], ['', 10],
      ['Qué rellenar', 9],
      ['En la hoja «Precios» escribe solo en las columnas amarillas: «Precio nuevo ✎» y «Por mayor nuevo ✎». Lo que dejes en blanco no cambia. Las celdas grises no se pueden fijar desde aquí.', 10],
      ['Cada fila es un formato de venta: el precio va por esa medida (unidad, paquete de 50 u, kilo, bolsa de 250 g, bandeja de 30, caja de 180…). Escribe pesos sin puntos ni signo (1990). Un guion «-» deja el precio «por confirmar» (o quita el precio por mayor fijo).', 10],
      ['«Por mayor nuevo» fija el precio por mayor desde la cantidad de «Por mayor desde» (10 u, 10 kg o 10 paquetes). Si lo dejas en blanco, sigue el cálculo automático de la carta.', 10],
      ['«Precio planilla (7)» es el precio de venta de la planilla de inventario, solo como referencia. «Precio actual» es el que tiene hoy la carta.', 10],
      ['No cambies la columna «Clave (no tocar)»: con ella el editor sabe qué precio es cada fila. Puedes ordenar, filtrar u ocultar filas y columnas.', 10], ['', 10],
      ['Productos nuevos (hoja «Productos nuevos»)', 9],
      ['Para agregar un producto a la carta, también uno que aún no llega, llena una fila vacía: sección, nombre, cómo se vende (por unidad, por unidad y por paquete, solo por paquete, por kilo o por rollo), unidades del paquete si corresponde, precio (puede quedar en blanco = «por confirmar») y, si quieres, el precio por mayor y el código de MyPyme.', 10],
      ['«¿Ya llegó?» en «No» o en blanco: el producto queda cargado pero oculto en la carta. Cuando llegue, cámbialo a «Sí» (en la fila del producto, que aparece al principio de esa hoja) y vuelve a subir la planilla: desde ese momento se ve y se puede pedir, y su precio pasa a la hoja «Precios».', 10], ['', 10],
      ['Ejemplo de una fila rellenada', 9],
      [['Código carta', 'Producto', 'Formato de venta', 'Precio actual', 'Precio nuevo ✎', 'Por mayor desde', 'Por mayor nuevo ✎'], [1, 1, 1, 1, 1, 1, 1]],
      [['BOL003', 'Bolsa camiseta 32 × 40', 'Unidad (viene en paquete de 100 u)', 10, 12, '', ''], [2, 2, 2, 3, 4, 7, 7]],
      [['BOL003', 'Bolsa camiseta 32 × 40', 'Paquete de 100 u', 950, 1090, '10 paquetes', 990], [2, 2, 2, 3, 4, 2, 4]], ['', 10],
      ['Cómo se sube', 9],
      ['1. Abre el editor con «Abrir editor del catálogo» y entra a la pestaña «Precios por Excel».', 10],
      ['2. Toca «Subir planilla rellenada» y elige este archivo. El editor muestra cada precio que cambia (antes → después) y avisa lo que no pudo leer.', 10],
      ['3. Toca «Aplicar al borrador», revisa la vista y descarga los cambios en «Enviar a Claude». Claude los aplica, los prueba y te pide el sí antes de publicar.', 10],
      ['Puedes volver a subir la misma planilla cuantas veces quieras: solo cuenta lo que sea distinto de la carta en ese momento.', 10]];
    return hojaTexto(L, op.anchos || [26, 34, 36, 14, 15, 15, 17]);
  }

  function crearXlsx(filas, op) {
    op = op || {};
    var hojas = [{ nombre: HOJA, xml: hojaPrecios(filas) }].concat(op.datos ? [{ nombre: HOJA_NUEVOS, xml: hojaNuevos(op.datos) }] : [], [{ nombre: 'Cómo usar', xml: instrucciones(op) }], op.hojasExtra || [],
      op.datos ? [{ nombre: 'Listas', xml: hojaListas(op.datos), oculta: true }] : []);
    var archivos = [
      { nombre: '[Content_Types].xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + hojas.map(function (h, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('')
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { nombre: '_rels/.rels', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { nombre: 'xl/workbook.xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook ' + NS + '><bookViews><workbookView activeTab="0"/></bookViews><sheets>'
        + hojas.map(function (h, i) { return '<sheet name="' + x(h.nombre) + '" sheetId="' + (i + 1) + '"' + (h.oculta ? ' state="hidden"' : '') + ' r:id="rId' + (i + 1) + '"/>'; }).join('')
        + '</sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">' + HOJA + '!$A$1:$' + letra(COLUMNAS.length - 1) + '$' + (filas.length + 1) + '</definedName></definedNames></workbook>' },
      { nombre: 'xl/_rels/workbook.xml.rels', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + hojas.map(function (h, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('')
        + '<Relationship Id="rId' + (hojas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { nombre: 'xl/styles.xml', datos: ESTILOS }
    ].concat(hojas.map(function (h, i) { return { nombre: 'xl/worksheets/sheet' + (i + 1) + '.xml', datos: h.xml }; }));
    return zip(archivos);
  }

  /* ---------- Leer el .xlsx que devuelve David ---------- */
  function desXml(t) { return t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }).replace(/&#x([0-9a-f]+);/gi, function (m, n) { return String.fromCharCode(parseInt(n, 16)); }).replace(/&amp;/g, '&'); }
  function textos(xml) { var r = '', m, re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g; while ((m = re.exec(xml))) r += desXml(m[1]); return r; }
  function leerXlsx(bytes) {
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), z;
    try { z = unzip(u8); } catch (e) { return Promise.reject(e); }
    var dec = new TextDecoder(), leer = function (n) { return inflar(z[n]).then(function (b) { return b ? dec.decode(b) : null; }); };
    return Promise.all([leer('xl/workbook.xml'), leer('xl/_rels/workbook.xml.rels'), leer('xl/sharedStrings.xml')]).then(function (r) {
      if (!r[0]) throw new Error('El archivo no es un Excel (.xlsx).');
      var hojas = [], m, re = /<sheet\b([^>]*)\/?>/g;
      while ((m = re.exec(r[0]))) { var nom = (m[1].match(/name="([^"]*)"/) || [])[1], id = (m[1].match(/r:id="([^"]*)"/) || [])[1]; hojas.push({ nombre: desXml(nom || ''), id: id }); }
      var comp = []; if (r[2]) { var re2 = /<si>([\s\S]*?)<\/si>/g, s; while ((s = re2.exec(r[2]))) comp.push(textos(s[1])); }
      var leerHoja = function (hoja) { // → Promise de [{n, c:{A: valor…}}] o null si no está
        if (!hoja) return Promise.resolve(null);
        var rel = new RegExp('<Relationship\\b[^>]*Id="' + hoja.id + '"[^>]*>'), rm = (r[1] || '').match(rel), destino = rm && (rm[0].match(/Target="([^"]*)"/) || [])[1];
        destino = destino ? destino.replace(/^\/?xl\//, '').replace(/^\//, '') : 'worksheets/sheet1.xml';
        return leer('xl/' + destino).then(function (xml) {
          if (!xml) return null;
          var filas = [], rr = /<row\b([^>]*)>([\s\S]*?)<\/row>/g, f;
          while ((f = rr.exec(xml))) {
            var num = +((f[1].match(/\br="(\d+)"/) || [])[1] || filas.length + 1), celdas = {}, rc = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, c;
            while ((c = rc.exec(f[2]))) {
              var ref = (c[1].match(/\br="([A-Z]+)\d+"/) || [])[1], t = (c[1].match(/\bt="([^"]*)"/) || [])[1], dentro = c[2] || '', v = (dentro.match(/<v>([\s\S]*?)<\/v>/) || [])[1], val;
              if (!ref) continue;
              if (t === 's') val = comp[+v]; else if (t === 'inlineStr') val = textos(dentro); else if (t === 'str' || t === 'e') val = v == null ? '' : desXml(v); else if (t === 'b') val = v === '1'; else val = v == null ? null : Number(v);
              celdas[ref] = val;
            }
            filas.push({ n: num, c: celdas });
          }
          return filas;
        });
      };
      var cabecera = function (filas) { return filas.filter(function (fl) { return Object.keys(fl.c).some(function (k) { return /^Clave/i.test(String(fl.c[k] || '').trim()); }); })[0]; };
      var colDeEn = function (cab) { return function (re) { return Object.keys(cab.c).filter(function (k) { return re.test(String(cab.c[k] || '').trim()); })[0]; }; };
      var hoja = hojas.filter(function (h) { return h.nombre === HOJA; })[0] || hojas[0], hojaN = hojas.filter(function (h) { return h.nombre === HOJA_NUEVOS; })[0];
      return Promise.all([leerHoja(hoja), leerHoja(hojaN)]).then(function (dos) {
        var filas = dos[0]; if (!filas) throw new Error('No encontré la hoja «' + HOJA + '» en el Excel.');
        var cab = cabecera(filas);
        if (!cab) throw new Error('No encontré la columna «Clave (no tocar)» en la hoja «' + hoja.nombre + '». ¿Es la planilla de precios del editor?');
        var colDe = colDeEn(cab);
        var cClave = colDe(/^Clave/i), cNuevo = colDe(/^Precio nuevo/i), cMayor = colDe(/^Por mayor nuevo/i), cProd = colDe(/^Producto/i), cFmt = colDe(/^Formato/i);
        if (!cNuevo) throw new Error('No encontré la columna «Precio nuevo ✎».');
        var leidas = filas.filter(function (fl) { return fl.n > cab.n && fl.c[cClave]; }).map(function (fl) {
          return { clave: String(fl.c[cClave]).trim(), nuevo: fl.c[cNuevo], mayorNuevo: cMayor ? fl.c[cMayor] : null, fila: fl.n, producto: cProd ? fl.c[cProd] : '', formato: cFmt ? fl.c[cFmt] : '' };
        });
        // Hoja «Productos nuevos» (si viene): filas con nombre de producto o con clave de un producto ya cargado
        var fn = dos[1], cn = fn && cabecera(fn);
        if (cn) {
          var cd = colDeEn(cn), C = { seccion: cd(/^Secci/i), producto: cd(/^Producto/i), como: cd(/^C[oó]mo se vende/i), upp: cd(/^Unidades/i), precio: cd(/^Precio/i), mayor: cd(/^Por mayor/i), llego: cd(/lleg/i), codMy: cd(/^C[oó]digo/i), clave: cd(/^Clave/i) };
          leidas.nuevos = fn.filter(function (fl) { return fl.n > cn.n && (String(fl.c[C.producto] == null ? '' : fl.c[C.producto]).trim() || /^N\|(?!nuevo$)/.test(String(fl.c[C.clave] || ''))); }).map(function (fl) {
            var o = { fila: fl.n }; Object.keys(C).forEach(function (k) { o[k] = C[k] ? fl.c[C[k]] : null; }); o.clave = String(o.clave || '').trim(); return o;
          });
        }
        return leidas;
      });
    });
  }

  /* ---------- Comparar con el catálogo y aplicar ---------- */
  function valor(v) { // → {vacio} | {borrar} | {n} | {error}
    if (v === null || v === undefined || v === '' || v === false) return { vacio: true };
    if (typeof v === 'number') return isFinite(v) && v >= 0 ? { n: Math.round(v) } : { error: true };
    var t = String(v).trim(); if (!t) return { vacio: true };
    if (/^[-–—]$/.test(t)) return { borrar: true };
    t = t.replace(/[$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    var n = Number(t); return isFinite(n) && n >= 0 ? { n: Math.round(n) } : { error: true };
  }
  function compararPlanilla(datos, leidas) {
    var mapa = {}, cambios = [], avisos = [], iguales = 0;
    filasPrecios(datos).forEach(function (f) { mapa[f.clave.split('|').slice(0, 3).join('|')] = f; });
    leidas.forEach(function (l) {
      var partes = l.clave.split('|'), base = partes.slice(0, 3).join('|'), f = mapa[base], vn = valor(l.nuevo), vm = valor(l.mayorNuevo);
      if (vn.vacio && vm.vacio) return;
      var donde = 'Fila ' + l.fila + ' (' + (l.producto || base) + (l.formato ? ' · ' + l.formato : '') + ')';
      if (!f) { avisos.push(donde + ': no está en la carta (producto retirado o clave cambiada), no se aplica.'); return; }
      [['nuevo', vn, f.actual, f.editable], ['mayor', vm, f.mayorActual, f.mayorEditable]].forEach(function (q) {
        var campo = q[0], v = q[1], antes = q[2] == null ? null : q[2], ok = q[3];
        if (v.vacio) return;
        if (v.error) { avisos.push(donde + ': «' + (campo === 'nuevo' ? l.nuevo : l.mayorNuevo) + '» no es un precio (escribe pesos sin puntos, o «-»).'); return; }
        if (!ok) { avisos.push(donde + ': ' + (campo === 'nuevo' ? 'este precio' : 'el precio por mayor') + ' no se puede fijar aquí (celda gris).'); return; }
        var despues = v.borrar ? null : v.n;
        if (despues === null && /^A\|.*\|p$/.test(base)) { avisos.push(donde + ': el saco de alimento no puede quedar sin precio.'); return; }
        if (despues === antes) { iguales++; return; }
        var c = { clave: base, campo: campo, cod: f.cod, producto: f.producto, formato: campo === 'mayor' ? f.formato + ' · por mayor desde ' + (f.mayorDesde || '10') : f.formato, antes: antes, despues: despues, fila: l.fila };
        if (antes > 0 && despues > 0 && (despues / antes > 1.6 || despues / antes < 0.6)) c.revisar = true;
        var fp = campo === 'nuevo' && despues !== null && pista(partes[3]);
        if (fp) c.formatoNuevo = fp;
        cambios.push(c);
      });
    });
    if (leidas.nuevos) { var rn = compararNuevos(datos, leidas.nuevos, avisos); cambios = cambios.concat(rn.cambios); iguales += rn.iguales; }
    return { cambios: cambios, avisos: avisos, iguales: iguales };
  }
  function compararNuevos(datos, filas, avisos) {
    var cambios = [], iguales = 0, usados = usadosDe(datos), secciones = seccionesDe(datos), porCod = {}, porNombre = {};
    datos.productos.forEach(function (p) { porCod[p.cod] = p; porNombre[plano(p.nombre)] = p; });
    var vistos = {};
    filas.forEach(function (f) {
      var donde = 'Productos nuevos, fila ' + f.fila + (f.producto ? ' (' + f.producto + ')' : ''), m = f.clave.match(/^N\|(.+)$/), cod = m && m[1] !== 'nuevo' ? m[1] : null;
      if (cod) { // producto ya cargado que aún no llega
        var p = porCod[cod]; if (!p) { avisos.push(donde + ': el producto ' + cod + ' ya no está en la carta.'); return; }
        if (!p.porLlegar) { iguales++; return; } // ya llegó: esta fila ya no manda
        var r = crearProducto(f, { cod: cod, secciones: secciones, donde: donde });
        if (r.errores.length) { avisos.push(donde + ': ' + r.errores.join('; ') + '. No se aplica.'); return; }
        avisos.push.apply(avisos, r.avisos);
        var campos = {};
        [['nombre'], ['cat'], ['detalle'], ['upp'], ['precio'], ['pm']].forEach(function (k) { k = k[0]; var a = p[k] == null ? null : p[k], z = r.p[k] == null ? null : r.p[k]; if (a !== z) campos[k] = z; });
        if (Object.keys(campos).length) cambios.push({ tipo: 'editarNuevo', clave: f.clave, cod: cod, campos: campos, producto: r.p.nombre, formato: 'Producto por llegar: ' + Object.keys(campos).map(function (k) { return { nombre: 'nombre', cat: 'sección', detalle: 'cómo se vende', upp: 'paquete', precio: 'precio', pm: 'por mayor' }[k]; }).join(', '), antes: p.precio, despues: r.p.precio, fila: f.fila });
        if (!r.p.porLlegar) cambios.push({ tipo: 'llego', clave: f.clave, cod: cod, producto: r.p.nombre, formato: 'Llegó: se muestra en la carta y se puede pedir', antes: p.precio, despues: r.p.precio, fila: f.fila });
        if (!Object.keys(campos).length && r.p.porLlegar) iguales++;
        return;
      }
      var nom = plano(f.producto);
      if (porNombre[nom]) { iguales++; return; } // ya está cargado (por ejemplo, al volver a subir la misma planilla)
      if (vistos[nom]) { avisos.push(donde + ': está repetido en la planilla; se agrega una sola vez.'); return; }
      var r2 = crearProducto(f, { usados: usados, secciones: secciones, donde: donde });
      if (r2.errores.length) { avisos.push(donde + ': ' + r2.errores.join('; ') + '. No se agrega.'); return; }
      avisos.push.apply(avisos, r2.avisos); vistos[nom] = true;
      cambios.push({ tipo: 'nuevo', clave: f.clave || 'N|nuevo', cod: r2.p.cod, nuevoProducto: r2.p, producto: r2.p.nombre,
        formato: 'Producto nuevo en «' + r2.p.cat + '» · ' + r2.p.detalle.replace(/^Precio /, '') + (r2.p.porLlegar ? ' · por llegar (oculto hasta que llegue)' : ' · ya llegó (visible)'), antes: null, despues: r2.p.precio, fila: f.fila });
    });
    return { cambios: cambios, iguales: iguales };
  }
  function aplicarEnEstado(estado, cambios) {
    var porCod = {}; estado.productos.forEach(function (p) { porCod[p.cod] = p; });
    cambios.forEach(function (c) {
      if (c.tipo === 'nuevo') { // después del último producto de su sección (o al final)
        if (porCod[c.cod]) return; var np = JSON.parse(JSON.stringify(c.nuevoProducto)), pos = -1;
        for (var i = estado.productos.length - 1; i >= 0; i--) if (estado.productos[i].cat === np.cat) { pos = i; break; }
        if (pos < 0) estado.productos.push(np); else estado.productos.splice(pos + 1, 0, np);
        porCod[np.cod] = np; return;
      }
      if (c.tipo === 'llego') { if (porCod[c.cod]) delete porCod[c.cod].porLlegar; return; }
      if (c.tipo === 'editarNuevo') {
        var q = porCod[c.cod]; if (!q) return;
        Object.keys(c.campos).forEach(function (k) { var v = c.campos[k]; if (v == null && k !== 'precio') delete q[k]; else q[k] = v; });
        return;
      }
      var p3 = c.clave.split('|'), tipo = p3[0], id = p3[1], campo = p3[2], v = c.despues;
      if (tipo === 'P') {
        var p = porCod[id]; if (!p) return;
        if (c.campo === 'mayor') {
          if (Array.isArray(p.tramos) && p.tramos.length === 1) { if (v === null) delete p.tramos; else p.tramos = [[p.tramos[0][0], v]]; return; } // por mayor propio desde N
          if (v === null) delete p.pm; else p.pm = v; return;
        }
        if (campo === 'precio') {
          p.precio = v;
          if (c.formatoNuevo) { p.detalle = c.formatoNuevo.detalle; if (c.formatoNuevo.upp > 1) p.upp = c.formatoNuevo.upp; else delete p.upp; delete p.pq; }
        } else if (campo === 'pq') { if (v === null) delete p.pq; else p.pq = v; }
        else if (/^b\d+$/.test(campo)) { var g = +campo.slice(1); (p.bolsas || []).forEach(function (b) { if (b[0] === g) b[1] = v; }); }
      } else if (tipo === 'H') {
        var t = estado.listaHuevos && estado.listaHuevos[id]; if (!t) return;
        var fi = campo.split('.'); if (fi.length > 1) { if (Array.isArray(t[fi[0]])) t[fi[0]][+fi[1]] = v; } else t[campo] = v;
      } else if (tipo === 'A') {
        (estado.alimentos || []).forEach(function (a) { if (a.n === id) { if (v === null && campo === 'k') delete a.k; else a[campo] = v; } });
      } else if (tipo === 'R') {
        (estado.promos || []).forEach(function (p) { if (p.cod === id) p.precio = v; });
      }
    });
    return estado;
  }

  return { HOJA: HOJA, HOJA_NUEVOS: HOJA_NUEVOS, COMO: COMO, COLUMNAS: COLUMNAS, crearProducto: crearProducto, seccionesDe: seccionesDe, usadosDe: usadosDe, comoDe: comoDe, filasPrecios: filasPrecios, crearXlsx: crearXlsx, leerXlsx: leerXlsx, compararPlanilla: compararPlanilla, aplicarEnEstado: aplicarEnEstado, hojaTexto: hojaTexto, calculos: calculos, pista: pista, clp: clp };
});
