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
<link rel="icon" href="../img/huevo-sabroso-isotipo.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icono-apple-180.png">
<meta name="theme-color" content="#1f5f3a">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="SabAPP">
<meta name="apple-mobile-web-app-status-bar-style" content="default">`);
// En celulares y tablets la pantalla no se apaga mientras SabAPP está abierta y a la vista (para que suene al llegar un pedido).
// Va solo en la página web: en la SabAPP con cuenta de Google (Apps Script) no aplica.
pon('</body>', `<script>
(function () {
  if (!('wakeLock' in navigator) || !window.matchMedia || !matchMedia('(pointer: coarse)').matches) return;
  var candado = null, pidiendo = false;
  function pedir() {
    if (candado || pidiendo || document.visibilityState !== 'visible') return;
    pidiendo = true;
    navigator.wakeLock.request('screen').then(function (c) {
      candado = c; pidiendo = false;
      c.addEventListener('release', function () { candado = null; });
    }).catch(function () { pidiendo = false; });
  }
  pedir();
  document.addEventListener('visibilitychange', pedir);
  document.addEventListener('pointerdown', pedir, { passive: true });
})();
</script>
</body>`);
fs.writeFileSync(path.join(RAIZ, 'sabapp', 'index.html'), '<!DOCTYPE html>\n' + h.replace(/^<!DOCTYPE html>\s*/i, ''));
console.log('sabapp/index.html listo (' + API.slice(0, 60) + '…)');
