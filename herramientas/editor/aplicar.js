// Aplica al catálogo (carta/index.html) los cambios que David descargó desde el Editor del Catálogo Sabroso.
// Uso:  node herramientas/editor/aplicar.js [archivo.json] [--solo-ver]
//   sin archivo: toma el «cambios-catalogo-*.json» más reciente de la carpeta Descargas
//   --solo-ver : muestra el resumen y valida, sin modificar el catálogo
const fs = require('fs');
const path = require('path');
const os = require('os');
const E = require('./cambios.js');

const args = process.argv.slice(2);
const soloVer = args.includes('--solo-ver');
let archivo = args.find(a => !a.startsWith('--'));
if (!archivo) {
  const desc = path.join(os.homedir(), 'Downloads');
  const lista = fs.existsSync(desc) ? fs.readdirSync(desc).filter(f => /^cambios-catalogo-.*\.json$/.test(f)).map(f => ({ f: path.join(desc, f), t: fs.statSync(path.join(desc, f)).mtimeMs })).sort((a, b) => b.t - a.t) : [];
  if (!lista.length) { console.error('No encontré ningún «cambios-catalogo-*.json» en Descargas.'); process.exit(1); }
  archivo = lista[0].f;
}
const paquete = JSON.parse(fs.readFileSync(archivo, 'utf8'));
if (paquete.tipo !== 'cambios-catalogo-sabroso' || !paquete.cambios) { console.error('El archivo no es de cambios del editor del catálogo.'); process.exit(1); }
// El 16/11/2026 la carta pasó a los códigos nuevos de MyPyme: un archivo de cambios anterior usa los códigos
// provisorios y caería en productos equivocados (ej.: ALU002 era la pavera y ahora es el C 15 con tapa).
const CODIGOS_NUEVOS_DESDE = '2026-11-17T00:25:00Z'; // 16/11/2026 21:25, hora de Chile
if (!(String(paquete.fecha || '') >= CODIGOS_NUEVOS_DESDE)) { console.error('Este archivo de cambios es de antes del cambio a los códigos nuevos de MyPyme (16/11/2026): sus códigos ya no corresponden. Vuelve a abrir el editor, rehaz los cambios y descárgalos de nuevo.'); process.exit(1); }

const ruta = path.join(__dirname, '..', '..', 'carta', 'index.html');
const html = fs.readFileSync(ruta, 'utf8');
const base = E.leerCatalogo(html);
const nuevo = E.aplicarCambios(html, paquete.cambios);

// Validaciones: el JavaScript del catálogo sigue siendo válido y se puede volver a leer
const scripts = [...nuevo.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => { new Function(s); });
E.leerCatalogo(nuevo);

console.log('Archivo: ' + archivo + '\nDescargado el: ' + paquete.fecha + '\n\nCambios:');
E.resumen(base, paquete.cambios).forEach(r => console.log(' - ' + r));
if (soloVer) { console.log('\n(solo ver: el catálogo no se modificó)'); process.exit(0); }
fs.writeFileSync(ruta, nuevo);
console.log('\nListo: carta/index.html actualizado. Falta probarlo y publicarlo (con el sí de David).');
