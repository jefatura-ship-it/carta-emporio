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

## Hecho el 11/11/2026 en Claude Code (misma rama, SIN publicar)
- **`legal.html`** (borrador): quiénes somos, privacidad, cookies y datos guardados, baja, eliminación, menores, términos, cambios y devoluciones, accesibilidad, licencias y contacto. Anclas: `#quienes #privacidad #cookies #baja #eliminacion #menores #terminos #devoluciones #accesibilidad #licencias #contacto`. Lleva un aviso de borrador arriba y tres puntos `<mark class="pend">` por confirmar.
- **Correo de datos:** `supermerca.do@avicolasb.com` (lo dio David). Está en `legal.html`, en `web/index.html` y en el pie de la carta (`CORREO_DATOS`).
- **`web/index.html`**: página del Emporio (qué vende, cómo se compra, pedir antes de venir, venta por mayor, 5 % de bienvenida, dónde y cuándo, pie legal). Sin recursos externos. Antes del 23/11 anuncia la apertura y después muestra el horario; el bloque del descuento se oculta desde el 05/12.
- **`apps-script/Registro clientes carta Emporio.gs`**: escrito completo (el original no estaba en el equipo). Tipos `registro`, `uso`, `baja` y `eliminar`. La baja se aplica al instante; la eliminación queda como solicitud en la hoja "Solicitudes" y una persona la confirma antes de borrar (menú "Registro de clientes"). Sin instalar ni probar en Google: solo se revisó la sintaxis.
- **Carta:** los botones de baja y eliminación avisan también a la planilla cuando `REGISTRO_URL` tenga dirección; la baja desmarca las ofertas en el celular.
- **Accesibilidad (axe 4.14, WCAG 2.1 A/AA y buenas prácticas):** cero violaciones en la carta del Emporio, la de la Distribuidora, las ventanas de registro y de pedido, `legal.html` y `web/`. Se corrigió: título principal (`h1` con el logo), bloques fuera de regiones (`section`/`nav` con nombre) y el lema del encabezado del Emporio (`#ffd76a`, 4,8:1; con `--trigo` daba 3,6:1). El encabezado verde de la Distribuidora cumple (4,6:1 a 5,0:1).
- Ojo al auditar: si la ventana de la aplicación está tapada, la animación `sube` queda detenida con opacidad 0,6 y axe reporta contraste falso en los diálogos. Terminar las animaciones antes de medir.

## Página web «Del campo a tu mesa» (11/11/2026, noche; reemplaza la primera versión de `web/index.html`)
Pedido de David: página amplia que cuente quiénes somos desde Avícola El Huevo Sabroso, con paneles que se mueven al bajar, cuadros flotantes con fotos, objetos 3D que giran, cambian de color y se abren, un espacio 3D para recorrer, un viaje con capas (parallax), un mezclador de sonidos tipo Incredibox, todos los productos del Emporio flotando y una promo «Gym Bro».
- **Estructura:** `web/index.html` (contenido y estilos), `herramientas/fuente/viaje.js` (fuente) → `web/js/viaje.js` (construido con esbuild, incluye three.js 0.187). Reconstruir: en `herramientas`, `npm install` y `npm run construir`. `herramientas/node_modules` está en `.gitignore`.
- **Secciones:** Avícola con el huevo que se mece, pasa de blanco a café y se abre · El viaje (paisaje por capas, camión de la avícola al Emporio, el cielo pasa de amarillo a verde) · Emporio (productos flotando, promo) · La repisa (escena 3D con 14 productos que flotan y giran; rueda con el desplazamiento, arrastre o gesto lateral; zoom con + y −; cada producto se abre) · La banda del gallinero (6 capas de sonido generadas con Web Audio, sin archivos) · Dónde.
- **Datos usados (no inventar más):** del pendón de la avícola: huevos, insumos avícolas, alimentos terminados, comercialización de pollitas, sector Oro Verde, lema «Nuestro huevo es sano, rico y natural». No se publicó el número de parcela.
- **Imágenes:** `web/img/avicola-aerea-*.jpg` (fotos de dron propias, de Drive MU25-0301-02), `logo-huevo-sabroso.png` (de Drive MU25-0303-01), `huevos-cafe.jpg` y `huevos-caja.jpg` (Wikimedia Commons, dominio público). Créditos en `legal.html#licencias`.
- **Mejora progresiva:** sin JavaScript, sin WebGL o con «reducir movimiento» la página se lee completa y la repisa es una lista. Los lienzos 3D llevan `aria-hidden` y el contenido está en el HTML. axe: cero violaciones en escritorio, con y sin movimiento.
- **Para probar:** `window.viajeAvanza(120)` adelanta cuadros de animación (el panel de vista previa los congela cuando no está a la vista).
- **Promo Gym Bro (bandeja de huevos + Monster):** sin precio ni vigencia («consulta en el local o por WhatsApp»). La carta no tiene ningún producto Monster ni categoría de bebidas.
- **Cambios pedidos por David esa misma noche (mandan sobre lo anterior):**
  - No le gustaron los productos ni el huevo hechos con figuras geométricas: todo producto va con **fotografía real recortada**, nunca dibujos. `web/img/productos/*.webp` (14 fotos) y `web/img/huevo-{blanco,cafe,abierto}.webp` se generaron con Higgsfield (`gpt_image_2_6`; 0,25 créditos la foto simple; `background: "transparent"` y `quality: "high"` evitan el paso de quitar fondo) y se pasaron a WebP con sharp (640 px los productos, 900×1200 el huevo). El huevo ya no es 3D: son tres fotos con la misma pose que se funden al bajar. La lata de Monster es una foto real de Wikimedia Commons (DYVER, CC BY-SA 4.0), recortada.
  - En la repisa cada producto es una lámina con su foto que **flota y se mece**; «Girar y acercar» la hace dar vueltas. En el Emporio hay fotos de productos flotando a los lados.
  - **Base sobria:** fondo papel `#f6f3ee`, carbón `#1c1c1a` y grises. La paleta de cada marca queda **solo como acento** (halo amarillo tras el huevo, etiquetas, botones, títulos verdes). No volver a usar el verde ni el amarillo como fondo de sección.
  - Fondos de ambiente: `web/img/fondo-emporio.jpg` y `web/img/huevos-editorial.jpg` (Higgsfield). Las imágenes premium de Canva no se usaron: su licencia no permite sacarlas sueltas a un sitio web.
  - `legal.html#licencias` declara que las fotos de productos son referenciales y hechas con IA.

## Pendiente
0. Página web: David define precio, vigencia y stock de la Promo Gym Bro (y confirma que el Emporio venderá Monster); revisa los textos de «Quiénes somos»; confirma que quiere publicar las fotos aéreas de la avícola.
1. Resolver los tres puntos por confirmar de `legal.html` y quitar el aviso de borrador (bloque `.borrador`) y el "(borrador)" de la fecha.
2. Revisión de un abogado antes de publicar los textos legales.
3. Instalar el script en la planilla EM27-07, pegar la URL en `REGISTRO_URL` y probar un registro, un uso, una baja y una eliminación reales.
4. David revisa los textos de `web/index.html` (descripciones de cada rubro).
5. Publicar: fusionar esta rama en `main` solo cuando David lo apruebe. La web quedará en `/carta-emporio/web/`.

## Preguntas abiertas para David
- ¿Los precios incluyen IVA? David dijo (11/11) que los precios de la carta no son los correctos y que los subirá más adelante; no tocar precios.
- ¿Habrá cambios por gusto (producto en buen estado, cliente arrepentido), además de la garantía legal? Se le explicó la diferencia; falta su decisión y, si es sí, plazo y condiciones.
- Forma y plazo de la devolución del dinero según el medio de pago.
- Precios definitivos para quitar el aviso de "precios provisorios".

## Reglas
- No inventar precios, fechas, políticas ni el número de resolución sanitaria.
- Logos oficiales: solo mover, escalar o atenuar.
- Sin RUT de personas ni datos personales en el repositorio (el RUT de la empresa sí).
- Los textos legales son un borrador: recomendar revisión de un abogado antes de publicar.
