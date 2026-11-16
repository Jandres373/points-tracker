# Points Tracker - Vivi & Andy 🏆

Aplicación web en tiempo real diseñada para el seguimiento y conteo de puntos para **Vivi** y **Andy**, construida con **React + TypeScript + Tailwind CSS** y desplegable en **Cloudflare Pages** con soporte de persistencia y sincronización en tiempo real mediante **Cloudflare Durable Objects / WebSockets**.

---

## 🚀 Características
- **Marcador en Vivo**: Contadores visuales de *Puntos Vivi* y *Puntos Andy* con animaciones y destaque del líder.
- **Seguridad por PIN**: Para evitar modificaciones no autorizadas o accidentales, los botones de aumento y disminución se desbloquean únicamente ingresando el código PIN: **`0000`**.
- **Teclado Numérico Integrado**: Panel táctil y numérico para ingresar la clave de forma intuitiva tanto en móviles como en ordenadores.
- **Sincronización en Tiempo Real**: WebSocket nativo soportado en Cloudflare Pages a través de *Durable Objects* para reflejar cambios instantáneamente entre todos los usuarios conectados.
- **Persistencia y Resiliencia**: Funciona con sincronización en la nube y persistencia en caché local (offline first fallback).

---

## 🛠️ Estructura del Proyecto

```
points-tracker/
├── functions/
│   ├── api/
│   │   └── points.ts         # Endpoint de Cloudflare Pages Functions
│   └── durable-object.ts     # Cloudflare Durable Object (WebSockets y almacenamiento Realtime)
├── src/
│   ├── App.tsx               # Componente principal con UI y lógica PIN
│   ├── index.css             # Tailwind CSS
│   └── main.tsx              # Punto de entrada React
├── package.json
├── vite.config.ts
├── wrangler.toml             # Configuración de Cloudflare Pages y Durable Objects
└── README.md
```

---

## 💻 Ejecución en Desarrollo

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Iniciar el servidor local de Vite:
   ```bash
   npm run dev
   ```

---

## ☁️ Despliegue en Cloudflare Pages

### Opción 1: Conexión mediante GitHub / GitLab (Recomendada)
1. Sube este repositorio a tu cuenta de GitHub.
2. Ingresa a [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Selecciona tu repositorio y define los siguientes ajustes de compilación:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. ¡Haz clic en **Save and Deploy**!

### Opción 2: Despliegue directo con Wrangler CLI
1. Asegúrate de haber iniciado sesión con tu cuenta de Cloudflare:
   ```bash
   npx wrangler login
   ```
2. Compila el proyecto:
   ```bash
   npm run build
   ```
3. Despliega en Cloudflare Pages:
   ```bash
   npx wrangler pages deploy dist --project-name points-tracker
   ```
