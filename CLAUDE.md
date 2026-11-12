# Carta QR · Emporio Sabroso y Distribuidora Santa Bárbara

Traspaso desde el chat "Creatividad Higgsfield" (11/11/2026). Responder siempre en español latinoamericano.

## Qué es
- `index.html`: carta de pedidos en un solo archivo (GitHub Pages). `?local=emporio` (por defecto) o `?local=distribuidora`.
- Publicada desde `main`: https://jefatura-ship-it.github.io/carta-emporio/
- Los productos salen de la planilla de inventario MyPyme (07/11/2026). `PRUEBA = true`: los precios son provisorios.
- Reglas del negocio ya implementadas: tapas dentro de su envase (1 envase = 1 tapa, precio sumado, stock = el menor de los dos), venta por paquete o unidad, precios por mayor, descuento de bienvenida 5 % una vez por cliente del 23/11 al 04/12/2026.

## Pedido de David (11/11/2026, 22:01)
Agregar a la carta: política de privacidad, términos y condiciones, política de reembolsos, política de cookies, banner de consentimiento, consentimientos en formularios, no recolectar datos innecesarios, auditar SDK de terceros, eliminar patrones oscuros, cobros ocultos, reseñas falsas y afirmaciones sin respaldo, texto alternativo, corrección de colores (contraste), navegación con teclado, datos del negocio, consentimiento parental, link de baja, licencia de imágenes y eliminación de datos. Además, crear una página web del Emporio y subirla con GitHub.

## Hecho en esta rama (`legal-accesibilidad`), probado en navegador, SIN publicar
- **Terceros:** se quitó Google Fonts; Fraunces queda en `fonts/fraunces.woff2` (OFL, licencia en `fonts/`). La carta ya no hace ninguna conexión externa. No hay analítica ni SDK.
- **Aviso de almacenamiento** (`#galleta`): "Solo lo necesario" / "Aceptar todo", botones iguales. Opcional = recordar nombre y preferencias de tapa / paquete-unidad (`guardaPref`, `leePref`, `decidir`). Necesario = pedido y registro.
- **Registro:** segundo nombre y apellido materno opcionales; casilla obligatoria "Tengo 18 años o más y acepto la política de privacidad"; casilla de ofertas opcional y sin marcar.
- **Pie** (`#pie`): razón social, RUT de la empresa, dirección, teléfono, enlaces a `legal.html#…`, botones "Cambiar qué se guarda", "Borrar mis datos de este celular", "Dejar de recibir ofertas" y "Pedir que eliminen mis datos" (estos dos abren WhatsApp con el texto listo).
- **Cobros:** nota en el pedido: se paga en el local, sin cargos por usar la carta.
- **Contraste AA:** `--sol-t` para texto naranja, texto oscuro sobre botones naranjos, `--wsp` más oscuro, borde de campos `--linea`, rayos del encabezado más suaves.
- **Teclado:** enlace "Saltar a los productos", diálogos con foco atrapado, Escape y retorno del foco (`abrirHoja`, `cerrarHoja`), `inert` en el fondo.
- **Texto alternativo:** fotos de producto con `alt` = nombre; íconos SVG con `aria-hidden`.
- `img/logo-emporio.webp` e `img/icono.png` extraídos para usarlos en la página web.

## Pendiente
1. **`legal.html`** (un solo documento con anclas; el pie ya enlaza a ellas): `#privacidad`, `#terminos`, `#devoluciones`, `#cookies`, `#accesibilidad`, más secciones de menores de edad, baja, eliminación de datos y licencias (logos propios, íconos dibujados para la carta, Fraunces OFL). Base legal chilena: Ley 19.628 y Ley 21.719 (datos personales), Ley 19.496 (consumidor: garantía legal de 6 meses; perecibles, el plazo del envase o 7 días). No inventar políticas voluntarias de cambio: preguntar a David.
2. **Página web del Emporio** en `web/index.html` (misma paleta y tipografía, sin recursos externos): qué vende, cómo se compra (vendedor → caja → retiro), venta por mayor, dirección (Arturo Prat 720, frente al Mercado Techado), horario (lunes a sábado 8:30 a 17:00), apertura 23/11/2026, botones a la carta, WhatsApp +56 9 3390 3395 e Instagram @emporio.sabroso, pie con los mismos enlaces legales.
3. Revisar la carta de la Distribuidora con el tema verde (contraste del encabezado) y pasar una auditoría de accesibilidad automática (axe).
4. `Registro clientes carta Emporio.gs` (Apps Script, aún sin instalar; `REGISTRO_URL` vacío): agregar tipos "baja" y "eliminar".
5. Publicar: fusionar esta rama en `main` solo cuando David lo apruebe.

## Preguntas abiertas para David
- ¿Los precios de la carta incluyen IVA? (no se afirmó en ningún texto)
- Correo de contacto para solicitudes de datos (hoy solo WhatsApp y el local).
- ¿Habrá cambios por gusto, además de la garantía legal?
- Precios definitivos para quitar el aviso de "precios provisorios".

## Reglas
- No inventar precios, fechas, políticas ni el número de resolución sanitaria.
- Logos oficiales: solo mover, escalar o atenuar.
- Sin RUT de personas ni datos personales en el repositorio (el RUT de la empresa sí).
- Los textos legales son un borrador: recomendar revisión de un abogado antes de publicar.
