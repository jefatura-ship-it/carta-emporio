/**
 * Registro de clientes y pedidos del Catálogo Sabroso (Emporio Sabroso y Distribuidora Santa Bárbara).
 * Apps Script ligado a la planilla «EM27-0802 Pedidos y clientes Catálogo Sabroso» (antes EM27-07).
 * Recibe lo que envía el catálogo y lo anota. También sirve SabAPP, el panel de pedidos de los vendedores.
 *
 * INSTALACIÓN
 *  1. Abrir la planilla EM27-07 → Extensiones → Apps Script. Pegar este archivo completo.
 *  2. Implementar → Nueva implementación → Aplicación web.
 *     Ejecutar como: yo. Quién tiene acceso: cualquier persona.
 *  3. Copiar la URL que termina en /exec y pegarla en index.html, en REGISTRO_URL.
 *  4. Recargar la planilla: aparece el menú "Registro de clientes".
 *
 * QUÉ RECIBE (JSON enviado como texto por la carta)
 *  registro  {n1, n2, a1, a2, tel, acepta, fecha, local}  crea al cliente (o actualiza solo sus ofertas) y RESPONDE su código
 *
 * PROTECCIONES: tamaño máximo del envío, celular chileno válido, nombres solo con letras, textos sin fórmulas,
 * límite de envíos por minuto y por celular, y un cliente ya registrado no cambia de nombre desde la carta.
 *  uso      {tel, codigo, monto, local}                  anota el descuento de bienvenida usado
 *  baja      {tel, local}                                 deja de recibir ofertas (se aplica de inmediato)
 *  eliminar  {tel, local}                                 solicitud de eliminación (queda pendiente)
 *  pedido    {codigo, nombre, tel?, correo?, codigoCliente?, fechaRetiro, hora, items[], total, nota, local}
 *            anota el pedido enviado desde la carta en "Pedidos" (y sus productos en "Detalle de pedidos")
 *            y deja la planilla ordenada: por día de retiro, primero los de prioridad alta
 *            (cliente frecuente o pedido grande), luego los de más unidades y por hora.
 *            "Por preparar" suma, para cada día desde hoy, cuánto hay que tener listo de cada producto.
 *
 * DESPUÉS DE PEGAR ESTA VERSIÓN: Implementar → Gestionar implementaciones → editar la actual →
 * Versión: "Nueva versión" → Implementar. Así la URL de la carta no cambia.
 *
 * ESTADOS DE UN PEDIDO (columna "Estado", y la casilla "Confirmado" al inicio de cada fila)
 *  Por confirmar → llegó desde el catálogo; aún no se comprueba que el cliente lo envió por el chat.
 *  Confirmado    → el pedido llegó por WhatsApp o Instagram (basta marcar la casilla).
 *  Preparado     → listo para retirar.   Entregado / Anulado → cerrado.
 *  No llegó      → nadie lo confirmó en 24 horas (el cliente abrió el chat pero no lo envió).
 *  "Por preparar" suma solo los pedidos confirmados.
 *
 * PANEL DE PEDIDOS (pantalla en vivo para los PC de los vendedores; archivo HTML "Panel" de este proyecto)
 *  Implementar → Nueva implementación → Aplicación web.
 *    Ejecutar como: yo (dte@avicolasb.com).
 *    Quién tiene acceso: cualquier usuario de Avícola El Huevo Sabroso (cuentas @avicolasb.com).
 *  Solo lo abre quien tiene acceso a esta planilla: para sumar a un vendedor, se le comparte la planilla
 *  (o la unidad compartida) con su cuenta de Google. Se actualiza solo cada pocos segundos.
 *  La implementación pública del catálogo (Ejecutar como: yo) no muestra el panel a nadie más que al dueño.
 *
 * La eliminación NO es automática: cualquiera que conozca un celular podría enviarla.
 * Queda anotada en "Solicitudes" y una persona la confirma con el cliente (por WhatsApp
 * o en el local). Luego escribe SI en la columna "Eliminar (verificado)" de "Clientes"
 * y usa el menú Registro de clientes → Eliminar clientes verificados.
 *
 * CÓDIGO DE CLIENTE
 * Lo asigna esta planilla, no el celular, para que nunca se repita: E-0001, E-0002… en el
 * Emporio y D-0001… en la Distribuidora (un cliente registrado en los dos locales tiene un
 * código en cada uno). Se guarda en la columna "Código de cliente" y se devuelve a la carta
 * en la respuesta: {ok: true, codigo: "E-0001"}. El último número usado queda en las
 * propiedades del script, así que un código de un cliente eliminado no se vuelve a dar.
 * Si alguien anota un cliente a mano, el menú "Asignar códigos faltantes" le pone el suyo.
 *
 * STOCK DEL EMPORIO (desde el 18/11/2026): ver el bloque «Stock del Emporio y aviso de stock bajo» al final.
 *  GET ?stock=emporio → {ok, cerrados:[códigos]}: la carta muestra esos productos «Agotado por ahora».
 *
 * Esta planilla guarda datos personales: compartirla solo con quien la necesita.
 */

const HOJA_CLIENTES = 'Clientes';
const HOJA_SOLICITUDES = 'Solicitudes';
const PREFIJOS = { emporio: 'E', distribuidora: 'D' };
const COLUMNAS_CLIENTES = ['Código de cliente', 'Fecha de registro','Local', 'Primer nombre', 'Segundo nombre', 'Apellido paterno', 'Apellido materno',
  'Celular', 'Acepta ofertas', 'Fecha de baja', 'Descuento usado', 'Código del pedido', 'Monto del descuento',
  'Eliminación solicitada', 'Eliminar (verificado)', 'Actualizado'];
const COLUMNAS_SOLICITUDES = ['Fecha', 'Tipo', 'Celular', 'Local', 'Estado', 'Resuelta el'];
const LOCALES_VALIDOS = ['emporio', 'distribuidora'];
const COL = {}; COLUMNAS_CLIENTES.forEach(function (nombre, i) { COL[nombre] = i + 1; });

function doPost(e) {
  // SabAPP con correo + RUT (www.avicolasb.com/sabapp): su propia puerta, siempre con sesión
  const cuerpoSab = (e && e.postData && e.postData.contents) || '';
  if (cuerpoSab.length < 20000 && /"tipo"\s*:\s*"sabapp"/.test(cuerpoSab)) {
    let r;
    try { r = sabappApi_(JSON.parse(cuerpoSab)); } catch (err) { r = { ok: false, error: String(err && err.message || err) }; }
    return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
  }
  let respuesta = { ok: false };
  const candado = LockService.getScriptLock();
  try {
    candado.waitLock(20000);
    const cuerpo = (e && e.postData && e.postData.contents) || '';
    if (!cuerpo || cuerpo.length > 20000) throw new Error('cuerpo vacío o demasiado largo');
    const d = JSON.parse(cuerpo);
    const tel = celular(d.tel);
    const local = LOCALES_VALIDOS.indexOf(String(d.local || '').toLowerCase()) >= 0 ? String(d.local).toLowerCase() : 'emporio';
    if (d.tipo === 'pedido') {
      limitar(tel || 'pedido-' + local);
      anotarPedido(d, tel, local);
      if (local === LOCAL_STOCK) { try { recalcularStock_({ correo: true }); } catch (err) { /* el pedido ya quedó anotado */ } }
      respuesta = { ok: true };
      return ContentService.createTextOutput(JSON.stringify(respuesta)).setMimeType(ContentService.MimeType.JSON);
    }
    if (cuerpo.length > 4000) throw new Error('cuerpo demasiado largo');
    if (!tel) throw new Error('celular no válido');
    limitar(tel); // contra envíos masivos: máximo por minuto en total y por celular
    respuesta = { ok: true };
    if (d.tipo === 'registro') respuesta.codigo = registrar(d, tel, local);
    else if (d.tipo === 'uso') anotarUso(d, tel, local);
    else if (d.tipo === 'baja') darDeBaja(tel, local);
    else if (d.tipo === 'eliminar') solicitarEliminacion(tel, local);
    else throw new Error('tipo desconocido');
  } catch (err) {
    respuesta = { ok: false, error: String(err && err.message || err) };
  } finally {
    try { candado.releaseLock(); } catch (err) { /* sin candado que soltar */ }
  }
  return ContentService.createTextOutput(JSON.stringify(respuesta)).setMimeType(ContentService.MimeType.JSON);
}

// Vendedores con acceso a la planilla: el Panel de pedidos. Cualquier otra persona: solo el aviso de que responde (sin datos).
function doGet(e) {
  // La carta pregunta qué productos están cerrados en la página por stock bajo (solo códigos, sin datos de nadie)
  if (e && e.parameter && e.parameter.stock) {
    let r;
    try { r = { ok: true, cerrados: stockCerrados_() }; } catch (err) { r = { ok: false }; }
    return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
  }
  if (!vendedor()) return ContentService.createTextOutput('Registro de clientes de la carta: activo.');
  return HtmlService.createHtmlOutputFromFile('Panel')
    .setTitle('SabAPP')
    .setFaviconUrl('https://www.avicolasb.com/img/huevo-sabroso-isotipo.png') // la gallina de Avícola El Huevo Sabroso
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- Tipos ---------- */

function registrar(d, tel, local) {
  const hoja = hojaClientes();
  const ahora = new Date();
  let fila = buscarCliente(hoja, tel, local);
  const acepta = d.acepta === true;
  const nombres = [nombre(d.n1), nombre(d.n2), nombre(d.a1), nombre(d.a2)];
  if (!nombres[0] || !nombres[2]) throw new Error('nombre no válido');
  const nuevo = !fila;
  if (!fila) {
    fila = hoja.getLastRow() + 1;
    hoja.getRange(fila, COL['Fecha de registro']).setValue(fechaValida(d.fecha) || ahora);
    hoja.getRange(fila, COL['Local']).setValue(local);
    hoja.getRange(fila, COL['Celular']).setValue(texto(tel));
  }
  // Un cliente ya registrado no cambia de nombre desde la carta: cualquiera que conozca su celular podría hacerlo.
  // Si de verdad hay que corregirlo, se cambia a mano en la planilla.
  if (nuevo) hoja.getRange(fila, COL['Primer nombre'], 1, 4).setValues([nombres]);
  const antes = hoja.getRange(fila, COL['Acepta ofertas']).getValue();
  hoja.getRange(fila, COL['Acepta ofertas']).setValue(acepta ? 'Sí' : 'No');
  if (acepta) hoja.getRange(fila, COL['Fecha de baja']).clearContent();
  else if (antes === 'Sí') hoja.getRange(fila, COL['Fecha de baja']).setValue(ahora);
  hoja.getRange(fila, COL['Actualizado']).setValue(ahora);
  let codigo = String(hoja.getRange(fila, COL['Código de cliente']).getValue() || '').trim();
  if (!codigo) {
    codigo = nuevoCodigoCliente(hoja, local);
    hoja.getRange(fila, COL['Código de cliente']).setValue(codigo);
  }
  return codigo;
}

// Siguiente código del local (E-0001, D-0001…). Se llama con el candado tomado, así dos registros
// simultáneos no pueden recibir el mismo número.
function nuevoCodigoCliente(hoja, local) {
  const pref = PREFIJOS[local] || 'E';
  const props = PropertiesService.getScriptProperties();
  let ultimo = Number(props.getProperty('ultimo-' + pref)) || 0;
  const n = hoja.getLastRow();
  if (n > 1) hoja.getRange(2, COL['Código de cliente'], n - 1, 1).getValues().forEach(function (f) {
    const m = String(f[0]).match(new RegExp('^' + pref + '-(\\d+)$'));
    if (m) ultimo = Math.max(ultimo, Number(m[1]));
  });
  ultimo += 1;
  props.setProperty('ultimo-' + pref, String(ultimo));
  return pref + '-' + String(ultimo).padStart(4, '0');
}

// Menú: pone código a las filas que no lo tienen (por ejemplo, clientes anotados a mano).
function asignarCodigosFaltantes() {
  const candado = LockService.getScriptLock();
  candado.waitLock(20000);
  let puestos = 0;
  try {
    const hoja = hojaClientes();
    const n = hoja.getLastRow();
    for (let fila = 2; fila <= n; fila++) {
      if (String(hoja.getRange(fila, COL['Código de cliente']).getValue() || '').trim()) continue;
      if (!celular(hoja.getRange(fila, COL['Celular']).getValue())) continue;
      const local = String(hoja.getRange(fila, COL['Local']).getValue() || '').toLowerCase();
      hoja.getRange(fila, COL['Código de cliente']).setValue(nuevoCodigoCliente(hoja, PREFIJOS[local] ? local : 'emporio'));
      puestos++;
    }
  } finally { candado.releaseLock(); }
  SpreadsheetApp.getUi().alert(puestos ? 'Listo: ' + puestos + ' código(s) asignado(s).' : 'Todos los clientes ya tienen código.');
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

/* ---------- Pedidos de la carta ---------- */

const HOJA_PEDIDOS = 'Pedidos';
const HOJA_DETALLE = 'Detalle de pedidos';
const HOJA_PREPARAR = 'Por preparar';
const COLUMNAS_PEDIDOS = ['Confirmado', 'Día de retiro', 'Hora', 'Prioridad', 'Cliente', 'Celular', 'Código de cliente', 'Cliente frecuente',
  'N.º de pedidos del cliente', 'Unidades', 'Total aprox.', 'Productos', 'Comentario', 'Código del pedido', 'Recibido', 'Estado', 'Local', 'Correo', 'Prepara'];
// Quienes pueden preparar pedidos (se eligen en el panel al confirmar). Para sumar o quitar a alguien, editar esta lista.
const VENDEDORES = ['Sofía', 'Isidora', 'Daniela', 'Francisco', 'Sebastián', 'Ingrid', 'David', 'Juan Carlos'];
const ZONA = 'America/Santiago';
const ESTADOS = ['Por confirmar', 'Confirmado', 'Preparado', 'Entregado', 'Anulado', 'No llegó'];
const CONFIRMADOS = ['Confirmado', 'Preparado', 'Entregado']; // estados con la casilla marcada
const HORAS_SIN_CONFIRMAR = 24;
// 23/11/2026: al final van el código de MyPyme de cada línea y lo que cambió SabAPP al editar el pedido («Cantidad pedida» y «Unidades pedidas»
// = lo que pidió el cliente; «Cambio» = motivo, quién y cuándo). «Código de producto» sigue siendo el código interno de la carta.
const COLUMNAS_DETALLE = ['Día de retiro', 'Hora', 'Código del pedido', 'Cliente', 'Producto', 'Código de producto', 'Cantidad', 'Unidades', 'Precio unitario',
  'Código MyPyme', 'Cantidad pedida', 'Unidades pedidas', 'Cambio'];
const DETALLE_ANTES = 9; // columnas que tenía la hoja hasta el 22/11/2026
const CD = {}; COLUMNAS_DETALLE.forEach(function (nombre, i) { CD[nombre] = i + 1; });
const SIN_CODIGO = 'SIN CÓDIGO'; // en «Código MyPyme»: el producto no tiene código en MyPyme
const CP = {}; COLUMNAS_PEDIDOS.forEach(function (nombre, i) { CP[nombre] = i + 1; });
/* Códigos MyPyme (David, 23/11/2026: «vamos a dejar estos códigos» y «ve los códigos de todos los huevos en MyPyme, los editas en la planilla
   y con esa planilla actualizas la página web y SabAPP»; planilla 13 corregida, «Código nuevo» de su «Mapa de Codigos»): la carta manda en cada producto
   su código interno («hasta 18-11») y el de MyPyme. Para las líneas anteriores (sin «Código MyPyme») se traduce con este mapa: código de la carta →
   código MyPyme ("" = no tiene). Si un código no está aquí, es el mismo. Lo genera mapaCodigos13.py (ver CLAUDE.md del repositorio). */
const CODIGOS_MYPYME = {"ABA001":"GRA001","ABA002":"GRA002","ABA003":"GRA003","ABA004":"GRA004","ABA005":"GRA005","ABA006":"GRA006","ABA007":"GRA007","ABA008":"GRA008","ABA009":"GRA009","ABA010":"GRA010","ABA011":"GRA011","ABA012":"","ABA013":"DES001","ABA014":"DES002","ABA015":"DES003","ABA016":"DES004","ABA017":"DES005","ABA018":"GRA012","ABA019":"GRA013","ABA020":"GRA014","ABA021":"GRA015","ABA022":"GRA016","ABA023":"GRA017","ABA024":"GRA018","ABA025":"GRA019","ABA026":"GRA020","ABA027":"GRA021","ABA028":"GRA022","ABA029":"DES006","ABA030":"DES007","ABA031":"GRA023","ABA032":"GRA024","ABA033":"GRA025","ABA034":"GRA026","ABA035":"GRA027","ABA036":"GRA028","ABA037":"GRA029","ABA038":"GRA030","ABA039":"GRA031","ABA040":"GRA032","ABA041":"GRA033","ABA042":"GRA034","ABA043":"GRA035","ABA044":"GRA036","ABA045":"GRA037","ABA046":"GRA038","ABA047":"GRA039","ABA048":"DES008","ABA049":"GRA040","ABA050":"DES009","ABA051":"GRA041","ABA052":"GRA042","ABA053":"GRA043","ABA054":"GRA044","ABA055":"GRA045","ABA056":"GRA046","ABA057":"GRA047","ABA058":"GRA048","ABA059":"GRA049","ABA060":"GRA050","ABA061":"GRA051","ABA062":"GRA052","ABA063":"GRA053","ABA064":"GRA054","ABA065":"GRA055","ABA066":"GRA056","ABA067":"GRA057","ABA068":"GRA058","ABA069":"GRA059","ABA070":"GRA060","ABA071":"GRA061","ABA072":"GRA062","ABA073":"GRA063","ABA074":"GRA064","ABA075":"GRA065","ABA076":"GRA066","ABA077":"GRA067","ABA078":"GRA068","ABA079":"GRA069","ABA080":"GRA070","ABA081":"GRA071","ABA082":"GRA072","ABA083":"GRA073","ABA084":"GRA074","ABA085":"GRA075","ABA086":"GRA076","ABA087":"GRA077","ABA088":"DES010","ABA089":"DES011","ABA090":"DES012","ABA091":"DES013","ABA092":"DES014","ABA093":"DES015","ABA094":"DES016","ABA095":"DES017","ALI-AFRECHILLO":"ALI004","ALI-BICARBONATO":"ALI005","ALI-CONCHUELA":"ALI003","ALI-FINTOX":"ALI007","ALI-FOSFATO-PERUANO":"ALI008","ALI-HARINA-DE-CARNE":"ALI009","ALI-LISINA":"ALI010","ALI-METIONINA":"ALI012","ALI-NUCLEO-POLLITA":"ALI013","ALI-NUCLEO-PONEDORA-NUTRIAL":"","ALI-NUCLEO-PONEDORA-ROVIMIX":"ALI020","ALI-PEPTASAN":"ALI015","ALI-POLIFEED":"ALI016","ALI-SAL":"ALI017","ALI-SOYA":"ALI018","ALI003":"ALI006","ALI004":"ALI011","ANT-BLO013":"","ANT-BOL002":"","ANT-CAR007":"","ANT-CAR012":"","ANT-DES005":"","ANT-DES013":"","ANT-DES036":"","ANT-OTR011":"","ANT-PLA018":"","ANT-PLA027":"","ANT-POT004":"","ANT-POT007":"","ANT-POT017":"","ANT-TAP016":"","ANT-VAS007":"","ANT-VAS022":"","ASE001":"LIM001","ASE002":"LIM002","ASE003":"LIM003","ASE004":"LIM004","ASE005":"LIM005","ASE006":"LIM006","ASE007":"LIM007","ASE008":"LIM008","ASE009":"","ASE010":"LIM009","ASE011":"LIM010","ASE012":"LIM011","ASE013":"LIM012","ASE014":"LIM013","ASE015":"LIM014","ASE016":"LIM015","ASE017":"LIM016","ASE018":"LIM017","ASE019":"LIM018","BLO001":"PAP001","BLO002":"PAP002","BLO003":"PAP003","BLO004":"PAP004","BLO005":"PAP005","BLO006":"PAP006","BLO007":"PAP007","BLO009":"PAP008","BLO010":"PAP009","BOL001":"MER001","BOL002":"PLA001","BOL003":"PLA002","BOL004":"PLA003","BOL005":"PLA004","BOL006":"PLA005","BOL007":"PLA006","BOL008":"PLA007","BOL009":"PAP010","BOL010":"PAP011","BOL011":"PAP012","BOL012":"PLA008","BOL013":"MER002","BOL014":"PLA009","BOL015":"PLA010","BOL016":"PLA011","BOL017":"PLA012","BOL018":"PLA013","BOL019":"PAP013","BOL020":"PAP014","BOL021":"PAP015","BOL022":"PAP016","BOL023":"PAP017","BOL024":"PAP018","BOL025":"MER003","BOL026":"PLA014","BOL027":"PLA015","BOL028":"PLA016","BOL030":"MER004","BOL031":"PAP019","BOL032":"PLA017","BOL033":"PLA018","BOL034":"PAP020","BOL035":"","BOL036":"","BOL037":"","BOL038":"","BOL039":"","BOL040":"","BOL041":"","BOL042":"","BOL043":"PAP021","BOL044":"PAP022","BOL045":"PAP023","BOL046":"","BOL047":"PAP024","BOL048":"PAP025","BOL049":"","BOL050":"PAP026","BOL051":"PAP027","BOL052":"PAP028","BOL053":"PAP029","BOL054":"PAP030","BOL055":"PAP031","BOL056":"PAP032","BOL057":"PLA019","BOL058":"PLA020","BOL059":"PAP033","BOL060":"PAP034","BOL061":"PLA021","BOL062":"PLA022","BOL063":"PLA023","BOL064":"MER010","BOL065":"MER011","BOL066":"MER012","BOL067":"MER013","BOL068":"MER014","BOL069":"MER015","BOL070":"PLA154","BOL071":"PLA155","BOL072":"PLA156","BOL073":"PLA157","BOL074":"PLA158","BOL075":"MER016","BOL076":"MER017","BOL077":"MER018","CAR022":"","CAR023":"CAR021","CAR024":"CAR022","CAR025":"INS005","CAR026":"CAR023","CAR027":"CAR024","CAR028":"CAR025","CAR029":"CAR026","CAR030":"CAR027","CAR032":"CAR028","CAR033":"CAR029","CAR034":"CAR030","CAR035":"CAR031","CAR036":"CAR032","CAR037":"CAR033","CAR038":"CAR034","CAR039":"CAR035","CAR040":"PLA024","CAR041":"CAR036","CAR042":"CAR037","CAR043":"CAR038","CAR044":"CAR039","CAR045":"CAR040","CAR046":"CAR041","CAR047":"CAR042","CAR048":"CAR043","CAR049":"CAR044","CAR051":"CAR045","CAR052":"CAR046","CAR053":"CAR047","CAR054":"CAR048","CAR055":"CAR049","DES001":"PAP035","DES002":"PAP036","DES003":"PAP037","DES004":"PAP038","DES005":"MAD001","DES006":"MAD002","DES007":"MAD003","DES008":"MAD004","DES009":"MAD005","DES010":"LIM019","DES011":"LIM020","DES012":"PLA025","DES014":"MAD006","DES015":"PLA026","DES016":"PLA027","DES017":"PLA028","DES018":"MAD007","DES019":"PLA029","DES020":"PLA030","DES021":"PLA031","DES022":"MAD008","DES023":"PLA032","DES024":"PLA033","DES025":"LIM021","DES026":"LIM022","DES027":"LIM023","DES028":"LIM024","DES029":"LIM025","DES030":"MAD009","DES031":"PLA034","DES032":"MAD010","DES033":"CAR050","DES034":"CAR051","DES036":"CAR052","DES037":"PLA035","DES038":"PLA036","DES039":"PLA037","DES040":"PLA038","DES041":"PLA039","DES042":"MAD011","DES043":"LIM026","DES044":"PLA040","DES045":"MAD012","DES046":"MAD013","DES047":"MAD014","DES048":"PLA041","DES049":"PLA042","DES050":"PLA043","DES051":"MAD015","DES052":"MAD016","DES053":"PLA044","DES054":"LIM027","DES055":"PLA045","HUE001":"INS002","HUE002":"INS004","HUE003":"INS003","HUE004":"HUE001","HUE005":"HUE003","HUE006":"HUE004","HUE007":"HUE006","HUE008":"","HUE009":"HUE007","HUE010":"HUE008","HUE012":"HUE009","HUE013":"HUE010","HUE014":"HUE012","HUE015":"HUE013","HUE016":"HUE014","HUE017":"HUE015","HUE018":"HUE016","HUE019":"HUE017","HUE020":"HUE018","HUE021":"HUE019","HUE024":"","HUE025":"INS001","HUE027":"HUE005","HUE028":"HUE002","HUE029":"HUE020","HUE030":"HUE021","OTR001":"DUL001","OTR003":"MER005","OTR004":"","OTR005":"MER006","OTR006":"LIM028","OTR007":"PLA159","OTR008":"LIM029","OTR009":"LIM030","OTR010":"MER008","OTR011":"MER009","OTR012":"LAC009","OTR013":"LIM031","OTR014":"EQU001","OTR015":"EQU002","OTR016":"EQU003","PLA001":"PLA046","PLA002":"PLA047","PLA003":"PLA048","PLA004":"PLA049","PLA005":"PLA050","PLA006":"PLA051","PLA007":"PLA052","PLA008":"PLA053","PLA009":"PLA054","PLA010":"PLA055","PLA011":"PLA056","PLA012":"CAR063","PLA014":"CAR064","PLA015":"CAR065","PLA016":"CAR066","PLA017":"PLA057","PLA018":"PLA058","PLA019":"PLA059","PLA020":"PLA060","PLA021":"PLA061","PLA022":"PLA062","PLA023":"PLA063","PLA024":"PLA064","PLA025":"PLA065","PLA026":"PLA066","PLA027":"PLA067","PLA028":"PLA068","PLA029":"PLA069","PLA030":"PLA070","PLA031":"PLA071","PLA032":"PLA072","PLA033":"PLA073","PLA034":"PLA074","PLA035":"PLA075","PLA037":"PLA076","PLA038":"PLA077","PLA039":"PLA078","PLA040":"PLA079","PLA041":"PLA080","PLA042":"PLA081","PLA043":"PLA082","PLA044":"PLA083","POT001":"PLA084","POT002":"PLA085","POT003":"CAR067","POT004":"CAR068","POT005":"PLA086","POT006":"PLA087","POT007":"PLA088","POT008":"PLA089","POT009":"PLA090","POT010":"","POT011":"CAR053","POT012":"CAR054","POT013":"PLA091","POT014":"PLA092","POT015":"PLA093","POT016":"PLA094","POT017":"PLA095","POT018":"PLA096","POT019":"PLA097","POT020":"PLA098","POT021":"PLA099","POT022":"PLA100","TAP001":"CAR055","TAP002":"PLA101","TAP003":"PLA102","TAP004":"","TAP005":"ALU024","TAP006":"ALU025","TAP007":"ALU026","TAP008":"CAR056","TAP009":"PLA103","TAP010":"PLA104","TAP011":"PLA105","TAP012":"PLA106","TAP013":"PLA107","TAP014":"PLA108","TAP015":"PLA109","TAP016":"PLA110","TAP017":"PLA111","TAP018":"PLA112","TAP019":"PLA113","TAP020":"INS006","TAP021":"PLA114","TAP022":"PLA115","TAP023":"PLA116","TAP024":"PLA117","TAP025":"ALU027","TAP026":"PLA118","TAP027":"PLA119","TAP028":"PLA120","TAP029":"PLA121","TAP030":"PLA122","TAP031":"PLA123","TAP032":"PLA124","TAP033":"PLA125","TAP034":"PLA126","TAP035":"PLA127","TAP036":"PLA128","TAP037":"PLA129","TAP038":"PLA130","TAP040":"PLA132","TAP041":"PLA133","TAP042":"PLA134","TAP043":"PLA135","VAS001":"PLA138","VAS002":"PLA139","VAS003":"PLA140","VAS004":"PLA141","VAS005":"PLA142","VAS006":"PLA143","VAS007":"MAD018","VAS008":"CAR057","VAS009":"CAR058","VAS010":"PLA144","VAS011":"CAR059","VAS012":"PLA145","VAS013":"PLA146","VAS014":"PLA147","VAS015":"PLA148","VAS016":"PLA149","VAS019":"PLA150","VAS020":"PLA151","VAS021":"PLA152","VAS022":"CAR060","VAS023":"CAR061","VAS024":"CAR062","VAS025":"","VAS026":"PLA153"};
function codigoMyPyme_(cod) {
  const c = String(cod || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(CODIGOS_MYPYME, c) ? CODIGOS_MYPYME[c] : c;
}
// Código MyPyme de una fila de «Detalle de pedidos» ('' si no tiene)
function codigoFilaMyPyme_(f) {
  const g = String(f[CD['Código MyPyme'] - 1] == null ? '' : f[CD['Código MyPyme'] - 1]).trim().toUpperCase();
  if (g === SIN_CODIGO) return '';
  return g || codigoMyPyme_(f[CD['Código de producto'] - 1]);
}
// Lo que manda la carta (desde el 23/11 trae codMyPyme; '' = sin código); si no viene, el mapa
function codigoPedidoMyPyme_(cod, my) {
  const c = my === undefined || my === null ? codigoMyPyme_(cod) : texto(my).toUpperCase().slice(0, 20);
  return c || SIN_CODIGO;
}

// Prioridad alta: cliente frecuente (3 pedidos o más) o pedido grande
const FRECUENTE_DESDE = 3, UNIDADES_GRANDE = 180, TOTAL_GRANDE = 50000;
const EN_LOCAL = 'Estoy en el local'; // hora que elige en el catálogo el cliente que ya está en el Emporio

function anotarPedido(d, tel, local) {
  const codigo = String(d.codigo || '').trim();
  if (!/^[A-Z]{1,3}\d{4}-\d{4}$/.test(codigo)) throw new Error('código de pedido no válido');
  const fecha = fechaRetiro(d.fechaRetiro);
  if (!fecha) throw new Error('día de retiro no válido');
  const hoja = hojaPedidos();
  const n = hoja.getLastRow();
  const filas = n > 1 ? hoja.getRange(2, 1, n - 1, COLUMNAS_PEDIDOS.length).getValues() : [];
  if (filas.some(function (f) { return String(f[CP['Código del pedido'] - 1]) === codigo; })) return; // ya anotado
  const cliente = texto(String(d.nombre || '').replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9' .-]/g, ' ')) || '(sin nombre)';
  const codCli = /^[ED]-(P)?\d{4,}$/.test(String(d.codigoCliente || '')) ? String(d.codigoCliente) : '';
  const its = (Array.isArray(d.items) ? d.items : []).slice(0, 100).map(function (x) {
    return { cod: texto(x.cod).slice(0, 20), nombre: textoLargo(x.nombre, 140), q: entero(x.q, 100000), uds: entero(x.uds, 1000000),
      precio: x.precio == null || x.precio === '' ? '' : entero(x.precio, 10000000),
      tapa: texto(x.tapa).slice(0, 20), tapaNombre: textoLargo(x.tapaNombre, 100),
      my: codigoPedidoMyPyme_(x.cod, x.codMyPyme), tapaMy: x.tapa ? codigoPedidoMyPyme_(x.tapa, x.tapaMyPyme) : '' };
  }).filter(function (x) { return x.q > 0; });
  if (!its.length) throw new Error('pedido vacío');
  const unidades = its.reduce(function (a, x) { return a + (x.uds || x.q); }, 0);
  const total = entero(d.total, 100000000);
  // Cliente frecuente: cuenta sus pedidos anteriores (por celular; si no dejó, por nombre)
  const previos = filas.filter(function (f) {
    return tel ? celular(f[CP['Celular'] - 1]) === tel : String(f[CP['Cliente'] - 1]).toLowerCase() === cliente.toLowerCase();
  }).length;
  const veces = previos + 1;
  const frecuente = veces >= FRECUENTE_DESDE ? 'Sí' : 'No';
  const hora = texto(d.hora).slice(0, 20) || 'Lo antes posible';
  // «Estoy en el local»: el cliente espera en el mesón, se atiende primero
  const alta = hora === EN_LOCAL || frecuente === 'Sí' || unidades >= UNIDADES_GRANDE || total >= TOTAL_GRANDE;
  hoja.appendRow([false, fecha, hora, alta ? 'Alta' : 'Normal', cliente, tel ? texto(tel) : '', codCli, frecuente, veces, unidades, total || '',
    textoLargo(its.map(function (x) { return x.q + ' × ' + x.nombre; }).join(' · '), 2000), textoLargo(d.nota, 300), codigo, new Date(), 'Por confirmar', local, correoValido(d.correo), '']);
  hoja.getRange(hoja.getLastRow(), CP['Confirmado']).setDataValidation(casilla());
  const lineas = [];
  its.forEach(function (x) {
    lineas.push([fecha, hora, codigo, cliente, x.nombre, x.cod, x.q, x.uds || x.q, x.precio, x.my, '', '', '']);
    if (x.tapa) lineas.push([fecha, hora, codigo, cliente, '↳ ' + (x.tapaNombre || 'Tapa') + ' (va con el envase)', x.tapa, x.uds || x.q, x.uds || x.q, '', x.tapaMy, '', '', '']);
  });
  hojaDetalle().getRange(hojaDetalle().getLastRow() + 1, 1, lineas.length, COLUMNAS_DETALLE.length).setValues(lineas);
  // Si ahora es frecuente, sus pedidos pendientes también pasan a prioridad alta
  if (frecuente === 'Sí' && filas.length) filas.forEach(function (f, i) {
    const mismo = tel ? celular(f[CP['Celular'] - 1]) === tel : String(f[CP['Cliente'] - 1]).toLowerCase() === cliente.toLowerCase();
    if (mismo) hoja.getRange(i + 2, CP['Prioridad'], 1, CP['Cliente frecuente'] - CP['Prioridad'] + 1)
      .setValues([['Alta', f[CP['Cliente'] - 1], f[CP['Celular'] - 1], f[CP['Código de cliente'] - 1], 'Sí']]);
  });
  vencerPendientes(hoja);
  ordenarPedidos();
}

// Deja "Pedidos" ordenada: día de retiro, prioridad (Alta primero), más unidades, hora. Y el detalle por día y pedido.
function ordenarPedidos() {
  const hoja = hojaPedidos(), n = hoja.getLastRow();
  if (n > 2) hoja.getRange(2, 1, n - 1, COLUMNAS_PEDIDOS.length).sort([
    { column: CP['Día de retiro'], ascending: true }, { column: CP['Prioridad'], ascending: true },
    { column: CP['Unidades'], ascending: false }, { column: CP['Hora'], ascending: true }]);
  const det = hojaDetalle(), m = det.getLastRow();
  if (m > 2) det.getRange(2, 1, m - 1, COLUMNAS_DETALLE.length).sort([{ column: 1, ascending: true }, { column: 3, ascending: true }]);
}

function hojaPedidos() {
  migrarPedidos();
  const hoja = hojaCon(HOJA_PEDIDOS, COLUMNAS_PEDIDOS);
  const n = hoja.getLastRow();
  if (n > 1) hoja.getRange(2, CP['Confirmado'], n - 1, 1).setDataValidation(casilla());
  if (!hoja.getConditionalFormatRules().length) formatoPedidos(hoja);
  return hoja;
}

// Formato (una vez): fechas legibles, estado con lista, colores por estado, día y prioridad.
// En Sheets manda la primera regla que se cumple: primero las de una celda, después las de la fila.
function formatoPedidos(hoja) {
  const col = function (nombre) { const l = letra(CP[nombre]); return hoja.getRange(l + '2:' + l); };
  col('Día de retiro').setNumberFormat('dddd dd/mm/yyyy');
  col('Recibido').setNumberFormat('dd/mm/yyyy hh:mm');
  col('Total aprox.').setNumberFormat('$#,##0');
  col('Productos').setWrap(true);
  hoja.setColumnWidth(CP['Productos'], 420);
  hoja.setColumnWidth(CP['Confirmado'], 100);
  hoja.getRange(1, CP['Confirmado']).setNote('Marque la casilla cuando el pedido llegó por WhatsApp o Instagram.');
  col('Estado').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).build());
  const fila = hoja.getRange('A2:' + letra(COLUMNAS_PEDIDOS.length));
  const e = '$' + letra(CP['Estado']) + '2', d = '$' + letra(CP['Día de retiro']) + '2';
  const regla = function () { return SpreadsheetApp.newConditionalFormatRule(); };
  hoja.setConditionalFormatRules([
    regla().whenTextEqualTo('Por confirmar').setBackground('#fde3cf').setFontColor('#8a3a00').setBold(true).setRanges([col('Estado')]).build(),
    regla().whenTextEqualTo('Confirmado').setBackground('#d9efe0').setFontColor('#1d5c36').setBold(true).setRanges([col('Estado')]).build(),
    regla().whenTextEqualTo('Alta').setFontColor('#b3261e').setBold(true).setRanges([col('Prioridad')]).build(),
    regla().whenTextEqualTo('Sí').setBold(true).setFontColor('#1d5c36').setRanges([col('Cliente frecuente')]).build(),
    regla().whenFormulaSatisfied('=OR(' + e + '="Entregado",' + e + '="Anulado",' + e + '="No llegó")').setFontColor('#9a9a92').setRanges([fila]).build(),
    regla().whenFormulaSatisfied('=AND(' + d + '<>"",' + d + '<TODAY())').setBackground('#eeeeee').setRanges([fila]).build(),
    regla().whenFormulaSatisfied('=' + d + '=TODAY()').setBackground('#fff2c2').setRanges([fila]).build(),
    regla().whenFormulaSatisfied('=' + d + '=TODAY()+1').setBackground('#e3f1dc').setRanges([fila]).build()
  ]);
}

// Una sola vez: pasa la planilla a la hora de Chile y agrega la casilla «Confirmado» a la hoja de la versión anterior.
function migrarPedidos() {
  corregirZonaHoraria();
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PEDIDOS);
  if (!hoja) return;
  const total = COLUMNAS_PEDIDOS.length, max = hoja.getMaxColumns();
  if (max < total) hoja.insertColumnsAfter(max, total - max);
  // Los títulos se leen de una vez (el panel pasa por aquí cada 12 segundos)
  const cab = hoja.getRange(1, 1, 1, total).getValues()[0].map(String);
  const t = function (nombre) { return cab[CP[nombre] - 1]; };
  const poner = function (nombre) { hoja.getRange(1, CP[nombre]).setValue(nombre).setFontWeight('bold'); cab[CP[nombre] - 1] = nombre; };
  // Hoja ya con «Confirmado» pero sin «Correo» (versión del 14/11): se agrega al final
  if (cab[0] === 'Confirmado' && t('Correo') === '' && t('Local') === 'Local') poner('Correo');
  // Hoja sin «Prepara» (quién prepara el pedido): se agrega al final, después de «Correo»
  if (cab[0] === 'Confirmado' && t('Correo') === 'Correo' && t('Prepara') === '') poner('Prepara');
  if (cab[0] !== 'Día de retiro') return;
  hoja.insertColumnBefore(1);
  hoja.getRange(1, 1).setValue('Confirmado').setFontWeight('bold');
  hoja.getRange(1, CP['Correo']).setValue('Correo').setFontWeight('bold');
  hoja.getRange(1, CP['Prepara']).setValue('Prepara').setFontWeight('bold');
  hoja.clearConditionalFormatRules(); // se rehacen con las columnas nuevas
  hoja.getRange(2, CP['Estado'], hoja.getMaxRows() - 1, 1).clearDataValidations();
  const n = hoja.getLastRow();
  if (n > 1) {
    const est = hoja.getRange(2, CP['Estado'], n - 1, 1), v = est.getValues().map(function (f) { return [f[0] === 'Pendiente' ? 'Por confirmar' : f[0]]; });
    est.setValues(v);
    hoja.getRange(2, CP['Confirmado'], n - 1, 1).setValues(v.map(function (f) { return [CONFIRMADOS.indexOf(f[0]) >= 0]; }));
  }
}

// La planilla nació con la hora del Pacífico de EE. UU.: «Recibido» salía 5 horas antes y el día de retiro, un día antes.
// Se leen las fechas (quedan como instantes correctos), se cambia la zona a Chile y se vuelven a escribir.
function corregirZonaHoraria() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  if (libro.getSpreadsheetTimeZone() === ZONA) return false;
  const columnas = {};
  columnas[HOJA_PEDIDOS] = ['Día de retiro', 'Recibido'];
  columnas[HOJA_DETALLE] = ['Día de retiro'];
  columnas[HOJA_CLIENTES] = ['Fecha de registro', 'Fecha de baja', 'Descuento usado', 'Eliminación solicitada', 'Actualizado'];
  columnas[HOJA_SOLICITUDES] = ['Fecha', 'Resuelta el'];
  const guardadas = [];
  Object.keys(columnas).forEach(function (nombreHoja) {
    const hoja = libro.getSheetByName(nombreHoja);
    if (!hoja || hoja.getLastRow() < 2) return;
    const cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    columnas[nombreHoja].forEach(function (titulo) {
      const c = cab.indexOf(titulo) + 1;
      if (!c) return;
      const r = hoja.getRange(2, c, hoja.getLastRow() - 1, 1);
      guardadas.push({ r: r, v: r.getValues() });
    });
  });
  libro.setSpreadsheetTimeZone(ZONA);
  guardadas.forEach(function (g) { g.r.setValues(g.v); });
  return true;
}

// Pedidos «Por confirmar» con más de 24 horas: el cliente abrió el chat pero el pedido nunca llegó.
function vencerPendientes(hoja) {
  const n = hoja.getLastRow();
  if (n < 2) return 0;
  const v = hoja.getRange(2, 1, n - 1, COLUMNAS_PEDIDOS.length).getValues();
  const limite = Date.now() - HORAS_SIN_CONFIRMAR * 3600e3;
  let vencidos = 0;
  v.forEach(function (f, i) {
    const rec = f[CP['Recibido'] - 1];
    if (f[CP['Estado'] - 1] === 'Por confirmar' && rec instanceof Date && rec.getTime() < limite) {
      hoja.getRange(i + 2, CP['Estado']).setValue('No llegó');
      vencidos++;
    }
  });
  return vencidos;
}

function casilla() { return SpreadsheetApp.newDataValidation().requireCheckbox().build(); }
function letra(n) { return String.fromCharCode(64 + n); } // columnas A a Z

// Al marcar la casilla, el estado pasa a «Confirmado» (y al revés); al elegir un estado, la casilla lo acompaña.
function onEdit(e) {
  const r = e && e.range;
  if (!r || r.getNumRows() !== 1 || r.getNumColumns() !== 1 || r.getRow() < 2) return;
  const hoja = r.getSheet();
  if (hoja.getName() === HOJA_STOCK && [CS['Stock ideal'], CS['Stock MyPyme']].indexOf(r.getColumn()) >= 0) {
    try { recalcularStock_({ correo: false }); } catch (err) { /* se recalcula en el próximo pedido */ }
    return;
  }
  if (hoja.getName() !== HOJA_PEDIDOS || String(hoja.getRange(1, 1).getValue()) !== 'Confirmado') return;
  const fila = r.getRow();
  if (r.getColumn() === CP['Confirmado']) {
    const est = hoja.getRange(fila, CP['Estado']), v = est.getValue();
    if (r.getValue() === true && (v === 'Por confirmar' || v === 'No llegó' || v === '')) est.setValue('Confirmado');
    if (r.getValue() === false && v === 'Confirmado') est.setValue('Por confirmar');
  } else if (r.getColumn() === CP['Estado']) {
    hoja.getRange(fila, CP['Confirmado']).setValue(CONFIRMADOS.indexOf(r.getValue()) >= 0);
  }
}

function hojaDetalle() {
  const vieja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_DETALLE);
  if (vieja) { // hasta el 22/11/2026 tenía 9 columnas: se agregan las nuevas al final (una vez)
    if (vieja.getMaxColumns() < COLUMNAS_DETALLE.length) vieja.insertColumnsAfter(vieja.getMaxColumns(), COLUMNAS_DETALLE.length - vieja.getMaxColumns());
    const cab = vieja.getRange(1, 1, 1, COLUMNAS_DETALLE.length).getValues()[0];
    if (COLUMNAS_DETALLE.slice(0, DETALLE_ANTES).every(function (c, i) { return cab[i] === c; }) && cab.slice(DETALLE_ANTES).every(function (v) { return v === ''; }))
      vieja.getRange(1, DETALLE_ANTES + 1, 1, COLUMNAS_DETALLE.length - DETALLE_ANTES).setValues([COLUMNAS_DETALLE.slice(DETALLE_ANTES)]).setFontWeight('bold');
  }
  const hoja = hojaCon(HOJA_DETALLE, COLUMNAS_DETALLE);
  hoja.getRange('A2:A').setNumberFormat('dddd dd/mm/yyyy');
  return hoja;
}

// Totales por día y producto desde hoy (se actualiza solo con una fórmula)
function hojaPorPreparar() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = libro.getSheetByName(HOJA_PREPARAR) || libro.insertSheet(HOJA_PREPARAR);
  const formula = formulaPorPreparar();
  if (hoja.getRange('A1').getFormula() !== formula) {
    hoja.getRange('A1').setFormula(formula);
    hoja.getRange('A:A').setNumberFormat('dddd dd/mm/yyyy');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

// Totales por día y producto desde hoy, solo de los pedidos en estado «Confirmado» (los «Por confirmar» quizá nunca lleguen)
function formulaPorPreparar() {
  const det = "'" + HOJA_DETALLE + "'", cod = letra(CP['Código del pedido']), est = letra(CP['Estado']);
  return '=IFERROR(QUERY(FILTER(' + det + '!A2:I, ISNUMBER(MATCH(' + det + '!C2:C, FILTER(' + HOJA_PEDIDOS + '!' + cod + '2:' + cod + ', '
    + HOJA_PEDIDOS + '!' + est + '2:' + est + '="Confirmado"), 0))), "select Col1, Col5, sum(Col7), sum(Col8) where Col1 >= date \'"&TEXT(TODAY(),"yyyy-mm-dd")&"\' '
    + 'group by Col1, Col5 order by Col1, sum(Col8) desc label Col1 \'Día de retiro\', Col5 \'Producto\', sum(Col7) \'Cantidad\', sum(Col8) \'Unidades\'", 0), '
    + '"Aún no hay pedidos confirmados por preparar")';
}

// "AAAA-MM-DD" entre hoy y 60 días más; null si no
function fechaRetiro(v) {
  const s = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const medianoche = function (iso) { return Utilities.parseDate(iso + ' 00:00', ZONA, 'yyyy-MM-dd HH:mm'); };
  const f = medianoche(s);
  if (isNaN(f.getTime()) || Utilities.formatDate(f, ZONA, 'yyyy-MM-dd') !== s) return null;
  const hoy = medianoche(Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd'));
  if (f < hoy || f.getTime() > hoy.getTime() + 60 * 864e5) return null;
  return f;
}
function entero(v, max) { const n = Math.round(Number(v) || 0); return Math.max(0, Math.min(max, n)); }
// Texto más largo (productos, comentario): igual de seguro que texto() pero con otro largo máximo
function textoLargo(v, max) {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/* ---------- Menú de la planilla ---------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Registro de clientes')
    .addItem('Eliminar clientes verificados', 'eliminarVerificados')
    .addItem('Asignar códigos faltantes', 'asignarCodigosFaltantes')
    .addItem('Preparar hojas', 'prepararHojas')
    .addSeparator()
    .addItem('Ordenar pedidos', 'ordenarPedidos')
    .addToUi();
  SpreadsheetApp.getUi().createMenu('SabAPP')
    .addItem('Trabajadores (correo y RUT)', 'abrirTrabajadores')
    .addToUi();
  SpreadsheetApp.getUi().createMenu('Stock del Emporio')
    .addItem('Cargar stock de MyPyme (pegado en «Carga MyPyme»)', 'cargarStockMyPyme')
    .addItem('Recalcular ahora', 'recalcularStockMenu')
    .addSeparator()
    .addItem('Cerrar en la página el producto elegido', 'stockCerrarElegido')
    .addItem('Pedir de inmediato el producto elegido', 'stockPedirElegido')
    .addItem('Reabrir en la página el producto elegido', 'stockReabrirElegido')
    .addSeparator()
    .addItem('Preparar hojas de stock', 'prepararHojasStock')
    .addToUi();
  try { vencerPendientes(hojaPedidos()); } catch (err) { /* sin permiso de edición: solo se ve */ }
}

function prepararHojas() { hojaClientes(); hojaSolicitudes(); hojaPedidos(); hojaDetalle(); hojaPorPreparar(); prepararHojasStock(); }

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

// Límite de envíos (CacheService): 40 por minuto en total y 4 cada 10 minutos por celular.
function limitar(tel) {
  const cache = CacheService.getScriptCache();
  const minuto = 'min-' + Math.floor(Date.now() / 60000), porTel = 'tel-' + tel;
  const total = Number(cache.get(minuto)) || 0, delTel = Number(cache.get(porTel)) || 0;
  if (total >= 40 || delTel >= 4) throw new Error('demasiados envíos, intenta más tarde');
  cache.put(minuto, String(total + 1), 120);
  cache.put(porTel, String(delTel + 1), 600);
}

// Nombre o apellido: solo letras (con tildes), espacios, apóstrofo y guion; entre 2 y 40 caracteres. Vacío si no cumple.
function nombre(v) {
  const s = texto(v).slice(0, 40);
  return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,40}$/.test(s) ? s : '';
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

// Correo con forma nombre@dominio.ext (máximo 80 caracteres), en minúsculas; vacío si no cumple.
function correoValido(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase().slice(0, 80);
  return /^[^\s@<>"',;:()\[\]]+@[^\s@<>"',;:()\[\]]+\.[a-z]{2,}$/.test(s) ? s : '';
}

function fechaValida(v) {
  const f = new Date(v);
  return isNaN(f.getTime()) || f.getTime() > Date.now() + 864e5 ? null : f;
}

/* ---------- Panel de pedidos (vendedores) ---------- */

// Correo de quien abre el panel. El panel corre con la cuenta dueña del script (dte@) y solo deja entrar a cuentas
// del mismo dominio de Google Workspace (avicolasb.com): Google entrega ese correo solo a usuarios del dominio.
// Un visitante anónimo o de otra cuenta queda fuera (también en la implementación pública del catálogo).
function vendedor() {
  let activo = '', efectivo = '';
  try { activo = Session.getActiveUser().getEmail(); efectivo = Session.getEffectiveUser().getEmail(); } catch (err) { return ''; }
  if (!activo || !efectivo) return '';
  const dominio = function (c) { return String(c).toLowerCase().split('@')[1] || ''; };
  if (activo !== efectivo && dominio(activo) !== dominio(efectivo)) return '';
  try { SpreadsheetApp.getActiveSpreadsheet().getId(); } catch (err) { return ''; }
  return activo;
}
function exigirVendedor() {
  const u = vendedor();
  if (!u) throw new Error('Sin acceso: abra el panel con una cuenta que tenga acceso a la planilla de pedidos.');
  return u;
}

/* ---------- SabAPP con correo + RUT (www.avicolasb.com/sabapp) ----------
   Cada trabajador entra con su correo y su RUT. Los registra jefatura@ desde la planilla (menú «SabAPP» › «Trabajadores»).
   Se guardan en las propiedades del script (no en la planilla ni en el código): del RUT queda solo una huella (SHA-256 con sal).
   El PC guarda una sesión de 30 días, no el RUT. 5 intentos fallidos bloquean esa cuenta 15 minutos.
   La página habla con el script solo por sabappApi_ (doPost), que exige la sesión en cada acción. */
const ADMINS_SABAPP = ['jefatura@avicolasb.com'];
const SESION_DIAS = 30, FALLOS_MAX = 5, BLOQUEO_MIN = 15, SESIONES_MAX = 80;

function propsJson_(clave) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(clave) || '{}') || {}; } catch (err) { return {}; }
}
function guardarJson_(clave, v) { PropertiesService.getScriptProperties().setProperty(clave, JSON.stringify(v)); }
function normCorreo_(c) { return String(c || '').trim().toLowerCase().slice(0, 80); }
function normRut_(r) { return String(r || '').toUpperCase().replace(/[^0-9K]/g, ''); }
function dvRut_(cuerpo) {
  let suma = 0, m = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) { suma += Number(cuerpo[i]) * m; m = m === 7 ? 2 : m + 1; }
  const dv = 11 - (suma % 11);
  return dv === 11 ? '0' : dv === 10 ? 'K' : String(dv);
}
// RUT para guardar: el número sin puntos, guion ni dígito verificador ('' si no sirve).
// Sin guion se toma tal cual (ej. 20629263); con guion se revisa el dígito (20.629.263-K).
function cuerpoRut_(r) {
  const txt = String(r || '').toUpperCase().trim();
  if (txt.indexOf('-') >= 0) {
    const p = txt.split('-'), cuerpo = normRut_(p[0]), dv = normRut_(p[1]);
    return /^\d{7,8}$/.test(cuerpo) && dvRut_(cuerpo) === dv ? cuerpo : '';
  }
  const s = normRut_(txt);
  if (/^\d{7,8}$/.test(s)) return s;
  if (/^\d{7,8}[0-9K]$/.test(s) && dvRut_(s.slice(0, -1)) === s.slice(-1)) return s.slice(0, -1);
  return '';
}
// Al entrar: las formas posibles de lo que escribió (tal cual, sin el dígito verificador, o la parte antes del guion)
function variantesRut_(r) {
  const txt = String(r || '').toUpperCase().trim(), s = normRut_(txt), v = [];
  if (!s) return v;
  v.push(s);
  if (txt.indexOf('-') >= 0) v.push(normRut_(txt.split('-')[0]));
  if (/^\d{7,8}[0-9K]$/.test(s) && dvRut_(s.slice(0, -1)) === s.slice(-1)) v.push(s.slice(0, -1));
  return v;
}
function salSabapp_() {
  const p = PropertiesService.getScriptProperties();
  let sal = p.getProperty('SABAPP_SAL');
  if (!sal) { sal = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SABAPP_SAL', sal); }
  return sal;
}
// Clave para guardar: si parece RUT, el número (sin puntos, guion ni dígito); si no, el texto en minúsculas
function claveNormal_(clave) { return cuerpoRut_(clave) || String(clave || '').trim().toLowerCase(); }
// Al entrar: todas las formas posibles de lo que escribió (como RUT y como texto)
function variantesClave_(clave) {
  const v = variantesRut_(clave), t = String(clave || '').trim().toLowerCase();
  if (t && v.indexOf(t) < 0) v.push(t);
  return v;
}
function huellaRut_(correo, rut) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    salSabapp_() + ':' + normCorreo_(correo) + ':' + String(rut == null ? '' : rut), Utilities.Charset.UTF_8)); // el valor ya viene normalizado (claveNormal_ / variantesClave_)
}

// Ingreso: correo + RUT → sesión para este PC
function sabappIngresar_(correo, rut) {
  const c = normCorreo_(correo);
  if (!c || !String(rut || '').trim()) throw new Error('Escriba su correo y su clave.');
  const candado = LockService.getScriptLock();
  candado.waitLock(15000);
  try {
    const fallos = propsJson_('SABAPP_FALLOS'), f = fallos[c] || { n: 0, hasta: 0 };
    if (f.hasta > Date.now()) throw new Error('Cuenta bloqueada por intentos fallidos: espere ' + Math.ceil((f.hasta - Date.now()) / 60000) + ' min.');
    const u = propsJson_('SABAPP_USUARIOS')[c];
    const coincide = !!u && variantesClave_(rut).some(function (v) { return huellaRut_(c, v) === u.hash; });
    if (!coincide) {
      f.n = (f.n || 0) + 1;
      if (f.n >= FALLOS_MAX) { f.hasta = Date.now() + BLOQUEO_MIN * 60000; f.n = 0; }
      fallos[c] = f;
      guardarJson_('SABAPP_FALLOS', fallos);
      Utilities.sleep(1200);
      throw new Error(f.hasta > Date.now() ? 'Demasiados intentos: la cuenta quedó bloqueada ' + BLOQUEO_MIN + ' minutos.' : 'Correo o clave incorrectos.');
    }
    if (fallos[c]) { delete fallos[c]; guardarJson_('SABAPP_FALLOS', fallos); }
    const ahora = Date.now(), ses = propsJson_('SABAPP_SESIONES');
    Object.keys(ses).forEach(function (t) { if (!(ses[t].vence > ahora)) delete ses[t]; });
    const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
    ses[token] = { correo: c, vence: ahora + SESION_DIAS * 864e5 };
    const orden = Object.keys(ses).sort(function (a, b) { return ses[b].vence - ses[a].vence; });
    orden.slice(SESIONES_MAX).forEach(function (t) { delete ses[t]; });
    guardarJson_('SABAPP_SESIONES', ses);
    return { token: token, nombre: u.nombre, cambiar: !!u.cambiar };
  } finally { candado.releaseLock(); }
}
function sabappSalir_(token) {
  const candado = LockService.getScriptLock();
  candado.waitLock(15000);
  try { const ses = propsJson_('SABAPP_SESIONES'); if (ses[token]) { delete ses[token]; guardarJson_('SABAPP_SESIONES', ses); } }
  finally { candado.releaseLock(); }
}
// Trabajador de una sesión vigente: { correo, nombre, admin } (null si no hay)
function sesionUsuario_(token) {
  if (!/^[0-9a-f]{64}$/.test(String(token || ''))) return null;
  const s = propsJson_('SABAPP_SESIONES')[token];
  if (!s || !(s.vence > Date.now())) return null;
  const u = propsJson_('SABAPP_USUARIOS')[s.correo];
  return u ? { correo: s.correo, nombre: u.nombre, admin: !!u.admin, cambiar: !!u.cambiar } : null;
}
function usuarioSesion_(token) { const u = sesionUsuario_(token); return u ? u.nombre : ''; }
// Todo lo que pide la página de SabAPP pasa por aquí
function sabappApi_(d) {
  if (d.accion === 'ingresar') { const r = sabappIngresar_(d.correo, d.clave || d.rut); return { ok: true, token: r.token, nombre: r.nombre, cambiar: r.cambiar }; }
  if (d.accion === 'salir') { sabappSalir_(d.token); return { ok: true }; }
  const yo = sesionUsuario_(d.token);
  if (!yo) return { ok: false, error: 'Sin acceso: su sesión terminó. Ingrese con su correo y su clave.' };
  if (d.accion === 'cambiarClave') { cambiarClave_(yo.correo, d.actual, d.nueva); return { ok: true }; }
  if (yo.cambiar) return { ok: false, cambiar: true, error: 'Antes de seguir, cree su clave nueva.' };
  const a = Array.isArray(d.args) ? d.args : [];
  const conRol = function (datos) { datos.admin = yo.admin; datos.correo = yo.correo; return { ok: true, datos: datos }; };
  if (d.accion === 'datos') return conRol(panelDatos_(yo.nombre));
  if (d.accion === 'cambiar') return conRol(panelCambiar_(yo.nombre, a[0], a[1], a[2], a[3], a[4]));
  if (d.accion === 'asignar') return conRol(panelAsignar_(yo.nombre, a[0], a[1], a[2]));
  if (d.accion === 'avisado') return conRol(panelAvisado_(yo.nombre, a[0], a[1]));
  if (d.accion === 'editar') return conRol(panelEditar_(yo.nombre, a[0], a[1]));
  if (d.accion === 'stock') {
    if (!yo.admin) return { ok: false, error: 'Solo un administrador de SabAPP decide sobre el stock.' };
    const oc = stockDecidir_(yo.nombre, a[0], a[1]), datos = panelDatos_(yo.nombre);
    if (oc) datos.oc = oc;
    return conRol(datos);
  }
  // Panel de administrador (solo trabajadores con rol de administrador)
  if (['trabajadores', 'guardarTrabajador', 'quitarTrabajador', 'cerrarSesiones'].indexOf(d.accion) >= 0) {
    if (!yo.admin) return { ok: false, error: 'Solo un administrador de SabAPP puede hacer esto.' };
    const c = normCorreo_(a[0] && d.accion !== 'guardarTrabajador' ? a[0] : a[1]);
    if (d.accion === 'guardarTrabajador' && c === yo.correo && !a[3]) throw new Error('No puede quitarse a sí mismo el rol de administrador.');
    if (d.accion === 'quitarTrabajador' && c === yo.correo) throw new Error('No puede quitarse a sí mismo.');
    let lista;
    if (d.accion === 'trabajadores') lista = listaTrabajadores_();
    if (d.accion === 'guardarTrabajador') lista = guardarTrabajador_(a[0], a[1], a[2], a[3], a[4]);
    if (d.accion === 'quitarTrabajador') lista = quitarTrabajador_(a[0]);
    if (d.accion === 'cerrarSesiones') lista = cerrarSesiones_(a[0], d.token);
    return { ok: true, lista: lista, yo: yo.correo };
  }
  return { ok: false, error: 'Acción no válida.' };
}

// Administración de trabajadores (solo jefatura@, desde la planilla)
function exigirAdmin_() {
  const e = normCorreo_(Session.getActiveUser().getEmail());
  if (ADMINS_SABAPP.indexOf(e) < 0) throw new Error('Solo ' + ADMINS_SABAPP.join(', ') + ' puede administrar los trabajadores de SabAPP.');
  return e;
}
function abrirTrabajadores() {
  try { exigirAdmin_(); } catch (err) { SpreadsheetApp.getUi().alert(err.message); return; }
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(htmlTrabajadores_()).setWidth(560).setHeight(600), 'SabAPP · Trabajadores');
}
function trabajadoresLista() { exigirAdmin_(); return listaTrabajadores_(); }
function trabajadorGuardar(nombre, correo, clave, admin, cambiar) { exigirAdmin_(); return guardarTrabajador_(nombre, correo, clave, admin, cambiar); }
function trabajadorQuitar(correo) { exigirAdmin_(); return quitarTrabajador_(correo); }

function listaTrabajadores_() {
  const u = propsJson_('SABAPP_USUARIOS'), ses = propsJson_('SABAPP_SESIONES'), ahora = Date.now();
  return Object.keys(u).map(function (c) {
    const abiertas = Object.keys(ses).filter(function (t) { return ses[t].correo === c && ses[t].vence > ahora; }).length;
    return { correo: c, nombre: u[c].nombre, admin: !!u[c].admin, cambiar: !!u[c].cambiar, sesiones: abiertas };
  }).sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
}
// Crea o actualiza un trabajador. Al editar, la clave puede quedar en blanco (se mantiene la que tenía).
// clave: temporal de letras (o un RUT); cambiar: true = al entrar debe crear su propia clave.
function guardarTrabajador_(nombre, correo, clave, admin, cambiar) {
  const n = String(nombre || '').replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const c = correoValido(correo);
  if (n.length < 2) throw new Error('Escriba el nombre del trabajador.');
  if (!c) throw new Error('El correo no es válido.');
  const candado = LockService.getScriptLock();
  candado.waitLock(15000);
  try {
    const u = propsJson_('SABAPP_USUARIOS'), antes = u[c];
    let hash = antes ? antes.hash : '', debeCambiar = !!(antes && antes.cambiar), nueva = false;
    if (String(clave || '').trim()) {
      const cn = claveNormal_(clave);
      if (cn.length < 6) throw new Error('La clave debe tener al menos 6 letras (o ser un RUT).');
      hash = huellaRut_(c, cn); debeCambiar = cambiar === true; nueva = true;
    }
    if (!hash) throw new Error('Escriba una clave temporal para el trabajador.');
    u[c] = { nombre: n, hash: hash, alta: antes && antes.alta || Date.now(), admin: admin === true, cambiar: debeCambiar };
    guardarJson_('SABAPP_USUARIOS', u);
    if (nueva && antes) { // clave reiniciada: se cierran sus sesiones abiertas
      const ses = propsJson_('SABAPP_SESIONES');
      Object.keys(ses).forEach(function (t) { if (ses[t].correo === c) delete ses[t]; });
      guardarJson_('SABAPP_SESIONES', ses);
    }
    const fallos = propsJson_('SABAPP_FALLOS');
    if (fallos[c]) { delete fallos[c]; guardarJson_('SABAPP_FALLOS', fallos); }
  } finally { candado.releaseLock(); }
  return listaTrabajadores_();
}
function quitarTrabajador_(correo) {
  const c = normCorreo_(correo);
  const candado = LockService.getScriptLock();
  candado.waitLock(15000);
  try {
    const u = propsJson_('SABAPP_USUARIOS'); delete u[c]; guardarJson_('SABAPP_USUARIOS', u);
    const ses = propsJson_('SABAPP_SESIONES');
    Object.keys(ses).forEach(function (t) { if (ses[t].correo === c) delete ses[t]; });
    guardarJson_('SABAPP_SESIONES', ses);
  } finally { candado.releaseLock(); }
  return listaTrabajadores_();
}
// El trabajador cambia su clave (con la actual). Mínimo 6 caracteres y distinta de la actual.
function cambiarClave_(correo, actual, nueva) {
  const n = String(nueva || '').trim();
  if (n.length < 6) throw new Error('La clave nueva debe tener al menos 6 caracteres.');
  const candado = LockService.getScriptLock();
  candado.waitLock(15000);
  try {
    const u = propsJson_('SABAPP_USUARIOS'), x = u[correo];
    if (!x) throw new Error('Sin acceso: su sesión terminó. Ingrese con su correo y su clave.');
    if (!variantesClave_(actual).some(function (v) { return huellaRut_(correo, v) === x.hash; })) throw new Error('La clave actual no coincide.');
    const h = huellaRut_(correo, claveNormal_(n));
    if (h === x.hash) throw new Error('La clave nueva debe ser distinta de la actual.');
    x.hash = h; x.cambiar = false;
    guardarJson_('SABAPP_USUARIOS', u);
  } finally { candado.releaseLock(); }
}
// Cierra las sesiones de un trabajador en todos los PC (menos la del administrador que lo pide)
function cerrarSesiones_(correo, salvo) {
  const c = normCorreo_(correo);
  const candado = LockService.getScriptLock();
  candado.waitLock(15000);
  try {
    const ses = propsJson_('SABAPP_SESIONES');
    Object.keys(ses).forEach(function (t) { if (ses[t].correo === c && t !== salvo) delete ses[t]; });
    guardarJson_('SABAPP_SESIONES', ses);
  } finally { candado.releaseLock(); }
  return listaTrabajadores_();
}
function htmlTrabajadores_() {
  return '<!DOCTYPE html><html><head><base target="_top"><meta charset="utf-8"><style>'
    + 'body{margin:0;padding:4px 2px;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1c1c1a}'
    + 'p.nota{margin:0 0 12px;color:#66645c}form{display:grid;gap:8px;padding:12px;border:1px solid #e2dccd;border-radius:12px;background:#f6f2e9}'
    + 'label{display:grid;gap:3px;font-weight:700;font-size:13px;color:#4a483f}input{min-height:38px;padding:6px 10px;border:1.5px solid #d9d2c1;border-radius:8px;font:inherit;font-size:15px;background:#fff}'
    + 'button{min-height:40px;padding:6px 14px;border:0;border-radius:8px;background:#1f5f3a;color:#fff;font:inherit;font-weight:800;cursor:pointer}button.q{min-height:32px;padding:4px 10px;background:#fff;color:#b3261e;border:1.5px solid #e9c6c2}button.q.s{background:#b3261e;color:#fff}'
    + '#msg{min-height:1.4em;margin:8px 0;font-weight:700}#msg.mal{color:#b3261e}#msg.bien{color:#1f5f3a}'
    + 'ul{margin:6px 0 0;padding:0;list-style:none}li{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eee}li div{flex:1;min-width:0}li small{display:block;color:#66645c}'
    + '</style></head><body>'
    + '<p class="nota">Cada trabajador entra a <b>www.avicolasb.com/sabapp</b> con su correo y una clave temporal; al entrar la primera vez crea la suya. La clave no queda escrita: se guarda cifrada. Para cambiar el nombre, la clave o el rol de alguien, vuelva a guardarlo con el mismo correo.</p>'
    + '<form id="f" autocomplete="off"><label>Nombre<input id="nom" maxlength="40" placeholder="Ej.: Sofía"></label>'
    + '<label>Correo (su usuario)<input id="cor" type="email" maxlength="80" placeholder="nombre@correo.cl"></label>'
    + '<label>Clave temporal (letras) o RUT<span style="display:flex;gap:6px"><input id="rut" maxlength="40" placeholder="Al editar, en blanco se mantiene" autocomplete="off" style="flex:1"><button type="button" id="gen" style="min-height:38px">Generar</button></span></label>'
    + '<label style="display:flex;align-items:center;gap:8px"><input id="cam" type="checkbox" checked style="min-height:0;width:18px;height:18px"> Pedir que cree su propia clave al entrar</label>'
    + '<label style="display:flex;align-items:center;gap:8px"><input id="adm" type="checkbox" style="min-height:0;width:18px;height:18px"> Administrador de SabAPP (ve el panel ⚙ Administrar)</label>'
    + '<button id="g">Guardar trabajador</button></form><p id="msg" role="status"></p><b>Trabajadores con acceso</b><ul id="l"><li><div><small>Cargando…</small></div></li></ul>'
    + '<script>'
    + 'var $=function(i){return document.getElementById(i)};'
    + 'var esc=function(t){return String(t).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})};'
    + 'function msg(t,mal){$("msg").textContent=t;$("msg").className=mal?"mal":"bien"}'
    + 'function pintar(l){$("l").innerHTML=l.length?l.map(function(x){return "<li><div><b>"+esc(x.nombre)+"</b><small>"+esc(x.correo)+(x.admin?" · administrador":"")+(x.sesiones?" · "+x.sesiones+" PC con sesión abierta":"")+"</small></div><button class=\"q\" data-q=\""+esc(x.correo)+"\">Quitar</button></li>"}).join(""):"<li><div><small>Aún no hay trabajadores.</small></div></li>"}'
    + 'function fallo(e){msg(String(e&&e.message||e),true);$("g").disabled=false}'
    + 'function temporal(){var c="bcdfghjklmnprstv",v="aeiou",a=new Uint32Array(10);crypto.getRandomValues(a);var s="";for(var i=0;i<5;i++)s+=c[a[2*i]%c.length]+v[a[2*i+1]%v.length];return s}'
    + '$("gen").addEventListener("click",function(){$("rut").value=temporal()});'
    + 'google.script.run.withSuccessHandler(pintar).withFailureHandler(fallo).trabajadoresLista();'
    + '$("f").addEventListener("submit",function(ev){ev.preventDefault();var n=$("nom").value,c=$("cor").value,r=$("rut").value,ad=$("adm").checked,ca=$("cam").checked;$("g").disabled=true;msg("Guardando…");'
    + 'google.script.run.withSuccessHandler(function(l){pintar(l);$("g").disabled=false;$("rut").value="";$("nom").value="";$("cor").value="";$("adm").checked=false;msg("Guardado: "+n.trim()+(ad?" (administrador)":"")+(r?". Su clave"+(ca?" temporal":"")+": "+r:""))}).withFailureHandler(fallo).trabajadorGuardar(n,c,r,ad,ca)});'
    + '$("l").addEventListener("click",function(ev){var b=ev.target.closest("[data-q]");if(!b)return;if(!b.classList.contains("s")){b.classList.add("s");b.textContent="¿Quitar? Toca otra vez";setTimeout(function(){b.classList.remove("s");b.textContent="Quitar"},4000);return}'
    + 'b.disabled=true;google.script.run.withSuccessHandler(function(l){pintar(l);msg("Listo: ya no puede entrar a SabAPP.")}).withFailureHandler(fallo).trabajadorQuitar(b.dataset.q)});'
    + '<\/script></body></html>';
}

// Pedidos para el panel: los activos y los próximos, más los cerrados de las últimas dos semanas.
function panelDatos() { const u = exigirVendedor(), d = panelDatos_(u); d.admin = ADMINS_SABAPP.indexOf(normCorreo_(u)) >= 0; return d; }
function panelDatos_(usuario) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = hojaPedidos();
  try { if (vencerPendientes(hoja)) recalcularStock_({ correo: true }); } catch (err) { /* cuenta solo de lectura */ }
  const zona = libro.getSpreadsheetTimeZone();
  const hoy = Utilities.formatDate(new Date(), zona, 'yyyy-MM-dd');
  const n = hoja.getLastRow();
  const filas = n > 1 ? hoja.getRange(2, 1, n - 1, COLUMNAS_PEDIDOS.length).getValues() : [];
  const det = hojaDetalle(), m = det.getLastRow(), items = {};
  if (m > 1) det.getRange(2, 1, m - 1, COLUMNAS_DETALLE.length).getValues().forEach(function (f) {
    const cod = String(f[2] || '');
    if (!cod) return;
    const ped = f[CD['Cantidad pedida'] - 1], udp = f[CD['Unidades pedidas'] - 1];
    (items[cod] = items[cod] || []).push({ nombre: String(f[4]), cod: codigoFilaMyPyme_(f), codCarta: String(f[5]), q: Number(f[6]) || 0, uds: Number(f[7]) || 0,
      precio: f[8] === '' || f[8] == null ? null : Number(f[8]),
      pedida: ped === '' || ped == null ? null : Number(ped), udsPedidas: udp === '' || udp == null ? null : Number(udp), cambio: String(f[CD['Cambio'] - 1] || '') });
  });
  const hace = Date.now() - 14 * 864e5;
  const valor = function (f, nombre) { return f[CP[nombre] - 1]; };
  const notas = n > 1 ? hoja.getRange(2, CP['Estado'], n - 1, 1).getNotes() : [];
  const pedidos = filas.map(function (f, i) {
    const aviso = String((notas[i] || [''])[0] || '').match(/Avisado por (WhatsApp|correo) por \S+ el (\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/);
    const atiende = String((notas[i] || [''])[0] || '').match(/Aviso al cliente por (correo|WhatsApp): (.+?) atiende su pedido/);
    const codigo = String(valor(f, 'Código del pedido') || ''), dia = valor(f, 'Día de retiro'), rec = valor(f, 'Recibido'), hora = valor(f, 'Hora');
    return {
      codigo: codigo,
      dia: dia instanceof Date ? Utilities.formatDate(dia, zona, 'yyyy-MM-dd') : '',
      hora: hora instanceof Date ? Utilities.formatDate(hora, zona, 'HH:mm') : String(hora || ''),
      prioridad: String(valor(f, 'Prioridad') || 'Normal'),
      cliente: String(valor(f, 'Cliente') || ''),
      celular: String(valor(f, 'Celular') || ''),
      codigoCliente: String(valor(f, 'Código de cliente') || ''),
      frecuente: valor(f, 'Cliente frecuente') === 'Sí',
      veces: Number(valor(f, 'N.º de pedidos del cliente')) || 0,
      unidades: Number(valor(f, 'Unidades')) || 0,
      total: Number(valor(f, 'Total aprox.')) || 0,
      comentario: String(valor(f, 'Comentario') || ''),
      recibido: rec instanceof Date ? rec.getTime() : 0,
      estado: ESTADOS.indexOf(String(valor(f, 'Estado'))) >= 0 ? String(valor(f, 'Estado')) : 'Por confirmar',
      local: String(valor(f, 'Local') || ''),
      correo: String(valor(f, 'Correo') || ''),
      prepara: String(valor(f, 'Prepara') || ''),
      avisado: !!aviso,
      avisadoPor: aviso ? aviso[1] : '',
      avisadoEl: aviso ? aviso[2] : '',
      avisoAtiende: atiende ? atiende[1] : '',
      avisoAtiendeQuien: atiende ? atiende[2] : '',
      items: items[codigo] || []
    };
  }).filter(function (p) {
    return p.codigo && (['Por confirmar', 'Confirmado', 'Preparado'].indexOf(p.estado) >= 0 || p.dia >= hoy || p.recibido >= hace);
  });
  let stock = { cargado: '', items: [] };
  try { stock = stockPanel_(); } catch (err) { /* sin hoja de stock todavía */ }
  return { usuario: usuario, hoy: hoy, ahora: Date.now(), vendedores: VENDEDORES, pedidos: pedidos, stock: stock };
}

// Cambia el estado de un pedido desde el panel (con la casilla al día y una nota de quién lo hizo y cuándo).
// avisado: el vendedor abrió WhatsApp ('wsp') o el correo ('correo') con el aviso de «listo» en el mismo toque.
// prepara: quién prepara el pedido (se elige al confirmarlo).
// avisoWsp: SabAPP abrió WhatsApp con «X atenderá tu pedido» (cliente en el local sin correo).
function panelCambiar(codigo, estado, avisado, prepara, avisoWsp) { return panelCambiar_(exigirVendedor(), codigo, estado, avisado, prepara, avisoWsp); }
function panelCambiar_(usuario, codigo, estado, avisado, prepara, avisoWsp) {
  let avisoAtiende = null;
  if (ESTADOS.indexOf(estado) < 0) throw new Error('Estado no válido.');
  const candado = LockService.getScriptLock();
  candado.waitLock(15000);
  try {
    const hoja = hojaPedidos(), fila = filaDelPedido(hoja, codigo);
    hoja.getRange(fila, CP['Estado']).setValue(estado);
    anotarEnEstado(hoja, fila, estado + ' por ' + usuario);
    if (avisado === true || avisado === 'wsp') anotarEnEstado(hoja, fila, 'Avisado por WhatsApp por ' + usuario);
    if (avisado === 'correo') anotarEnEstado(hoja, fila, 'Avisado por correo por ' + usuario);
    if (prepara) avisoAtiende = asignarPreparacion(hoja, fila, prepara, usuario, avisoWsp);
    hoja.getRange(fila, CP['Confirmado']).setValue(CONFIRMADOS.indexOf(estado) >= 0);
    try { recalcularStock_({ correo: true }); } catch (err) { /* el cambio de estado ya quedó */ }
  } finally { candado.releaseLock(); }
  const d = panelDatos_(usuario);
  if (avisoAtiende) d.avisoAtiende = avisoAtiende;
  return d;
}

// Editar un pedido desde SabAPP (David, 23/11/2026: «poder editar el pedido eliminando lo que no tenemos o lo que el cliente me dijo que no quiere»).
// cambios: [{ i: n.º de línea del pedido (en el orden de la hoja), q: cantidad nueva (0 = quitar), motivo, huella: 'producto|código|cantidad' al abrir }].
// Solo se baja la cantidad (o se devuelve hasta lo que pidió el cliente). La línea guarda lo pedido y el motivo; el pedido recalcula unidades,
// total (mismo descuento proporcional y el despacho igual) y la columna «Productos», y queda anotado en la nota de «Estado».
const MOTIVOS_CAMBIO = ['Sin stock', 'El cliente no lo quiere'];
function pesos_(n) { return '$' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function panelEditar(codigo, cambios) { return panelEditar_(exigirVendedor(), codigo, cambios); }
function panelEditar_(usuario, codigo, cambios) {
  if (!Array.isArray(cambios) || !cambios.length || cambios.length > 200) throw new Error('No hay cambios que guardar.');
  const candado = LockService.getScriptLock();
  candado.waitLock(15000);
  let resumen = null;
  try {
    const hoja = hojaPedidos(), fila = filaDelPedido(hoja, codigo);
    const ped = hoja.getRange(fila, 1, 1, COLUMNAS_PEDIDOS.length).getValues()[0];
    const estado = String(ped[CP['Estado'] - 1]);
    if (['Por confirmar', 'Confirmado', 'Preparado'].indexOf(estado) < 0) throw new Error('El pedido ' + codigo + ' está ' + estado.toLowerCase() + ': ya no se puede editar.');
    const det = hojaDetalle(), m = det.getLastRow();
    const todas = m > 1 ? det.getRange(2, 1, m - 1, COLUMNAS_DETALLE.length).getValues() : [];
    const lineas = [];
    todas.forEach(function (f, k) { if (String(f[2]) === String(codigo)) lineas.push({ n: k + 2, f: f }); });
    if (!lineas.length) throw new Error('No se encontró el detalle del pedido ' + codigo + '.');
    const cambio = 'El pedido cambió mientras lo editabas: ábrelo de nuevo.';
    const cuando = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd/MM HH:mm');
    const suma = function () { return lineas.reduce(function (a, l) { return a + (l.f[8] === '' || l.f[8] == null ? 0 : (Number(l.f[6]) || 0) * Number(l.f[8])); }, 0); };
    const antes = suma(), notas = [], vistos = {};
    cambios.forEach(function (c) {
      const i = Number(c && c.i);
      const l = lineas[i];
      if (!l || vistos[i]) throw new Error(cambio);
      vistos[i] = true;
      const f = l.f, qAhora = Number(f[6]) || 0, udsAhora = Number(f[7]) || 0;
      if (String(c.huella || '') !== [String(f[4]), String(f[5]), qAhora].join('|')) throw new Error(cambio);
      const pedida = f[CD['Cantidad pedida'] - 1] === '' ? qAhora : Number(f[CD['Cantidad pedida'] - 1]) || 0;
      const udsPedidas = f[CD['Unidades pedidas'] - 1] === '' ? udsAhora : Number(f[CD['Unidades pedidas'] - 1]) || 0;
      const q = entero(c.q, pedida);
      if (q === qAhora) return;
      const uds = pedida ? Math.round(udsPedidas * q / pedida * 1000) / 1000 : 0;
      const motivo = MOTIVOS_CAMBIO.indexOf(c.motivo) >= 0 ? c.motivo : MOTIVOS_CAMBIO[0];
      const nombre = String(f[4]).replace(/^↳ /, '');
      f[6] = q; f[7] = uds;
      if (q === pedida) { f[CD['Cantidad pedida'] - 1] = ''; f[CD['Unidades pedidas'] - 1] = ''; f[CD['Cambio'] - 1] = ''; notas.push(nombre + ': vuelve a ' + q); }
      else {
        f[CD['Cantidad pedida'] - 1] = pedida; f[CD['Unidades pedidas'] - 1] = udsPedidas; f[CD['Cambio'] - 1] = motivo + ' · ' + usuario + ' ' + cuando;
        notas.push((q ? nombre + ': ' + pedida + ' → ' + q : 'quitó ' + pedida + ' × ' + nombre) + ' (' + motivo.toLowerCase() + ')');
      }
      det.getRange(l.n, 1, 1, COLUMNAS_DETALLE.length).setValues([f]);
    });
    if (!notas.length) throw new Error('No hay cambios que guardar.');
    // Totales del pedido: el despacho no cambia; el descuento (si hubo) se mantiene en la misma proporción
    const despues = suma(), total0 = Number(ped[CP['Total aprox.'] - 1]) || 0;
    const desp = (String(ped[CP['Comentario'] - 1] || '').match(/DESPACHO \$([\d.]+)/) || [])[1];
    const despacho = desp ? Number(desp.replace(/\./g, '')) || 0 : 0;
    const factor = antes > 0 && total0 ? Math.min(1, Math.max(0, (total0 - despacho) / antes)) : 1;
    const vacio = lineas.every(function (l) { return !(Number(l.f[6]) > 0); });
    const total1 = !total0 ? 0 : vacio ? 0 : Math.round(despacho + despues * factor);
    const principales = lineas.filter(function (l) { return !/^↳/.test(String(l.f[4])); });
    const unidades = principales.reduce(function (a, l) { return a + (Number(l.f[7]) || Number(l.f[6]) || 0); }, 0);
    const productos = principales.filter(function (l) { return Number(l.f[6]) > 0; }).map(function (l) { return l.f[6] + ' × ' + l.f[4]; }).join(' · ');
    hoja.getRange(fila, CP['Unidades']).setValue(Math.round(unidades * 1000) / 1000);
    hoja.getRange(fila, CP['Total aprox.']).setValue(total1 || '');
    hoja.getRange(fila, CP['Productos']).setValue(textoLargo(productos || '(sin productos: todo se quitó)', 2000));
    anotarEnEstado(hoja, fila, ('Editado por ' + usuario + ': ' + notas.join('; ') + (total0 ? '. Total ' + pesos_(total0) + ' → ' + pesos_(total1) : '')).slice(0, 480));
    resumen = { codigo: codigo, total: total1, cambios: notas.length };
    try { recalcularStock_({ correo: true }); } catch (err) { /* el cambio ya quedó */ }
  } finally { candado.releaseLock(); }
  const datos = panelDatos_(usuario);
  datos.editado = resumen;
  return datos;
}

// El vendedor abrió WhatsApp o el correo para avisar al cliente que su pedido está listo: queda anotado (lo ven todos los PC).
function panelAvisado(codigo, medio) { return panelAvisado_(exigirVendedor(), codigo, medio); }
function panelAvisado_(usuario, codigo, medio) {
  const candado = LockService.getScriptLock();
  candado.waitLock(15000);
  try {
    const hoja = hojaPedidos();
    anotarEnEstado(hoja, filaDelPedido(hoja, codigo), (medio === 'correo' ? 'Avisado por correo por ' : 'Avisado por WhatsApp por ') + usuario);
  } finally { candado.releaseLock(); }
  return panelDatos_(usuario);
}

// Cambia quién prepara un pedido ya confirmado.
function panelAsignar(codigo, prepara, avisoWsp) { return panelAsignar_(exigirVendedor(), codigo, prepara, avisoWsp); }
function panelAsignar_(usuario, codigo, prepara, avisoWsp) {
  const candado = LockService.getScriptLock();
  let avisoAtiende = null;
  candado.waitLock(15000);
  try {
    const hoja = hojaPedidos();
    avisoAtiende = asignarPreparacion(hoja, filaDelPedido(hoja, codigo), prepara, usuario, avisoWsp);
  } finally { candado.releaseLock(); }
  const d = panelDatos_(usuario);
  if (avisoAtiende) d.avisoAtiende = avisoAtiende;
  return d;
}

// Anota quién prepara. Si el cliente espera en el local y es la primera vez que se elige a alguien,
// se le avisa «Sofía atenderá tu pedido…»: por correo lo envía este script al instante; por WhatsApp lo abre SabAPP.
function asignarPreparacion(hoja, fila, prepara, usuario, avisoWsp) {
  if (VENDEDORES.indexOf(prepara) < 0) throw new Error('Esa persona no está en la lista de vendedores.');
  const f = hoja.getRange(fila, 1, 1, COLUMNAS_PEDIDOS.length).getValues()[0];
  const v = function (nombre) { return f[CP[nombre] - 1]; };
  const antes = String(v('Prepara') || '');
  hoja.getRange(fila, CP['Prepara']).setValue(prepara);
  anotarEnEstado(hoja, fila, 'Prepara ' + prepara + ' (asignado por ' + usuario + ')');
  if (antes || String(v('Hora')) !== EN_LOCAL) return null;
  const correo = correoValido(v('Correo'));
  if (correo) {
    try {
      enviarCorreoAtiende_(correo, String(v('Cliente') || ''), String(v('Código del pedido') || ''), prepara);
      anotarEnEstado(hoja, fila, 'Aviso al cliente por correo: ' + prepara + ' atiende su pedido');
      return { medio: 'correo', ok: true, prepara: prepara };
    } catch (err) {
      const msg = String(err && err.message || err).slice(0, 150);
      anotarEnEstado(hoja, fila, 'No se pudo enviar el correo al cliente: ' + msg);
      return { medio: 'correo', ok: false, error: msg, prepara: prepara };
    }
  }
  if (avisoWsp) {
    anotarEnEstado(hoja, fila, 'Aviso al cliente por WhatsApp: ' + prepara + ' atiende su pedido');
    return { medio: 'wsp', ok: true, prepara: prepara };
  }
  return null;
}

// Correo «Sofía atenderá tu pedido…» (sale de la cuenta dueña del script, con el nombre Emporio Sabroso).
function enviarCorreoAtiende_(correo, cliente, codigo, prepara) {
  const html = function (t) { return String(t).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  const nombre = /^\(/.test(cliente) ? '' : String(cliente).trim().split(/\s+/)[0] || '';
  const saludo = nombre ? '¡Hola ' + nombre.charAt(0).toUpperCase() + nombre.slice(1) + '!' : '¡Hola!';
  MailApp.sendEmail({
    to: correo,
    name: 'Emporio Sabroso',
    subject: prepara + ' atenderá tu pedido ' + codigo + ' · Emporio Sabroso',
    body: saludo + ' ' + prepara + ' atenderá tu pedido ' + codigo + ', ¡lo estamos preparando!\n\nTe lo entregamos en el mesón.\nEmporio Sabroso · Arturo Prat 720, Chillán',
    htmlBody: '<div style="font:16px/1.5 Arial,Helvetica,sans-serif;color:#1c1c1a">'
      + '<p style="margin:0 0 12px">' + html(saludo) + ' <b>' + html(prepara) + '</b> atenderá tu pedido <b>' + html(codigo) + '</b>, ¡lo estamos preparando!</p>'
      + '<p style="margin:0;color:#66645c;font-size:14px">Te lo entregamos en el mesón.<br>Emporio Sabroso · Arturo Prat 720, Chillán</p></div>'
  });
}

// Ejecutar UNA vez desde el editor con la cuenta dueña: da el permiso de enviar correos (no envía nada).
function autorizarCorreo() {
  Logger.log('Permiso de correo listo. Correos que quedan hoy: ' + MailApp.getRemainingDailyQuota());
}

function filaDelPedido(hoja, codigo) {
  const n = hoja.getLastRow();
  const cods = n > 1 ? hoja.getRange(2, CP['Código del pedido'], n - 1, 1).getValues() : [];
  for (let i = 0; i < cods.length; i++) if (String(cods[i][0]) === String(codigo)) return i + 2;
  throw new Error('No se encontró el pedido ' + codigo + '.');
}

// Historial en la nota de la celda «Estado»: lo más nuevo arriba, con fecha y hora de Chile.
function anotarEnEstado(hoja, fila, texto) {
  const celda = hoja.getRange(fila, CP['Estado']);
  const linea = texto + ' el ' + Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm');
  celda.setNote([linea, celda.getNote()].filter(String).join('\n').slice(0, 1000));
}

/* ---------- Stock del Emporio y aviso de stock bajo (18/11/2026, pedido de David) ----------
   1. Cada mañana se pega en la hoja «Carga MyPyme» la exportación de inventario de MyPyme del Emporio (la tabla completa,
      con sus encabezados) y se usa el menú «Stock del Emporio › Cargar stock de MyPyme». Se repite 1 o 2 veces en el día
      para corregir con lo vendido en el mesón (boletas de MyPyme).
   2. Disponible = stock de MyPyme − unidades de los pedidos del catálogo que MyPyme todavía no descontó: los que estaban
      pendientes al cargar y los que llegaron después (sin «Anulado» ni «No llegó»). Las tapas que van con su envase también.
   3. Solo los productos con «Stock ideal» (columna que llena David) tienen aviso: cuando el disponible llega al 30 % del
      ideal queda en STOCK BAJO (o AGOTADO): recuadro en SabAPP, correo a CORREO_STOCK y la fila en rojo.
   4. Decisiones (SabAPP, administradores, o el menú de la planilla con la fila elegida):
      · Cerrar en la página → la carta lo muestra «Agotado por ahora» y no deja agregarlo.
      · Pedir de inmediato → orden de compra en «Órdenes de compra» y correo a CORREO_COMPRAS con el mensaje de WhatsApp
        listo para el proveedor (proveedor de la columna «Proveedor»; su WhatsApp, en la hoja «Proveedores»).
      Si una carga nueva deja el producto sobre el 30 %, se reabre solo y el aviso queda listo para la próxima vez. */
const HOJA_STOCK = 'Stock del día', HOJA_CARGA = 'Carga MyPyme', HOJA_PROVEEDORES = 'Proveedores', HOJA_OC = 'Órdenes de compra';
const UMBRAL_STOCK = 0.30;
const CORREO_STOCK = 'jefatura@avicolasb.com';   // recibe el aviso de stock bajo
const CORREO_COMPRAS = 'jefatura@avicolasb.com'; // recibe las órdenes de compra (cambiar por el correo de quien compra)
const LOCAL_STOCK = 'emporio';
const SABAPP_URL = 'https://www.avicolasb.com/sabapp/';
const COLUMNAS_STOCK = ['Código', 'Producto', 'Proveedor', 'Stock ideal', 'Stock MyPyme', 'Cargado el', 'Pedidos del catálogo', 'Disponible',
  '% del ideal', 'Estado', 'Cerrado en la página', 'Orden de compra', 'Decidió', 'Decidido el', 'Avisado el'];
const COLUMNAS_CARGA_AYUDA = ['Pegue aquí la exportación de inventario de MyPyme (desde la celda A1, con sus encabezados) y use el menú Stock del Emporio › Cargar stock de MyPyme.'];
const COLUMNAS_PROVEEDORES = ['Proveedor', 'Contacto', 'WhatsApp', 'Correo'];
const COLUMNAS_OC = ['N.º OC', 'Fecha', 'Proveedor', 'Código', 'Producto', 'Cantidad a pedir', 'Disponible al pedir', 'Stock ideal', 'Pidió',
  'Estado', 'WhatsApp del proveedor', 'Mensaje para WhatsApp', 'Enlace de WhatsApp'];
const CS = {}; COLUMNAS_STOCK.forEach(function (n, i) { CS[n] = i + 1; });
const ESTADO_OK = 'OK', ESTADO_BAJO = 'STOCK BAJO', ESTADO_AGOTADO = 'AGOTADO', ESTADO_SIN_IDEAL = 'Sin stock ideal (sin aviso)', ESTADO_SIN_DATOS = 'No vino en la última carga';

function hojaStock_() {
  const nueva = !SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_STOCK);
  const hoja = hojaCon(HOJA_STOCK, COLUMNAS_STOCK);
  if (nueva) formatoStock_(hoja);
  return hoja;
}
function hojaProveedores_() { return hojaCon(HOJA_PROVEEDORES, COLUMNAS_PROVEEDORES); }
function hojaOC_() { return hojaCon(HOJA_OC, COLUMNAS_OC); }
function hojaCarga_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA_CARGA);
  if (!hoja) { hoja = libro.insertSheet(HOJA_CARGA); hoja.getRange(1, 1).setValue(COLUMNAS_CARGA_AYUDA[0]).setFontWeight('bold'); }
  return hoja;
}
function prepararHojasStock() { hojaStock_(); hojaCarga_(); hojaProveedores_(); hojaOC_(); formatoStock_(hojaStock_()); }

// Formato de «Stock del día»: porcentaje, fechas, colores por estado y la columna de stock ideal destacada para llenarla.
function formatoStock_(hoja) {
  const filas = Math.max(hoja.getMaxRows() - 1, 1);
  hoja.getRange(2, CS['% del ideal'], filas, 1).setNumberFormat('0%');
  [CS['Cargado el'], CS['Decidido el'], CS['Avisado el']].forEach(function (c) { hoja.getRange(2, c, filas, 1).setNumberFormat('dd/MM HH:mm'); });
  hoja.getRange(1, CS['Stock ideal']).setBackground('#fff2cc').setNote('Lo llena David: la cantidad normal que debe haber de este producto. El aviso salta al llegar al 30 %.');
  hoja.getRange(1, CS['Proveedor']).setBackground('#fff2cc').setNote('Nombre del proveedor igual que en la hoja «Proveedores» (ahí va su WhatsApp).');
  const col = function (n) { return hoja.getRange(2, CS[n], filas, 1); };
  const regla = function () { return SpreadsheetApp.newConditionalFormatRule(); };
  hoja.setConditionalFormatRules([
    regla().whenTextEqualTo(ESTADO_AGOTADO).setBackground('#b3261e').setFontColor('#ffffff').setBold(true).setRanges([col('Estado')]).build(),
    regla().whenTextEqualTo(ESTADO_BAJO).setBackground('#fbe1de').setFontColor('#b3261e').setBold(true).setRanges([col('Estado')]).build(),
    regla().whenTextEqualTo(ESTADO_OK).setFontColor('#1f5f3a').setRanges([col('Estado')]).build(),
    regla().whenTextEqualTo('Sí').setBackground('#e8e6df').setBold(true).setRanges([col('Cerrado en la página')]).build()
  ]);
  hoja.setColumnWidth(CS['Producto'], 260);
  hoja.setColumnWidth(CS['Estado'], 170);
}

function numeroCarga_(v) {
  if (typeof v === 'number') return v;
  const s = String(v == null ? '' : v).trim().replace(/\s/g, '');
  if (!s) return NaN;
  return Number(/,\d{1,3}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
}

// Lee la exportación pegada en «Carga MyPyme»: busca las columnas de código, nombre y stock (en ese orden de preferencia:
// «Total todas las bodegas», «Stock», «Existencia», «Saldo», «Cantidad»). Si viene una fila por bodega, suma por código.
function leerCarga_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_CARGA);
  if (!hoja || hoja.getLastRow() < 2) throw new Error('Pegue primero la exportación de inventario de MyPyme en la hoja «' + HOJA_CARGA + '».');
  const datos = hoja.getDataRange().getValues();
  const prefer = [/total todas las bodegas/, /^stock\b/, /existencia/, /^saldo/, /^cantidad/];
  for (let i = 0; i < Math.min(15, datos.length); i++) {
    const enc = datos[i].map(function (v) { return String(v).trim().toLowerCase(); });
    const cCod = enc.findIndex(function (v) { return /^c[oó]d(igo|\.)?(\s|$)/.test(v) && !/barra/.test(v); });
    if (cCod < 0) continue;
    const cNom = enc.findIndex(function (v, j) { return j !== cCod && /^(nombre|descripci|art[ií]culo|producto)/.test(v); });
    let cSt = -1;
    for (let k = 0; k < prefer.length && cSt < 0; k++) cSt = enc.findIndex(function (v) { return prefer[k].test(v); });
    if (cSt < 0) throw new Error('No encontré la columna de stock (por ejemplo «Total todas las bodegas») en «' + HOJA_CARGA + '».');
    const out = {}, orden = [];
    datos.slice(i + 1).forEach(function (f) {
      const cod = String(f[cCod] == null ? '' : f[cCod]).trim().toUpperCase();
      const n = numeroCarga_(f[cSt]);
      if (!cod || isNaN(n)) return;
      if (!out[cod]) { out[cod] = { cod: cod, nombre: cNom >= 0 ? textoLargo(f[cNom], 140) : '', stock: 0 }; orden.push(cod); }
      out[cod].stock += n;
    });
    if (!orden.length) throw new Error('La hoja «' + HOJA_CARGA + '» no trae productos con código y stock.');
    return orden.map(function (c) { return out[c]; });
  }
  throw new Error('No encontré la columna «Código» en «' + HOJA_CARGA + '». Pegue la exportación con sus encabezados.');
}

// Pedidos del Emporio que están abiertos ahora (MyPyme aún no los descontó si no se entregaron).
function pedidosAbiertos_() {
  const hp = hojaPedidos(), np = hp.getLastRow();
  if (np < 2) return [];
  return hp.getRange(2, 1, np - 1, COLUMNAS_PEDIDOS.length).getValues().filter(function (f) {
    return String(f[CP['Local'] - 1] || LOCAL_STOCK) === LOCAL_STOCK && ['Por confirmar', 'Confirmado', 'Preparado'].indexOf(String(f[CP['Estado'] - 1])) >= 0;
  }).map(function (f) { return String(f[CP['Código del pedido'] - 1]); }).filter(String);
}

function cargarStockMyPyme() {
  try {
    const r = cargarStock_();
    SpreadsheetApp.getUi().alert('Stock cargado: ' + r.productos + ' productos (' + r.nuevos + ' nuevos en «' + HOJA_STOCK + '»).\n'
      + 'Con aviso de stock bajo: ' + r.bajos + '.' + (r.sinIdeal ? '\nSin stock ideal (no avisan): ' + r.sinIdeal + '.' : ''));
  } catch (err) { SpreadsheetApp.getUi().alert(err.message); }
}
function cargarStock_() {
  const carga = leerCarga_();
  const candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    const hoja = hojaStock_(), n = hoja.getLastRow();
    const filas = n > 1 ? hoja.getRange(2, 1, n - 1, COLUMNAS_STOCK.length).getValues() : [];
    const idx = {}; filas.forEach(function (f, i) { idx[String(f[0]).trim().toUpperCase()] = i; });
    const ahora = new Date();
    let nuevos = 0;
    carga.forEach(function (x) {
      if (idx[x.cod] != null) {
        const f = filas[idx[x.cod]];
        if (x.nombre) f[CS['Producto'] - 1] = x.nombre;
        f[CS['Stock MyPyme'] - 1] = x.stock; f[CS['Cargado el'] - 1] = ahora;
      } else {
        const f = COLUMNAS_STOCK.map(function () { return ''; });
        f[0] = x.cod; f[CS['Producto'] - 1] = x.nombre; f[CS['Stock MyPyme'] - 1] = x.stock; f[CS['Cargado el'] - 1] = ahora;
        idx[x.cod] = filas.length; filas.push(f); nuevos++;
      }
    });
    if (filas.length) hoja.getRange(2, 1, filas.length, COLUMNAS_STOCK.length).setValues(filas);
    guardarJson_('STOCK_CARGA', { t: ahora.getTime(), pendientes: pedidosAbiertos_().slice(-600) });
    const r = recalcularStock_({ correo: true, carga: true });
    r.productos = carga.length; r.nuevos = nuevos;
    return r;
  } finally { candado.releaseLock(); }
}

function recalcularStockMenu() { const r = recalcularStock_({ correo: true }); SpreadsheetApp.getUi().alert('Stock recalculado. Con aviso de stock bajo: ' + r.bajos + '.'); }

// Recalcula «Stock del día». opc.correo: avisar por correo los productos que recién llegaron al 30 %.
// opc.carga: viene de una carga nueva (reabre y deja listo el aviso de los que volvieron sobre el 30 %).
function recalcularStock_(opc) {
  opc = opc || {};
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_STOCK);
  const r = { bajos: 0, sinIdeal: 0, nuevos: [] };
  if (!hoja || hoja.getLastRow() < 2) return r;
  const carga = propsJson_('STOCK_CARGA'), tCarga = Number(carga.t) || 0, pend = {};
  (carga.pendientes || []).forEach(function (c) { pend[c] = true; });
  // Pedidos del catálogo que todavía no están en el stock de MyPyme
  const cuentan = {}, hp = hojaPedidos(), np = hp.getLastRow();
  if (np > 1) hp.getRange(2, 1, np - 1, COLUMNAS_PEDIDOS.length).getValues().forEach(function (f) {
    const cod = String(f[CP['Código del pedido'] - 1] || ''), est = String(f[CP['Estado'] - 1] || ''), rec = f[CP['Recibido'] - 1];
    if (!cod || String(f[CP['Local'] - 1] || LOCAL_STOCK) !== LOCAL_STOCK || est === 'Anulado' || est === 'No llegó') return;
    if (pend[cod] || (rec instanceof Date ? rec.getTime() : 0) > tCarga) cuentan[cod] = true;
  });
  const reservado = {}, det = hojaDetalle(), nd = det.getLastRow();
  if (nd > 1) det.getRange(2, 1, nd - 1, COLUMNAS_DETALLE.length).getValues().forEach(function (f) {
    const pc = codigoFilaMyPyme_(f);
    if (!cuentan[String(f[2])] || !pc) return;
    reservado[pc] = (reservado[pc] || 0) + (Number(f[7]) || Number(f[6]) || 0);
  });
  const n = hoja.getLastRow(), filas = hoja.getRange(2, 1, n - 1, COLUMNAS_STOCK.length).getValues(), ahora = new Date();
  const salida = filas.map(function (f) {
    const cod = String(f[0]).trim().toUpperCase();
    const ideal = Number(f[CS['Stock ideal'] - 1]) || 0, base = Number(f[CS['Stock MyPyme'] - 1]) || 0;
    const cargado = f[CS['Cargado el'] - 1], res = reservado[cod] || 0, disp = Math.max(0, base - res);
    let cerrado = String(f[CS['Cerrado en la página'] - 1] || ''), oc = String(f[CS['Orden de compra'] - 1] || '');
    let quien = f[CS['Decidió'] - 1], cuando = f[CS['Decidido el'] - 1], avisado = f[CS['Avisado el'] - 1];
    const sinDatos = tCarga && cargado instanceof Date && cargado.getTime() < tCarga - 60000;
    let estado;
    if (!cod) estado = '';
    else if (sinDatos) estado = ESTADO_SIN_DATOS;
    else if (!ideal) estado = ESTADO_SIN_IDEAL;
    else estado = disp <= 0 ? ESTADO_AGOTADO : disp / ideal <= UMBRAL_STOCK ? ESTADO_BAJO : ESTADO_OK;
    const alerta = estado === ESTADO_BAJO || estado === ESTADO_AGOTADO;
    if (estado === ESTADO_SIN_IDEAL) r.sinIdeal++;
    if (alerta) r.bajos++;
    if (opc.carga && estado === ESTADO_OK) {
      // Volvió sobre el 30 % con una carga nueva: se reabre en la página y el aviso queda listo para la próxima vez
      if (cerrado === 'Sí') { cerrado = ''; quien = 'Reabierto solo (stock repuesto)'; cuando = ahora; }
      oc = ''; avisado = '';
    }
    if (alerta && !avisado && cerrado !== 'Sí' && !oc && opc.correo !== false) {
      avisado = ahora;
      r.nuevos.push({ cod: cod, nombre: String(f[CS['Producto'] - 1]), disp: disp, ideal: ideal, estado: estado, proveedor: String(f[CS['Proveedor'] - 1] || '') });
    }
    return [res, disp, ideal ? disp / ideal : '', estado, cerrado, oc, quien, cuando, avisado];
  });
  hoja.getRange(2, CS['Pedidos del catálogo'], salida.length, salida[0].length).setValues(salida);
  if (r.nuevos.length && opc.correo !== false) {
    try { enviarAvisoStock_(r.nuevos); }
    catch (err) { // sin permiso de correo (por ejemplo, desde una edición a mano): se reintenta en el próximo cálculo
      const av = hoja.getRange(2, CS['Avisado el'], salida.length, 1).getValues();
      const cods = {}; r.nuevos.forEach(function (x) { cods[x.cod] = true; });
      filas.forEach(function (f, i) { if (cods[String(f[0]).trim().toUpperCase()]) av[i][0] = ''; });
      hoja.getRange(2, CS['Avisado el'], salida.length, 1).setValues(av);
    }
  }
  return r;
}

function htmlEsc_(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }

function enviarAvisoStock_(lista) {
  const url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const linea = function (x) { return x.cod + ' · ' + x.nombre + ': quedan ' + x.disp + ' de ' + x.ideal + ' (' + Math.round(x.disp / x.ideal * 100) + ' %)' + (x.proveedor ? ' · proveedor ' + x.proveedor : ''); };
  MailApp.sendEmail({
    to: CORREO_STOCK,
    name: 'SabAPP · Stock del Emporio',
    subject: (lista.length > 1 ? lista.length + ' productos con' : lista[0].cod + ' con') + ' stock bajo · Emporio Sabroso',
    body: 'Llegaron al 30 % de su stock ideal:\n\n' + lista.map(linea).join('\n')
      + '\n\nDecide en SabAPP (' + SABAPP_URL + '): «Cerrar en la página» o «Pedir de inmediato».\nPlanilla: ' + url,
    htmlBody: '<div style="font:15px/1.5 Arial,Helvetica,sans-serif;color:#1c1c1a"><p style="margin:0 0 10px"><b>Llegaron al 30 % de su stock ideal:</b></p><ul style="margin:0 0 14px;padding-left:20px">'
      + lista.map(function (x) { return '<li><b>' + htmlEsc_(x.cod) + '</b> · ' + htmlEsc_(x.nombre) + ': quedan <b style="color:#b3261e">' + x.disp + '</b> de ' + x.ideal
        + ' (' + Math.round(x.disp / x.ideal * 100) + ' %)' + (x.proveedor ? ' · proveedor ' + htmlEsc_(x.proveedor) : '') + '</li>'; }).join('')
      + '</ul><p style="margin:0 0 6px">Hay dos decisiones: <b>Cerrar en la página</b> o <b>Pedir de inmediato</b>.</p>'
      + '<p style="margin:0"><a href="' + SABAPP_URL + '" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#1f5f3a;color:#fff;text-decoration:none;font-weight:bold">Decidir en SabAPP</a>'
      + ' &nbsp; <a href="' + htmlEsc_(url) + '">Abrir la planilla</a></p></div>'
  });
}

// Productos con aviso o cerrados, para SabAPP (los más urgentes primero)
function stockPanel_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_STOCK);
  const carga = propsJson_('STOCK_CARGA');
  const zona = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const out = { cargado: carga.t ? Utilities.formatDate(new Date(Number(carga.t)), zona, 'dd/MM HH:mm') : '', items: [] };
  if (!hoja || hoja.getLastRow() < 2) return out;
  hoja.getRange(2, 1, hoja.getLastRow() - 1, COLUMNAS_STOCK.length).getValues().forEach(function (f) {
    const estado = String(f[CS['Estado'] - 1] || ''), cerrado = f[CS['Cerrado en la página'] - 1] === 'Sí';
    if (!cerrado && estado !== ESTADO_BAJO && estado !== ESTADO_AGOTADO) return;
    const cuando = f[CS['Decidido el'] - 1];
    out.items.push({ cod: String(f[0]), nombre: String(f[CS['Producto'] - 1] || ''), proveedor: String(f[CS['Proveedor'] - 1] || ''),
      ideal: Number(f[CS['Stock ideal'] - 1]) || 0, disp: Number(f[CS['Disponible'] - 1]) || 0, estado: estado, cerrado: cerrado,
      oc: String(f[CS['Orden de compra'] - 1] || ''), decidio: String(f[CS['Decidió'] - 1] || ''),
      decididoEl: cuando instanceof Date ? Utilities.formatDate(cuando, zona, 'dd/MM HH:mm') : '' });
  });
  out.items.sort(function (a, b) { return (a.cerrado - b.cerrado) || (a.ideal ? a.disp / a.ideal : 0) - (b.ideal ? b.disp / b.ideal : 0); });
  return out;
}

// Códigos cerrados en la página (los lee la carta, sin datos de nadie)
function stockCerrados_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_STOCK);
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, CS['Cerrado en la página']).getValues()
    .filter(function (f) { return f[CS['Cerrado en la página'] - 1] === 'Sí' && f[0]; })
    .map(function (f) { return String(f[0]).trim().toUpperCase(); });
}

function filaStock_(hoja, codigo) {
  const c = String(codigo || '').trim().toUpperCase(), n = hoja ? hoja.getLastRow() : 0;
  const cods = n > 1 ? hoja.getRange(2, 1, n - 1, 1).getValues() : [];
  for (let i = 0; i < cods.length; i++) if (String(cods[i][0]).trim().toUpperCase() === c) return i + 2;
  throw new Error('El producto ' + codigo + ' no está en «' + HOJA_STOCK + '».');
}

// Decisión sobre un producto con stock bajo: 'cerrar', 'reabrir' o 'pedir'. Devuelve la orden de compra si se pidió.
function stockDecidir_(usuario, codigo, decision) {
  if (['cerrar', 'reabrir', 'pedir'].indexOf(decision) < 0) throw new Error('Decisión no válida.');
  let oc = null;
  const candado = LockService.getScriptLock();
  candado.waitLock(15000);
  try {
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_STOCK), fila = filaStock_(hoja, codigo);
    const f = hoja.getRange(fila, 1, 1, COLUMNAS_STOCK.length).getValues()[0];
    if (decision === 'cerrar') hoja.getRange(fila, CS['Cerrado en la página']).setValue('Sí');
    if (decision === 'reabrir') hoja.getRange(fila, CS['Cerrado en la página']).setValue('');
    if (decision === 'pedir') {
      if (f[CS['Orden de compra'] - 1]) throw new Error('Ya se pidió: ' + f[CS['Orden de compra'] - 1] + '.');
      oc = crearOrdenCompra_(f, usuario);
      hoja.getRange(fila, CS['Orden de compra']).setValue(oc.numero);
    }
    hoja.getRange(fila, CS['Decidió'], 1, 2).setValues([[usuario, new Date()]]);
  } finally { candado.releaseLock(); }
  if (oc) { try { enviarOrdenCompra_(oc); oc.correo = CORREO_COMPRAS; } catch (err) { oc.errorCorreo = String(err && err.message || err); } }
  return oc;
}

function crearOrdenCompra_(f, usuario) {
  const zona = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), ahora = new Date();
  const hoja = hojaOC_(), n = hoja.getLastRow(), pref = 'OC-' + Utilities.formatDate(ahora, zona, 'yyyyMMdd') + '-';
  const hoy = n > 1 ? hoja.getRange(2, 1, n - 1, 1).getValues().filter(function (x) { return String(x[0]).indexOf(pref) === 0; }).length : 0;
  const numero = pref + ('0' + (hoy + 1)).slice(-2);
  const cod = String(f[0]), producto = String(f[CS['Producto'] - 1] || ''), proveedor = String(f[CS['Proveedor'] - 1] || '');
  const ideal = Number(f[CS['Stock ideal'] - 1]) || 0, disp = Number(f[CS['Disponible'] - 1]) || 0;
  const cantidad = ideal ? Math.max(ideal - disp, 0) : '';
  const prov = proveedorDatos_(proveedor);
  const saludo = prov.contacto || proveedor;
  const mensaje = 'Hola' + (saludo ? ' ' + saludo : '') + ', le escribimos de Emporio Sabroso (Distribuidora Avícola Santa Bárbara SpA, RUT 77.586.055-3). '
    + 'Queremos hacer este pedido (' + numero + '):\n- ' + (cantidad !== '' ? cantidad + ' u de ' : '') + producto + ' (código ' + cod + ')\n'
    + '¿Nos confirma el precio y la fecha de entrega en Arturo Prat 720, Chillán? Gracias.';
  const num = String(prov.whatsapp || '').replace(/\D/g, '').replace(/^(9\d{8})$/, '56$1');
  const enlace = /^569\d{8}$/.test(num) ? 'https://wa.me/' + num + '?text=' + encodeURIComponent(mensaje) : '';
  hoja.appendRow([numero, ahora, proveedor || '(falta el proveedor)', cod, producto, cantidad, disp, ideal || '', usuario, 'Por enviar al proveedor',
    num ? '+' + num : '(falta en «' + HOJA_PROVEEDORES + '»)', mensaje, enlace]);
  return { numero: numero, cod: cod, producto: producto, proveedor: proveedor, cantidad: cantidad, disp: disp, ideal: ideal, mensaje: mensaje, enlace: enlace, usuario: usuario };
}

function proveedorDatos_(nombre) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PROVEEDORES);
  if (!nombre || !hoja || hoja.getLastRow() < 2) return {};
  const fila = hoja.getRange(2, 1, hoja.getLastRow() - 1, COLUMNAS_PROVEEDORES.length).getValues()
    .filter(function (f) { return String(f[0]).trim().toLowerCase() === String(nombre).trim().toLowerCase(); })[0];
  return fila ? { contacto: String(fila[1] || ''), whatsapp: String(fila[2] || ''), correo: String(fila[3] || '') } : {};
}

function enviarOrdenCompra_(oc) {
  MailApp.sendEmail({
    to: CORREO_COMPRAS,
    name: 'SabAPP · Compras del Emporio',
    subject: 'Orden de compra ' + oc.numero + ' · ' + oc.producto + (oc.proveedor ? ' · ' + oc.proveedor : ''),
    body: oc.usuario + ' pidió reponer de inmediato:\n\n' + (oc.cantidad !== '' ? oc.cantidad + ' u de ' : '') + oc.producto + ' (' + oc.cod + ')\n'
      + 'Quedan ' + oc.disp + (oc.ideal ? ' de ' + oc.ideal : '') + '. Proveedor: ' + (oc.proveedor || 'falta anotarlo en «Stock del día»') + '.\n\n'
      + (oc.enlace ? 'Enviar por WhatsApp: ' + oc.enlace : 'Falta el WhatsApp del proveedor en la hoja «Proveedores». Mensaje listo para copiar:') + '\n\n' + oc.mensaje,
    htmlBody: '<div style="font:15px/1.5 Arial,Helvetica,sans-serif;color:#1c1c1a"><p style="margin:0 0 10px"><b>' + htmlEsc_(oc.usuario) + '</b> pidió reponer de inmediato (<b>' + htmlEsc_(oc.numero) + '</b>):</p>'
      + '<p style="margin:0 0 10px;font-size:17px"><b>' + (oc.cantidad !== '' ? oc.cantidad + ' u de ' : '') + htmlEsc_(oc.producto) + '</b> (' + htmlEsc_(oc.cod) + ')</p>'
      + '<p style="margin:0 0 12px;color:#66645c">Quedan ' + oc.disp + (oc.ideal ? ' de ' + oc.ideal : '') + ' · Proveedor: ' + htmlEsc_(oc.proveedor || 'falta anotarlo en «Stock del día»') + '</p>'
      + (oc.enlace ? '<p style="margin:0 0 12px"><a href="' + htmlEsc_(oc.enlace) + '" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#157a3e;color:#fff;text-decoration:none;font-weight:bold">Enviar la orden por WhatsApp</a></p>'
        : '<p style="margin:0 0 8px;color:#b3261e">Falta el WhatsApp del proveedor en la hoja «Proveedores». Mensaje listo para copiar:</p>')
      + '<pre style="margin:0;padding:12px;border-radius:10px;background:#f6f2e9;white-space:pre-wrap;font:14px/1.45 Arial,Helvetica,sans-serif">' + htmlEsc_(oc.mensaje) + '</pre></div>'
  });
}

// Menú de la planilla: decidir sobre la fila elegida en «Stock del día»
function stockFilaElegida_() {
  const hoja = SpreadsheetApp.getActiveSheet();
  if (hoja.getName() !== HOJA_STOCK) throw new Error('Elija una fila en la hoja «' + HOJA_STOCK + '».');
  const fila = hoja.getActiveRange().getRow();
  if (fila < 2) throw new Error('Elija la fila del producto.');
  return String(hoja.getRange(fila, 1).getValue());
}
function stockMenu_(decision) {
  const ui = SpreadsheetApp.getUi();
  try {
    const cod = stockFilaElegida_(), quien = Session.getActiveUser().getEmail() || 'Planilla';
    const oc = stockDecidir_(quien, cod, decision);
    ui.alert(decision === 'cerrar' ? cod + ' quedó cerrado en la página.' : decision === 'reabrir' ? cod + ' vuelve a estar en la página.'
      : 'Orden ' + oc.numero + ' creada' + (oc.errorCorreo ? ' (no se pudo enviar el correo: ' + oc.errorCorreo + ')' : ' y enviada a ' + CORREO_COMPRAS) + '.');
  } catch (err) { ui.alert(err.message); }
}
function stockCerrarElegido() { stockMenu_('cerrar'); }
function stockReabrirElegido() { stockMenu_('reabrir'); }
function stockPedirElegido() { stockMenu_('pedir'); }

// SabAPP con cuenta de Google: solo los administradores deciden
function panelStock(codigo, decision) {
  const u = exigirVendedor(); exigirAdmin_();
  const oc = stockDecidir_(u, codigo, decision);
  const d = panelDatos_(u); d.admin = true; if (oc) d.oc = oc;
  return d;
}
