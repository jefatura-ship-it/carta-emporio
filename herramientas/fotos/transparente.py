# Recorte de envases transparentes fotografiados sobre fondo azul (fotos de David, 17/11/2026).
# 1) GrabCut partiendo de un contorno aproximado (polígono) y se rellenan los huecos; la tela beige siempre es fondo.
# 2) Se estima el fondo detrás del producto (superficie suave ajustada con la pared alrededor).
# 3) Dentro del producto: color = blanco hueso × (luminancia de la foto / luminancia del fondo):
#    el plástico transparente pierde el azul y conserva sus reflejos, rayas y el negro de la base.
import sys, json, numpy as np, cv2
from PIL import Image
HUESO = np.array([251, 246, 236], np.float32)
def recorta(ruta, poli, salida, margen=35, brillo=1.5, suave=25, q=8, soloPoligono=False):
    im = np.asarray(Image.open(ruta).convert('RGB')); H, W = im.shape[:2]; f = im.astype(np.float32)
    polis = poli if isinstance(poli[0][0], list) else [poli]
    dentro = np.zeros((H, W), np.uint8); [cv2.fillPoly(dentro, [np.array(x, np.int32)], 1) for x in polis]
    cerca = cv2.dilate(dentro, np.ones((2 * margen + 1, 2 * margen + 1), np.uint8))
    tela = (np.minimum(f[..., 0], f[..., 1]) - f[..., 2] > 18) & (f.mean(axis=2) > 90)
    m = np.full((H, W), cv2.GC_BGD, np.uint8); m[cerca == 1] = cv2.GC_PR_BGD; m[dentro == 1] = cv2.GC_PR_FGD
    m[cv2.erode(dentro, np.ones((61, 61), np.uint8)) == 1] = cv2.GC_FGD; m[tela & (m != cv2.GC_FGD)] = cv2.GC_BGD
    bg = np.zeros((1, 65), np.float64); fg = np.zeros((1, 65), np.float64)
    cv2.grabCut(cv2.cvtColor(im, cv2.COLOR_RGB2BGR), m, None, bg, fg, 6, cv2.GC_INIT_WITH_MASK)
    k = np.where((m == 1) | (m == 3), 1, 0).astype(np.uint8)
    k = cv2.morphologyEx(k, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)); k = cv2.morphologyEx(k, cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(k); k = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    # huecos: lo que no toca el borde de la foto (con un marco de 1 px, así la tela bajo la base no queda «encerrada»)
    inv = np.pad(1 - k, 1, constant_values=1); ff = np.zeros((H + 4, W + 4), np.uint8); cv2.floodFill(inv, ff, (0, 0), 2); k = np.where(inv[1:-1, 1:-1] == 2, 0, 1).astype(np.uint8)
    # fotos borrosas: el corte automático deja bultos; se usa el polígono mismo, con las esquinas redondeadas
    if soloPoligono: k = (cv2.GaussianBlur(dentro.astype(np.float32), (0, 0), 6) > 0.5).astype(np.uint8)
    L = f.mean(axis=2)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); yy /= H; xx /= W
    # luz del fondo detrás del producto: se rellena la zona del producto con lo que la rodea (inpaint en chico) y se suaviza
    Lc = cv2.resize(L, (W // q, H // q), interpolation=cv2.INTER_AREA)
    hueco = cv2.resize(((cerca == 1) | tela).astype(np.uint8), (W // q, H // q), interpolation=cv2.INTER_NEAREST)
    Lr = cv2.inpaint(np.clip(Lc, 0, 255).astype(np.uint8), hueco, 25, cv2.INPAINT_TELEA).astype(np.float32)
    Lbg = np.maximum(cv2.GaussianBlur(cv2.resize(Lr, (W, H), interpolation=cv2.INTER_CUBIC), (0, 0), suave), 40)
    r = L / Lbg
    # más claro que el fondo solo en los brillos del plástico (zonas con detalle), no en zonas lisas de la pared
    det = cv2.GaussianBlur(np.abs(L - cv2.GaussianBlur(L, (0, 0), 3)), (0, 0), 4)
    det = np.clip((det - 2) / 6, 0, 1)
    r = np.minimum(r, 1) + np.clip(r - 1.1, 0, 0.3) * det * brillo
    # sobre fondo oscuro (borde del monitor) el plástico se ve por sus reflejos: se dibuja en gris según cuánto difiere del fondo
    r_osc = 1 - np.clip(np.abs(L - Lbg) / 110, 0, 0.6)
    w = np.clip((Lbg - 55) / 50, 0, 1)
    r = w * r + (1 - w) * r_osc
    rgb = np.clip(HUESO * r[..., None], 0, 255)
    a = cv2.GaussianBlur(k.astype(np.float32), (0, 0), 1.5)
    x, y, w, h = cv2.boundingRect(k)
    Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8)[y:y + h, x:x + w], 'RGBA').save(salida)
    return w, h
if __name__ == '__main__':
    cfg = json.load(open(sys.argv[1], encoding='utf-8'))
    for nombre, c in cfg.items(): print(nombre, recorta(c['foto'], c['poli'], c['salida'], brillo=c.get('brillo', 1.5), suave=c.get('suave', 25), q=c.get('q', 8), soloPoligono=c.get('soloPoligono', False)))
