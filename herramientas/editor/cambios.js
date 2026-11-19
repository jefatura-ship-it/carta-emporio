/* Editor del Catálogo Sabroso — motor compartido (navegador y Node).
   leerCatalogo(html)          → datos editables del catálogo del Emporio (carta/index.html)
   diferencias(base, estado)   → solo lo que cambió (lo que se descarga y se le pasa a Claude)
   aplicarCambios(html, cambios) → el mismo carta/index.html con los cambios aplicados
   resumen(base, cambios)      → lista en palabras de lo que cambió
   Este archivo no se publica en la web (herramientas/ queda fuera del despliegue). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.EditorCatalogo = fabrica();
})(this, function () {
  'use strict';

  var COLORES = [
    ['--campo', 'Verde principal (barras, botones)'], ['--brote', 'Verde claro'], ['--sol', 'Naranja (destacados)'],
    ['--trigo', 'Amarillo'], ['--masa', 'Fondo crema'], ['--tarjeta', 'Fondo de las tarjetas'], ['--tinta', 'Texto'],
    ['--suave', 'Texto secundario'], ['--borde', 'Bordes suaves'], ['--linea', 'Borde de los campos'],
    ['--wsp', 'Botón de WhatsApp'], ['--sol-t', 'Naranja para textos']
  ];
  // Campos de cada producto que el editor puede cambiar. upp: unidades por paquete; pq: precio fijo del paquete;
  // pm: precio por mayor propio (c/u desde 10 u, o c/paquete desde 10 paquetes); bolsas: [[gramos, precio]] del granel.
  var CAMPOS_PRODUCTO = ['nombre', 'detalle', 'precio', 'oferta', 'retirado', 'fav', 'upp', 'pq', 'pm', 'bolsas'];
  var INI_ESTILOS ='/* ==== EDITOR DEL CATÁLOGO: inicio (generado por herramientas/editor) ==== */';
  var FIN_ESTILOS = '/* ==== EDITOR DEL CATÁLOGO: fin ==== */';

  function literal(txt) { return new Function('return (' + txt + ');')(); } // solo con el código propio del catálogo
  function iguales(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function clave(k) { return /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k); }
  function objetoJS(o) { return '{' + Object.keys(o).filter(function (k) { return o[k] !== undefined; }).map(function (k) { return clave(k) + ':' + JSON.stringify(o[k]); }).join(',') + '}'; }
  function trozo(html, inicio, fin, desde) {
    var a = html.indexOf(inicio, desde || 0); if (a < 0) throw new Error('No encontré «' + inicio.slice(0, 40) + '» en el catálogo');
    var b = html.indexOf(fin, a + inicio.length); if (b < 0) throw new Error('No encontré el final de «' + inicio.slice(0, 40) + '»');
    return { a: a, b: b + fin.length, texto: html.slice(a, b + fin.length), dentro: html.slice(a + inicio.length, b) };
  }
  function bloqueEmporio(html) { return trozo(html, '  emporio:{', '\n  distribuidora:{'); }

  /* ---------- Lectura ---------- */
  function leerCatalogo(html0) {
    var html = html0.replace(/\r\n/g, '\n');
    var datos = {};
    // Colores de la marca (primer :root)
    var raizCss = trozo(html, ':root{', '}');
    datos.colores = {};
    COLORES.forEach(function (c) { var m = raizCss.texto.match(new RegExp(c[0].replace(/-/g, '\\-') + ':\\s*(#[0-9a-fA-F]{3,8})\\s*;')); if (m) datos.colores[c[0]] = m[1].toLowerCase(); });
    // Textos del Emporio
    var emp = bloqueEmporio(html);
    datos.textos = {};
    ['lema', 'datos'].forEach(function (k) { var m = emp.texto.match(new RegExp('\\n    ' + k + ':("(?:[^"\\\\]|\\\\.)*")')); if (m) datos.textos[k] = JSON.parse(m[1]); });
    // Productos del Emporio (una línea por producto)
    var lista = trozo(html, '    productos:[', '\n    ]', emp.a);
    datos.productos = lista.dentro.split('\n').filter(function (l) { return /^\s*\{cod:"/.test(l); }).map(function (l) { return literal(l.trim().replace(/,\s*$/, '')); });
    // Promos (líneas L.productos.push)
    datos.promos = (html.match(/^L\.productos\.push\(\{.*\}\);$/gm) || []).map(function (l) { return literal(l.slice('L.productos.push('.length, -2)); });
    // Ofertas por formato
    var of = html.match(/^const OFERTAS_FMT=(\{.*\});$/m); datos.ofertasFormato = of ? literal(of[1]) : {};
    // Precios de huevos por bandeja y caja (la caja por tramos) y lista de alimentos para aves (pedido por WhatsApp)
    datos.listaHuevos = literal('{' + trozo(html, 'const LISTA_HUEVOS={', '\n};').dentro + '}');
    datos.alimentos = literal('[' + trozo(html, '  const ALIMENTOS=[', '];').dentro + ']');
    // Solo lectura (para calcular precios de paquete y por mayor como la carta)
    var my = html.match(/\n    mayor:(\{[^\n]*?\}),/); datos.mayor = my ? literal(my[1]) : null;
    var tc = html.match(/^const TRAMOS_CAJA=(\[[^\n]*\]);/m); datos.tramosCaja = tc ? literal(tc[1]) : [1];
    var ch = html.match(/^const CAL_HUEVO=(\{[^\n]*\});/m); datos.calHuevo = ch ? literal(ch[1]) : {};
    // Familias del menú
    datos.familias = literal('[' + trozo(html, 'const FAMILIAS=[', '\n];').dentro + ']');
    // Vitrina
    datos.vitrina = literal('[' + trozo(html, '  const VITRINA=[', '\n  ];').dentro + ']');
    // Estilos del editor ya aplicados (si los hay)
    var ie = html.indexOf(INI_ESTILOS), fe = html.indexOf(FIN_ESTILOS);
    datos.estilosPrevios = ie >= 0 && fe > ie ? html.slice(ie + INI_ESTILOS.length, fe).trim() : '';
    var ed = html.match(/\/\* EDITOR-DATOS (\{.*\}) \*\//);
    var previo = ed ? JSON.parse(ed[1]) : {};
    datos.opciones = previo.opciones || { vitrina: true, precioMayor: true };
    datos.elementos = previo.elementos || [];
    datos.cssLibre = previo.cssLibre || '';
    return datos;
  }

  /* ---------- Diferencias ---------- */
  function diferencias(base, estado) {
    var c = {};
    var col = {}; Object.keys(estado.colores || {}).forEach(function (k) { if (estado.colores[k] !== base.colores[k]) col[k] = estado.colores[k]; });
    if (Object.keys(col).length) c.colores = col;
    var tx = {}; Object.keys(estado.textos || {}).forEach(function (k) { if (estado.textos[k] !== base.textos[k]) tx[k] = estado.textos[k]; });
    if (Object.keys(tx).length) c.textos = tx;
    var porCod = {}; base.productos.forEach(function (p) { porCod[p.cod] = p; });
    var pr = {};
    (estado.productos || []).forEach(function (p) {
      var b = porCod[p.cod]; if (!b) return; var d = {};
      CAMPOS_PRODUCTO.forEach(function (k) {
        var a = p[k], z = b[k];
        if (iguales(a, z) || (a == null && z == null) || (!a && !z && (k === 'retirado' || k === 'fav'))) return;
        d[k] = a === undefined ? null : a;
      });
      if (Object.keys(d).length) pr[p.cod] = d;
    });
    if (Object.keys(pr).length) c.productos = pr;
    if (estado.listaHuevos && !iguales(base.listaHuevos, estado.listaHuevos)) c.listaHuevos = estado.listaHuevos;
    if (estado.alimentos) {
      var al = {}; (estado.alimentos || []).forEach(function (a) { var b = (base.alimentos || []).filter(function (x) { return x.n === a.n; })[0]; if (!b) return; var d = {}; ['p', 'k'].forEach(function (k) { if (!iguales(a[k], b[k]) && !(a[k] == null && b[k] == null)) d[k] = a[k] == null ? null : a[k]; }); if (Object.keys(d).length) al[a.n] = d; });
      if (Object.keys(al).length) c.alimentos = al;
    }
    var ordenBase = base.productos.map(function (p) { return p.cod; }), ordenEst = (estado.productos || []).map(function (p) { return p.cod; });
    if (!iguales(ordenBase, ordenEst)) c.ordenProductos = ordenEst;
    if (!iguales(base.promos, estado.promos)) c.promos = estado.promos;
    if (!iguales(base.ofertasFormato, estado.ofertasFormato)) c.ofertasFormato = estado.ofertasFormato;
    if (!iguales(base.familias, estado.familias)) c.familias = estado.familias;
    if (!iguales(base.vitrina, estado.vitrina)) c.vitrina = estado.vitrina;
    if (!iguales(base.opciones, estado.opciones)) c.opciones = estado.opciones;
    if (!iguales(base.elementos, estado.elementos)) c.elementos = estado.elementos;
    if ((estado.cssLibre || '') !== (base.cssLibre || '')) c.cssLibre = estado.cssLibre || '';
    return c;
  }

  /* ---------- Aplicación ---------- */
  function cssDe(opciones, elementos, cssLibre) {
    var r = [];
    if (opciones && opciones.vitrina === false) r.push('.vitrina{display:none!important}');
    if (opciones && opciones.precioMayor === false) r.push('#bMayor{display:none!important}');
    (elementos || []).forEach(function (e) {
      if (!e || !e.sel || /[{}<]/.test(e.sel)) return;
      var p = e.props || {}, d = [];
      if (p.fondo) d.push('background:' + p.fondo + '!important');
      if (p.texto) d.push('color:' + p.texto + '!important');
      if (p.borde) d.push('border-color:' + p.borde + '!important');
      if (p.letra) d.push('font-size:' + Number(p.letra) + 'px!important');
      if (p.redondeo !== undefined && p.redondeo !== '') d.push('border-radius:' + Number(p.redondeo) + 'px!important');
      if (p.ocultar) d.push('display:none!important');
      if (d.length) r.push(e.sel + '{' + d.join(';') + '}');
    });
    if (cssLibre) r.push(String(cssLibre).replace(/<\/style/gi, ''));
    return r.join('\n');
  }

  function aplicarCambios(html0, c) {
    var crlf = /\r\n/.test(html0), html = html0.replace(/\r\n/g, '\n');
    c = c || {};
    var base = leerCatalogo(html);
    // Colores
    if (c.colores) {
      var rc = trozo(html, ':root{', '}'), t = rc.texto;
      Object.keys(c.colores).forEach(function (k) {
        if (!/^#[0-9a-fA-F]{3,8}$/.test(c.colores[k])) return;
        t = t.replace(new RegExp('(' + k.replace(/-/g, '\\-') + ':\\s*)#[0-9a-fA-F]{3,8}(\\s*;)'), '$1' + c.colores[k] + '$2');
      });
      html = html.slice(0, rc.a) + t + html.slice(rc.b);
    }
    // Textos del Emporio
    if (c.textos) {
      var emp = bloqueEmporio(html), te = emp.texto;
      Object.keys(c.textos).forEach(function (k) { if (['lema', 'datos'].indexOf(k) < 0) return; te = te.replace(new RegExp('(\\n    ' + k + ':)"(?:[^"\\\\]|\\\\.)*"'), function (m0, a) { return a + JSON.stringify(String(c.textos[k])); }); });
      html = html.slice(0, emp.a) + te + html.slice(emp.b);
    }
    // Productos (campos y orden)
    if (c.productos || c.ordenProductos) {
      var emp2 = bloqueEmporio(html), lista = trozo(html, '    productos:[', '\n    ]', emp2.a);
      var lineas = lista.dentro.split('\n'), idx = [], porCod = {};
      lineas.forEach(function (l, i) { if (/^\s*\{cod:"/.test(l)) { idx.push(i); var p = literal(l.trim().replace(/,\s*$/, '')); porCod[p.cod] = { linea: l, p: p }; } });
      Object.keys(c.productos || {}).forEach(function (cod) {
        var x = porCod[cod]; if (!x) return; var d = c.productos[cod], p = x.p;
        Object.keys(d).forEach(function (k) {
          if (['nombre', 'detalle'].indexOf(k) >= 0) p[k] = String(d[k] == null ? '' : d[k]);
          else if (k === 'precio' || k === 'oferta') { if (d[k] === null || d[k] === '') { if (k === 'precio') p.precio = null; else delete p.oferta; } else p[k] = Math.max(0, Math.round(Number(d[k]) || 0)); }
          else if (k === 'retirado' || k === 'fav') { if (d[k]) p[k] = true; else delete p[k]; }
          else if (k === 'pq' || k === 'pm') { if (d[k] === null || d[k] === '') delete p[k]; else p[k] = Math.max(0, Math.round(Number(d[k]) || 0)); }
          else if (k === 'upp') { var u = Math.round(Number(d[k]) || 0); if (u > 1) p.upp = u; else delete p.upp; }
          else if (k === 'bolsas') { if (Array.isArray(d[k]) && d[k].length) p.bolsas = d[k].map(function (b) { return [Math.round(Number(b[0]) || 0), b[1] === null || b[1] === '' ? null : Math.max(0, Math.round(Number(b[1]) || 0))]; }).filter(function (b) { return b[0] > 0; }); }
        });
        var sangria = x.linea.match(/^\s*/)[0], coma = /,\s*$/.test(x.linea) ? ',' : '';
        x.linea = sangria + objetoJS(p) + coma;
      });
      var orden = c.ordenProductos && c.ordenProductos.filter(function (cod) { return porCod[cod]; });
      var codsActuales = idx.map(function (i) { return literal(lineas[i].trim().replace(/,\s*$/, '')).cod; });
      if (!orden || orden.length !== codsActuales.length) orden = codsActuales;
      idx.forEach(function (i, n) { var l = porCod[orden[n]].linea; lineas[i] = l.replace(/,?\s*$/, ',') ; });
      var nuevo = lineas.join('\n');
      html = html.slice(0, lista.a) + '    productos:[' + nuevo + '\n    ]' + html.slice(lista.b);
    }
    // Huevos por bandeja y caja: se reescribe la tabla completa, un calibre por línea
    if (c.listaHuevos) {
      var lh = trozo(html, 'const LISTA_HUEVOS={', '\n};');
      var limpio = function (v) { return v === null || v === '' || v === undefined ? null : Math.max(0, Math.round(Number(v) || 0)); };
      var lineasH = Object.keys(c.listaHuevos).map(function (cal) {
        var f = c.listaHuevos[cal], o = {};
        Object.keys(f).forEach(function (fid) { o[fid] = Array.isArray(f[fid]) ? f[fid].map(limpio) : limpio(f[fid]); });
        return '  ' + clave(cal) + ':' + JSON.stringify(o).replace(/"([A-Za-z_$][\w$]*)":/g, '$1:');
      });
      html = html.slice(0, lh.a) + 'const LISTA_HUEVOS={\n' + lineasH.join(',\n') + '\n};' + html.slice(lh.b);
    }
    // Alimentos para aves: precio del saco (p) y del kilo (k) de cada producto, por su nombre
    if (c.alimentos) {
      var la = trozo(html, '  const ALIMENTOS=[', '];'), filasA = la.dentro.split('\n');
      filasA = filasA.map(function (l) {
        if (!/^\s*\{g:/.test(l)) return l;
        var a = literal(l.trim().replace(/,\s*$/, '')), d = c.alimentos[a.n]; if (!d) return l;
        ['p', 'k'].forEach(function (k) { if (!(k in d)) return; if (d[k] === null || d[k] === '') { if (k === 'k') delete a.k; } else a[k] = Math.max(0, Math.round(Number(d[k]) || 0)); });
        return l.match(/^\s*/)[0] + objetoJS(a) + (/,\s*$/.test(l) ? ',' : '');
      });
      html = html.slice(0, la.a) + '  const ALIMENTOS=[' + filasA.join('\n') + '];' + html.slice(la.b);
    }
    // Promos
    if (c.promos) {
      var m = html.match(/(^L\.productos\.push\(\{.*\}\);\n?)+/m);
      if (!m) throw new Error('No encontré las promos en el catálogo');
      var bloque = c.promos.filter(function (p) { return p && p.cod; }).map(function (p) {
        var q = { cod: String(p.cod), cat: 'Promos', nombre: String(p.nombre || ''), detalle: String(p.detalle || ''), precio: p.precio === null || p.precio === '' || p.precio === undefined ? null : Math.round(Number(p.precio) || 0), fav: true, promo: true };
        if (p.foto) q.foto = String(p.foto);
        return 'L.productos.push(' + objetoJS(q) + ');';
      }).join('\n') + '\n';
      html = html.replace(m[0], bloque);
    }
    // Ofertas por formato
    if (c.ofertasFormato) html = html.replace(/^const OFERTAS_FMT=\{.*\};$/m, 'const OFERTAS_FMT=' + JSON.stringify(c.ofertasFormato).replace(/"([A-Za-z_$][\w$]*)":/g, '$1:') + ';');
    // Familias
    if (c.familias) {
      var fa = trozo(html, 'const FAMILIAS=[', '\n];');
      html = html.slice(0, fa.a) + 'const FAMILIAS=[\n' + c.familias.map(function (f) { return '  [' + JSON.stringify(String(f[0])) + ',' + JSON.stringify(f[1].map(String)) + ']'; }).join(',\n') + '\n];' + html.slice(fa.b);
    }
    // Vitrina
    if (c.vitrina) {
      var vi = trozo(html, '  const VITRINA=[', '\n  ];');
      html = html.slice(0, vi.a) + '  const VITRINA=[\n' + c.vitrina.map(function (v) { return '    ' + objetoJS(v); }).join(',\n') + '\n  ];' + html.slice(vi.b);
    }
    // Estilos del editor (opciones, partes seleccionadas y CSS libre) + sus datos para volver a editarlos
    var op = c.opciones || base.opciones, el = c.elementos || base.elementos, li = c.cssLibre !== undefined ? c.cssLibre : base.cssLibre;
    if (c.opciones || c.elementos || c.cssLibre !== undefined) {
      var ie = html.indexOf(INI_ESTILOS), fe = html.indexOf(FIN_ESTILOS);
      if (ie >= 0 && fe > ie) html = html.slice(0, ie) + html.slice(fe + FIN_ESTILOS.length + 1);
      var css = cssDe(op, el, li), datosEd = JSON.stringify({ opciones: op, elementos: el, cssLibre: li }).replace(/\*\//g, '* /');
      var bloqueCss = INI_ESTILOS + '\n/* EDITOR-DATOS ' + datosEd + ' */\n' + css + '\n' + FIN_ESTILOS + '\n';
      var st = html.indexOf('</style>');
      html = html.slice(0, st) + bloqueCss + html.slice(st);
    }
    return crlf ? html.replace(/\n/g, '\r\n') : html;
  }

  /* ---------- Resumen en palabras ---------- */
  function resumen(base, c) {
    var r = [], nombreColor = {}; COLORES.forEach(function (x) { nombreColor[x[0]] = x[1]; });
    var clp = function (n) { return n === null || n === undefined || n === '' ? 'por confirmar' : '$' + Math.round(n).toLocaleString('es-CL'); };
    Object.keys(c.colores || {}).forEach(function (k) { r.push('Color «' + (nombreColor[k] || k) + '»: ' + base.colores[k] + ' → ' + c.colores[k]); });
    Object.keys(c.textos || {}).forEach(function (k) { r.push('Texto «' + k + '»: «' + base.textos[k] + '» → «' + c.textos[k] + '»'); });
    var porCod = {}; base.productos.forEach(function (p) { porCod[p.cod] = p; });
    Object.keys(c.productos || {}).forEach(function (cod) {
      var b = porCod[cod] || {}, d = c.productos[cod], partes = [];
      if ('nombre' in d) partes.push('nombre «' + d.nombre + '»');
      if ('detalle' in d) partes.push('detalle «' + d.detalle + '»');
      if ('precio' in d) partes.push('precio ' + clp(b.precio) + ' → ' + clp(d.precio));
      if ('oferta' in d) partes.push('oferta ' + clp(b.oferta) + ' → ' + clp(d.oferta));
      if ('upp' in d) partes.push(d.upp > 1 ? 'paquete de ' + d.upp + ' u' + (b.upp ? ' (antes ' + b.upp + ' u)' : '') : 'sin paquete');
      if ('pq' in d) partes.push('precio del paquete ' + (b.pq == null ? 'automático' : clp(b.pq)) + ' → ' + (d.pq == null ? 'automático' : clp(d.pq)));
      if ('pm' in d) partes.push('precio por mayor ' + (b.pm == null ? 'automático' : clp(b.pm)) + ' → ' + (d.pm == null ? 'automático' : clp(d.pm)));
      if ('bolsas' in d) { var bb = {}; (b.bolsas || []).forEach(function (x) { bb[x[0]] = x[1]; }); partes.push('bolsas: ' + (d.bolsas || []).filter(function (x) { return bb[x[0]] !== x[1]; }).map(function (x) { return (x[0] >= 1000 ? String(x[0] / 1000).replace('.', ',') + ' kg' : x[0] + ' g') + ' ' + clp(bb[x[0]]) + ' → ' + clp(x[1]); }).join(', ')); }
      if ('retirado' in d) partes.push(d.retirado ? 'oculto' : 'visible');
      if ('fav' in d) partes.push(d.fav ? 'en Ofertas y promos' : 'fuera de Ofertas y promos');
      r.push('Producto ' + cod + ' (' + (b.nombre || '') + '): ' + partes.join(', '));
    });
    if (c.listaHuevos) {
      var FMT = { F20: 'bandeja de 20', F30: 'bandeja de 30', F100: 'caja de 100', F180: 'caja de 180' }, tr = base.tramosCaja || [1];
      Object.keys(c.listaHuevos).forEach(function (cal) {
        var a = (base.listaHuevos || {})[cal] || {}, z = c.listaHuevos[cal];
        Object.keys(z).forEach(function (fid) {
          var va = a[fid], vz = z[fid];
          if (Array.isArray(vz)) vz.forEach(function (x, i) { var y = Array.isArray(va) ? va[i] : undefined; if (x !== y) r.push('Huevo ' + cal + ' · ' + (FMT[fid] || fid) + ' (' + (i === tr.length - 1 ? 'desde ' + tr[i] : tr[i] + ' a ' + (tr[i + 1] - 1)) + ' cajas): ' + clp(y) + ' → ' + clp(x)); });
          else if (vz !== va) r.push('Huevo ' + cal + ' · ' + (FMT[fid] || fid) + ': ' + clp(va) + ' → ' + clp(vz));
        });
      });
    }
    Object.keys(c.alimentos || {}).forEach(function (n) {
      var a = (base.alimentos || []).filter(function (x) { return x.n === n; })[0] || {}, d = c.alimentos[n], partes = [];
      if ('p' in d) partes.push('saco ' + clp(a.p) + ' → ' + clp(d.p));
      if ('k' in d) partes.push('kilo ' + clp(a.k) + ' → ' + clp(d.k));
      r.push('Alimento para aves «' + n + '»: ' + partes.join(', '));
    });
    if (c.ordenProductos) r.push('Nuevo orden de productos dentro de sus secciones');
    if (c.promos) r.push('Promos: ' + c.promos.length + ' (' + c.promos.map(function (p) { return p.cod + ' ' + clp(p.precio); }).join(', ') + ')');
    if (c.ofertasFormato) r.push('Ofertas por formato: ' + Object.keys(c.ofertasFormato).map(function (k) { return k + ' ' + Object.keys(c.ofertasFormato[k]).map(function (f) { return f + ' ' + clp(c.ofertasFormato[k][f]); }).join(', '); }).join(' · '));
    if (c.familias) r.push('Menú: ' + c.familias.map(function (f) { return f[0] + ' (' + f[1].join(', ') + ')'; }).join(' · '));
    if (c.vitrina) r.push('Vitrina: ' + c.vitrina.length + ' diapositivas — ' + c.vitrina.map(function (v) { return '«' + (v.tit || v.et || '') + '»'; }).join(', '));
    if (c.opciones) r.push('Opciones: vitrina ' + (c.opciones.vitrina === false ? 'oculta' : 'visible') + ', botón «Ver precios por mayor» ' + (c.opciones.precioMayor === false ? 'oculto' : 'visible'));
    if (c.elementos) r.push('Partes con estilo propio: ' + c.elementos.length + (c.elementos.length ? ' (' + c.elementos.map(function (e) { return e.nombre || e.sel; }).join(', ') + ')' : ''));
    if (c.cssLibre !== undefined) r.push('CSS libre: ' + (c.cssLibre ? c.cssLibre.split('\n').length + ' línea(s)' : 'vacío'));
    return r;
  }

  return { COLORES: COLORES, CAMPOS_PRODUCTO: CAMPOS_PRODUCTO, leerCatalogo: leerCatalogo, diferencias: diferencias, aplicarCambios: aplicarCambios, resumen: resumen, cssDe: cssDe };
});
