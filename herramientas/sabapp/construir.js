// Arma la página de SabAPP para www.avicolasb.com/sabapp a partir de apps-script/Panel.html (la misma app).
// Uso: node herramientas/sabapp/construir.js
// En avicolasb.com no existe google.script.run: la página entra con correo + RUT y habla con el script por su API.
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
// Implementación de Apps Script «SabAPP (correo y RUT)», con acceso «Cualquiera» (solo responde a la API con sesión)
const API = 'https://script.google.com/macros/s/AKfycbzezlxDUrWOtHP-LQWa_2iiL8sBrNz6UsqvweuQri5XO_lKC6MipFCfm8eNyZfslMmi/exec';
let h = fs.readFileSync(path.join(RAIZ, 'apps-script', 'Panel.html'), 'utf8');
const pon = (a, b) => { if (h.split(a).length !== 2) throw new Error('No se encontró: ' + a); h = h.replace(a, b); };
pon("var API_SABAPP = '';", "var API_SABAPP = '" + API + "';");
pon('<meta charset="utf-8">', `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://www.avicolasb.com data:; connect-src https://script.google.com https://script.googleusercontent.com; base-uri 'self'; form-action 'none'">
<link rel="icon" href="../img/huevo-sabroso-isotipo.png">`);
fs.writeFileSync(path.join(RAIZ, 'sabapp', 'index.html'), '<!DOCTYPE html>\n' + h.replace(/^<!DOCTYPE html>\s*/i, ''));
console.log('sabapp/index.html listo (' + API.slice(0, 60) + '…)');
