# Guía Definitiva de Despliegue en Cloudflare (Persistencia Realtime Garantizada)

Esta guía asegura que tus puntos queden guardados en la nube de Cloudflare de forma permanente: **si dejas de entrar semanas o meses, tus datos seguirán intactos**.

---

## 📌 ¿Cómo se garantiza que no se pierdan los datos?

La app utiliza **Cloudflare Durable Objects** y/o **Cloudflare KV**. Ambos son sistemas de almacenamiento distribuido persistente en disco/SSD en los centros de datos de Cloudflare:
- Los datos **no** dependen de tu navegador ni de la memoria temporal.
- Cada vez que alguien suma o resta (ej. `+0.5`), el valor queda escrito en el almacenamiento permanente.
- Cuenta con respaldo local automático en el navegador (`localStorage`) por si abres la app en un lugar sin conexión.

---

## 🚀 Paso a Paso para Desplegar

### 1. Iniciar sesión en Cloudflare desde tu terminal
Abre tu consola en la carpeta del proyecto y ejecuta:
```bash
npx wrangler login
```
*Se abrirá tu navegador para autorizar la conexión con tu cuenta de Cloudflare (es gratuita).*

---

### 2. Configurar el Almacenamiento Persistente en Cloudflare

Para que la persistencia funcione siempre, Cloudflare ofrece dos vías (puedes usar cualquiera de las dos):

#### Opción A: Cloudflare KV (La más sencilla y 100% gratuita)
Crea una base de datos clave-valor en tu cuenta:
```bash
npx wrangler kv:namespace create "POINTS_KV"
```
La terminal te devolverá una línea similar a:
`{ binding = "POINTS_KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }`

Copia esa línea en tu archivo `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "POINTS_KV"
id = "tu_id_aqui"
```

#### Opción B: Cloudflare Durable Objects (Para WebSockets en tiempo real instantáneo)
Ya está configurado en tu [wrangler.toml](file:///c:/Users/USUARIO/Code/1-PROYECTOS%20PERSONALES/points-tracker/wrangler.toml):
```toml
[durable_objects]
bindings = [
  { name = "POINTS_TRACKER_DO", class_name = "PointsTrackerDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["PointsTrackerDO"]
```
*(Disponible directamente en el plan Workers/Pages).*

---

### 3. Compilar y Desplegar el Proyecto

Ejecuta en tu terminal:

```bash
# 1. Compila la aplicación optimizada
npm run build

# 2. Despliega a Cloudflare Pages
npx wrangler pages deploy dist --project-name points-tracker
```

Durante el primer despliegue, Wrangler te preguntará si deseas crear el proyecto `points-tracker`. Responde que **Sí**.

Al finalizar, la consola te entregará la URL pública (ejemplo: `https://points-tracker.pages.dev`).

---

### 4. (Alternativa) Despliegue automático con GitHub / GitLab

Si prefieres conectar un repositorio Git para que se actualice solo:
1. Sube este proyecto a tu repositorio de GitHub:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/points-tracker.git
   git push -u origin master
   ```
2. Entra a [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Selecciona tu repositorio y define:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. En **Settings** > **Functions**:
   - Agrega la variable de entorno `SECURITY_PIN = 0000`.
   - Si creaste el KV, vincúlalo en **KV namespace bindings** con la variable `POINTS_KV`.

---

## 🔒 Recordatorio de Seguridad
- La clave para desbloquear el aumento o disminución de puntos es: **`0000`**.
- La sesión se puede bloquear manualmente en cualquier momento desde el botón superior.
