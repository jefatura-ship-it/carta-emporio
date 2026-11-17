# Productos en bolsa transparente sobre pared azul: contorno medido de la bolsa; lo que dentro de la bolsa es pared
# azul vista a través del plástico pasa a gris claro (plástico transparente sobre el fondo blanco hueso).
# Config JSON: {"clave": {"foto", "salida", "poli", "protege"?: [[x0,y0,x1,y1], …]}}; «protege» son zonas impresas
# en azul/celeste (etiquetas) que no se tocan.   Uso: python -I -X utf8 bolsa.py config.json
import sys, os, json
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from opaco import guarda
for clave, c in json.load(open(sys.argv[1], encoding='utf-8')).items():
    im = np.asarray(Image.open(c['foto']).convert('RGB')); H, W = im.shape[:2]
    k = 4; g = np.zeros((H * k, W * k), np.uint8); cv2.fillPoly(g, [np.round(np.array(c['poli']) * k).astype(np.int32)], 1)
    f = (cv2.resize(g.astype(np.float32), (W, H), interpolation=cv2.INTER_AREA) > 0.5).astype(np.uint8)
    hsv = cv2.cvtColor(im, cv2.COLOR_RGB2HSV); h, s = hsv[..., 0].astype(int), hsv[..., 1].astype(int)
    h0 = c.get('tonoDesde', 95)   # 103 deja fuera el celeste/turquesa impreso (tono ~95) y toma solo el azul de la pared
    azul = ((h >= h0) & (h <= 135) & (s > 45)).astype(np.float32)
    for x0, y0, x1, y1 in c.get('protege', []): azul[y0:y1, x0:x1] = 0
    azul = cv2.GaussianBlur(azul, (0, 0), 2)[..., None]
    a = im.astype(np.float32); L = (a @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    gris = 0.7 * np.array([251, 246, 236], np.float32) + 0.3 * (L * 1.3)
    a = a * (1 - azul) + gris * azul
    print(clave, guarda(a.clip(0, 255).astype(np.uint8), f, c['salida']))
