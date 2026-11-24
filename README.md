# Plataforma de aprendizaje — I.E. Laura Vicuña

Plataforma web para que los estudiantes de la **Institución Educativa Laura Vicuña** (Armenia, Quindío) aprendan, practiquen y presenten evaluaciones por tema, y para que la docente administre el contenido y las notas.

Empezó con matemáticas de grado sexto y séptimo, y está diseñada para crecer a más áreas y grados.

## Qué hace

**Estudiantes**
- Ingresan con su grupo, su nombre y un PIN de 4 números (teclado grande, apto para tableta).
- Ven sus temas por periodo, con su progreso y notas.
- En cada subtema: explicaciones con actividades interactivas, práctica ilimitada con ejercicios generados al azar, taller y quiz calificados (una sola oportunidad) y recursos (videos y juegos).

**Docente**
- Abre o cierra subtemas (uno por uno o un tema completo) y puede programar fechas de apertura.
- Ve la matriz de notas por grado, periodo y grupo, y la exporta a Excel.
- Permite que un estudiante repita un quiz o taller.
- Genera un PIN nuevo cuando alguien lo olvida, y activa o desactiva estudiantes.
- Previsualiza los quices y talleres con sus respuestas.

## Arquitectura

```
apps/
  api/        Backend: Node.js + Express 5 + TypeScript + Drizzle ORM (SQLite)
    src/
      config/        Variables de entorno validadas con Zod
      db/            Esquema, conexión y migraciones
      modules/       Un módulo por dominio: auth, catalogo, practica, evaluaciones, docente
      generadores/   Motor de ejercicios aleatorios (un archivo por familia de temas)
      shared/        Errores, validación, azar y calificación
      scripts/       Semilla, datos de prueba, importación y creación de docentes
    seed/            Estructura académica y contenido en JSON
    drizzle/         Migraciones SQL generadas
  web/        Frontend: React 19 + Vite + TypeScript + Tailwind CSS 4 + TanStack Query
packages/
  shared/     Tipos de la API compartidos entre backend y frontend
```

### Decisiones de diseño

- **Las respuestas nunca salen del servidor.** Al abrir un quiz o taller, el servidor arma las preguntas, las guarda con sus respuestas y envía solo los enunciados. Al entregar, califica él. En la práctica, la respuesta viaja firmada dentro de un token que el navegador no puede leer.
- **Un intento por evaluación.** Recargar la página devuelve el mismo intento; no se pueden "re-sortear" las preguntas.
- **Seguridad de acceso.** PINs con hash `scrypt`, bloqueo temporal tras 5 intentos fallidos, límite de peticiones por equipo, sesión en cookie `httpOnly` y cabeceras de seguridad con Helmet.
- **Migración sin fricción.** Los estudiantes importados de la versión 1 entran con su mismo PIN. El hash viejo se convierte a `scrypt` en su primer ingreso.
- **IDs fijos en la semilla.** El contenido se enlaza a cada subtema por un ID estable, así que reconstruir la base nunca lo mezcla.
- **Escalable por áreas.** La jerarquía es área → grado + periodo → tema → subtema.
- **Accesibilidad.** Tipografía Atkinson Hyperlegible (diseñada para baja visión), letra base grande, foco visible con teclado, contraste alto y respeto por `prefers-reduced-motion`. Las fuentes van incluidas, así funciona sin internet.

## Requisitos

- Node.js 20 o superior

## Puesta en marcha (desarrollo)

```bash
npm install
cp apps/api/.env.example apps/api/.env   # en Windows: copy apps\api\.env.example apps\api\.env
npm run setup        # crea la base, carga el contenido y los datos de prueba
npm run dev          # API en :4000 y web en http://localhost:5173
```

**Datos de prueba** (`npm run db:demo`):

| Rol | Ingreso | PIN |
|---|---|---|
| Docente | usuario `profe` | `2468` |
| Estudiante | Prueba Sexto → Ana Prueba | `1111` |
| Estudiante | Prueba Sexto → Beto Prueba | `1122` |
| Estudiante | Prueba Séptimo → Ana Prueba | `2211` |
| Estudiante | Prueba Séptimo → Beto Prueba | `2222` |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Backend y frontend en modo desarrollo |
| `npm run build` | Compila el frontend |
| `npm start` | Sirve la API y el frontend compilado en el puerto 4000 |
| `npm test` | Pruebas automáticas |
| `npm run typecheck` | Verifica tipos en todo el proyecto |
| `npm run db:seed` | Carga o actualiza estructura y contenido (no duplica) |
| `npm run db:demo` | Crea la docente y los estudiantes de prueba |
| `npm run db:importar-legado -- "ruta/database.sqlite"` | Importa grupos y estudiantes de la versión 1 |
| `npm run docente:crear -- --nombre "Nombre" --usuario usuario --pin 123456` | Crea una cuenta docente |

## Agregar contenido

El contenido vive en `apps/api/seed/contenido/*.json` y se carga con `npm run db:seed`:

- `lecciones.json`: explicaciones en HTML. Admiten widgets interactivos: `<div data-widget="frecuencias" data-default="a, b, a"></div>`.
- `preguntas.json`: banco del quiz (`mcq`, `vf` o `abierta`).
- `generadores.json`: ejercicios aleatorios. Los tipos disponibles están en `apps/api/src/generadores/index.ts`.
- `guias.json`: talleres para resolver en el cuaderno (la solución solo la ve la docente).
- `recursos.json`: videos, juegos y enlaces.

La semilla valida todo antes de cargar: si una pregunta de opción múltiple no incluye su respuesta entre las opciones, o un generador no existe, te dice exactamente cuál.

## Licencia

MIT
