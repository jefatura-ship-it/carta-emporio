/**
 * Registro de clientes de la carta QR (Emporio Sabroso y Distribuidora Santa Bárbara).
 * Apps Script ligado a la planilla EM27-07. Recibe lo que envía la carta y lo anota.
 *
 * INSTALACIÓN
 *  1. Abrir la planilla EM27-07 → Extensiones → Apps Script. Pegar este archivo completo.
 *  2. Implementar → Nueva implementación → Aplicación web.
 *     Ejecutar como: yo. Quién tiene acceso: cualquier persona.
 *  3. Copiar la URL que termina en /exec y pegarla en index.html, en REGISTRO_URL.
 *  4. Recargar la planilla: aparece el menú "Registro de clientes".
 *
 * QUÉ RECIBE (JSON enviado como texto por la carta)
 *  registro  {n1, n2, a1, a2, tel, acepta, fecha, local}  crea o actualiza al cliente
 *  uso       {tel, codigo, monto, local}                  anota el descuento de bienvenida usado
 *  baja      {tel, local}                                 deja de recibir ofertas (se aplica de inmediato)
 *  eliminar  {tel, local}                                 solicitud de eliminación (queda pendiente)
 *
 * La eliminación NO es automática: cualquiera que conozca un celular podría enviarla.
 * Queda anotada en "Solicitudes" y una persona la confirma con el cliente (por WhatsApp
 * o en el local). Luego escribe SI en la columna "Eliminar (verificado)" de "Clientes"
 * y usa el menú Registro de clientes → Eliminar clientes verificados.
 *
 * Esta planilla guarda datos personales: compartirla solo con quien la necesita.
 */

const HOJA_CLIENTES = 'Clientes';
const HOJA_SOLICITUDES = 'Solicitudes';
const COLUMNAS_CLIENTES = ['Fecha de registro', 'Local', 'Primer nombre', 'Segundo nombre', 'Apellido paterno', 'Apellido materno',
  'Celular', 'Acepta ofertas', 'Fecha de baja', 'Descuento usado', 'Código del pedido', 'Monto del descuento',
  'Eliminación solicitada', 'Eliminar (verificado)', 'Actualizado'];
const COLUMNAS_SOLICITUDES = ['Fecha', 'Tipo', 'Celular', 'Local', 'Estado', 'Resuelta el'];
const LOCALES_VALIDOS = ['emporio', 'distribuidora'];
const COL = {}; COLUMNAS_CLIENTES.forEach(function (nombre, i) { COL[nombre] = i + 1; });

function doPost(e) {
  let respuesta = { ok: false };
  const candado = LockService.getScriptLock();
  try {
    candado.waitLock(20000);
    const cuerpo = (e && e.postData && e.postData.contents) || '';
    if (!cuerpo || cuerpo.length > 4000) throw new Error('cuerpo vacío o demasiado largo');
    const d = JSON.parse(cuerpo);
    const tel = celular(d.tel);
    const local = LOCALES_VALIDOS.indexOf(String(d.local || '').toLowerCase()) >= 0 ? String(d.local).toLowerCase() : 'emporio';
    if (!tel) throw new Error('celular no válido');
    if (d.tipo === 'registro') registrar(d, tel, local);
    else if (d.tipo === 'uso') anotarUso(d, tel, local);
    else if (d.tipo === 'baja') darDeBaja(tel, local);
    else if (d.tipo === 'eliminar') solicitarEliminacion(tel, local);
    else throw new Error('tipo desconocido');
    respuesta = { ok: true };
  } catch (err) {
    respuesta = { ok: false, error: String(err && err.message || err) };
  } finally {
    try { candado.releaseLock(); } catch (err) { /* sin candado que soltar */ }
  }
  return ContentService.createTextOutput(JSON.stringify(respuesta)).setMimeType(ContentService.MimeType.JSON);
}

// Solo para comprobar en el navegador que la implementación responde. No entrega datos.
function doGet() {
  return ContentService.createTextOutput('Registro de clientes de la carta: activo.');
}

/* ---------- Tipos ---------- */

function registrar(d, tel, local) {
  const hoja = hojaClientes();
  const ahora = new Date();
  let fila = buscarCliente(hoja, tel, local);
  const acepta = d.acepta === true;
  if (!fila) {
    fila = hoja.getLastRow() + 1;
    hoja.getRange(fila, COL['Fecha de registro']).setValue(fechaValida(d.fecha) || ahora);
    hoja.getRange(fila, COL['Local']).setValue(local);
    hoja.getRange(fila, COL['Celular']).setValue(texto(tel));
  }
  hoja.getRange(fila, COL['Primer nombre'], 1, 4).setValues([[texto(d.n1), texto(d.n2), texto(d.a1), texto(d.a2)]]);
  const antes = hoja.getRange(fila, COL['Acepta ofertas']).getValue();
  hoja.getRange(fila, COL['Acepta ofertas']).setValue(acepta ? 'Sí' : 'No');
  if (acepta) hoja.getRange(fila, COL['Fecha de baja']).clearContent();
  else if (antes === 'Sí') hoja.getRange(fila, COL['Fecha de baja']).setValue(ahora);
  hoja.getRange(fila, COL['Actualizado']).setValue(ahora);
}

function anotarUso(d, tel, local) {
  const hoja = hojaClientes();
  const fila = buscarCliente(hoja, tel, local) || buscarCliente(hoja, tel, null);
  if (!fila) return; // usó el descuento sin haber quedado registrado en la planilla: no hay fila que marcar
  const ahora = new Date();
  hoja.getRange(fila, COL['Descuento usado'], 1, 3).setValues([[ahora, texto(d.codigo), Math.max(0, Math.round(Number(d.monto) || 0))]]);
  hoja.getRange(fila, COL['Actualizado']).setValue(ahora);
}

function darDeBaja(tel, local) {
  const hoja = hojaClientes();
  const ahora = new Date();
  const filas = filasDelCelular(hoja, tel); // la baja de ofertas vale para todos los locales
  filas.forEach(function (fila) {
    hoja.getRange(fila, COL['Acepta ofertas']).setValue('No');
    hoja.getRange(fila, COL['Fecha de baja']).setValue(ahora);
    hoja.getRange(fila, COL['Actualizado']).setValue(ahora);
  });
  anotarSolicitud('Baja de ofertas', tel, local, filas.length ? 'Aplicada' : 'Sin registro en la planilla', ahora);
}

function solicitarEliminacion(tel, local) {
  const hoja = hojaClientes();
  const ahora = new Date();
  const filas = filasDelCelular(hoja, tel);
  filas.forEach(function (fila) {
    hoja.getRange(fila, COL['Eliminación solicitada']).setValue(ahora);
    hoja.getRange(fila, COL['Acepta ofertas']).setValue('No'); // mientras se verifica, no se le envían ofertas
    hoja.getRange(fila, COL['Actualizado']).setValue(ahora);
  });
  anotarSolicitud('Eliminación de datos', tel, local, filas.length ? 'Pendiente de verificar' : 'Sin registro en la planilla', filas.length ? '' : ahora);
}

/* ---------- Menú de la planilla ---------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Registro de clientes')
    .addItem('Eliminar clientes verificados', 'eliminarVerificados')
    .addItem('Preparar hojas', 'prepararHojas')
    .addToUi();
}

function prepararHojas() { hojaClientes(); hojaSolicitudes(); }

// Borra las filas de "Clientes" que tienen SI en "Eliminar (verificado)" y cierra sus solicitudes.
function eliminarVerificados() {
  const ui = SpreadsheetApp.getUi();
  const hoja = hojaClientes();
  const ultima = hoja.getLastRow();
  if (ultima < 2) return ui.alert('No hay clientes registrados.');
  const datos = hoja.getRange(2, 1, ultima - 1, COLUMNAS_CLIENTES.length).getValues();
  const marcadas = [];
  datos.forEach(function (f, i) {
    if (/^s[ií]$/i.test(String(f[COL['Eliminar (verificado)'] - 1]).trim())) marcadas.push({ fila: i + 2, tel: celular(f[COL['Celular'] - 1]) });
  });
  if (!marcadas.length) return ui.alert('No hay filas con SI en la columna "Eliminar (verificado)".');
  const r = ui.alert('Eliminar datos', 'Se van a borrar ' + marcadas.length + ' registro(s) de forma definitiva. ¿Continuar?', ui.ButtonSet.OK_CANCEL);
  if (r !== ui.Button.OK) return;
  marcadas.sort(function (a, b) { return b.fila - a.fila; }).forEach(function (m) { hoja.deleteRow(m.fila); });
  const sol = hojaSolicitudes(), n = sol.getLastRow();
  if (n > 1) {
    const filas = sol.getRange(2, 1, n - 1, COLUMNAS_SOLICITUDES.length).getValues();
    const borrados = marcadas.map(function (m) { return m.tel; });
    const ahora = new Date();
    filas.forEach(function (f, i) {
      if (f[1] === 'Eliminación de datos' && f[4] === 'Pendiente de verificar' && borrados.indexOf(celular(f[2])) >= 0)
        sol.getRange(i + 2, 5, 1, 2).setValues([['Eliminada', ahora]]);
    });
  }
  ui.alert('Listo: ' + marcadas.length + ' registro(s) eliminado(s). Avisa al cliente que su solicitud está resuelta.');
}

/* ---------- Apoyo ---------- */

function hojaClientes() { return hojaCon(HOJA_CLIENTES, COLUMNAS_CLIENTES); }
function hojaSolicitudes() { return hojaCon(HOJA_SOLICITUDES, COLUMNAS_SOLICITUDES); }

function hojaCon(nombre, columnas) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = libro.getSheetByName(nombre) || libro.insertSheet(nombre);
  const actual = hoja.getRange(1, 1, 1, columnas.length).getValues()[0];
  if (actual.join('|') !== columnas.join('|')) {
    if (hoja.getLastRow() > 1 && actual.some(function (v) { return v !== ''; }))
      throw new Error('La hoja "' + nombre + '" tiene otros encabezados: revisarla antes de usar el script.');
    hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function anotarSolicitud(tipo, tel, local, estado, resuelta) {
  hojaSolicitudes().appendRow([new Date(), tipo, texto(tel), local, estado, resuelta || '']);
}

function buscarCliente(hoja, tel, local) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return 0;
  const datos = hoja.getRange(2, COL['Local'], ultima - 1, COL['Celular'] - COL['Local'] + 1).getValues();
  for (let i = 0; i < datos.length; i++) {
    const f = datos[i];
    if (celular(f[f.length - 1]) === tel && (local === null || String(f[0]).toLowerCase() === local)) return i + 2;
  }
  return 0;
}

function filasDelCelular(hoja, tel) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return [];
  const out = [];
  hoja.getRange(2, COL['Celular'], ultima - 1, 1).getValues().forEach(function (f, i) { if (celular(f[0]) === tel) out.push(i + 2); });
  return out;
}

// Celular chileno en formato +569XXXXXXXX, o null si no lo es.
function celular(s) {
  const d = String(s == null ? '' : s).replace(/\D/g, '').replace(/^56/, '');
  return /^9\d{8}$/.test(d) ? '+56' + d : null;
}

// Texto limpio y seguro para la planilla: sin saltos de línea, de largo acotado y sin que se interprete como fórmula.
function texto(v) {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function fechaValida(v) {
  const f = new Date(v);
  return isNaN(f.getTime()) || f.getTime() > Date.now() + 864e5 ? null : f;
}
