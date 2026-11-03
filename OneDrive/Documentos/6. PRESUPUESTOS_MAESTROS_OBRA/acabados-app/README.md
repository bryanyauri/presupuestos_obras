# Calculadora de Presupuestos de Acabados

Aplicación web para estimar materiales y mano de obra por partida de obra, y generar una cotización en PDF. Está construida con Vue 3 y Vite; obtiene el catálogo de actividades y materiales desde Supabase.

## Funcionalidades

- Selección de una actividad y captura del metrado.
- Cálculo de cantidades con 10 % de reserva y redondeo a unidades comerciales enteras.
- Edición del rendimiento y precio referencial de cada insumo.
- Marca de referencia y agregado de insumos del catálogo o de insumos personalizados.
- Estimación de mano de obra como porcentaje del subtotal de materiales.
- Opción para incluir IGV (18 %) y para indicar herramientas y limpieza final.
- Interfaz adaptable a escritorio y móvil.
- Aplicación web progresiva (PWA) instalable en navegadores compatibles.
- Exportación de una cotización PDF con cliente, proyecto, validez, detalle, servicios y totales.
- Envío anónimo de comentarios, sugerencias o reportes de problemas.
- Límite de 10 descargas de cotización al mes por navegador mediante cookie firmada por el backend.

## Requisitos

- Node.js compatible con Vite 8 y npm.
- Acceso a un proyecto Supabase configurado con las tablas y la vista descritas abajo.
- Vercel CLI para ejecutar las rutas API localmente.

Instala el CLI una vez con `npm install --global vercel` y enlaza el proyecto con `vercel link` si aún no está vinculado.

## Instalación y ejecución

Desde la carpeta del proyecto:

```bash
npm install
npm run dev:vercel
```

`vercel dev` sirve la interfaz y las funciones de `api/` en el mismo origen. `npm run dev` inicia solo Vite y no sirve las rutas backend. Para crear y probar una compilación de producción:

```bash
npm run build
npm run preview
```

La configuración PWA se verifica en la compilación de producción servida por `npm run preview`; el servidor de desarrollo no es el modo de prueba del service worker.

## Uso

1. Selecciona una actividad del catálogo.
2. Ingresa el metrado y el porcentaje de mano de obra.
3. Revisa los insumos. Puedes cambiar su rendimiento o precio, quitarlos o agregar otros.
4. Activa las opciones de herramientas y limpieza, y decide si el presupuesto debe incluir IGV.
5. Comprueba los subtotales y el total estimado.
6. Descarga la cotización PDF e ingresa los datos del cliente, proyecto y vigencia.

Las actividades nuevas y los cambios hechos a la lista de insumos sirven para la sesión actual; no se escriben en Supabase. Al recargar la página, se vuelve a cargar el catálogo original.

## Cálculo del presupuesto

Para cada insumo, el rendimiento indica cuántas unidades de la actividad cubre una unidad de compra. El cálculo incorpora una reserva fija del 10 % antes de redondear:

```text
cantidad calculada = (metrado / rendimiento) * 1.10
cantidad comercial = redondeo hacia arriba de la cantidad calculada
subtotal del insumo = cantidad comercial * precio referencial
subtotal sin IGV = subtotal de materiales + mano de obra
IGV = subtotal sin IGV * 0.18 (solo si se activa la opción)
presupuesto total = subtotal sin IGV + IGV
```

El rendimiento se protege de valores no positivos usando `1` como valor de cálculo. La mano de obra se calcula sobre el subtotal de materiales. Las opciones de herramientas y limpieza aparecen como condiciones en el PDF, pero actualmente no agregan importes al presupuesto. El IGV se aplica al subtotal de materiales más mano de obra. El total por unidad de metrado se muestra como referencia.

## Configuración del backend

El navegador llama a funciones same-origin de Vercel; no contiene credenciales de Supabase. Las lecturas, comentarios, cálculos, PDF y control de cuota pasan por `api/` y `server/`.

Configura estas variables en Vercel para Development, Preview y Production:

| Variable | Uso |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso privado desde las funciones backend. Nunca usar un prefijo `VITE_` ni incluirla en el frontend. |
| `QUOTE_COOKIE_SECRET` | Secreto aleatorio de al menos 32 caracteres para firmar la cookie de cuota. |

Para desarrollo local, copia `.env.example` como `.env.local`, completa los valores directamente en tu equipo y ejecuta `npm run dev:vercel`. No publiques ni compartas `.env.local`. Puedes generar un secreto con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.

La aplicación consulta estos objetos mediante `SUPABASE_SERVICE_ROLE_KEY` en el servidor:

| Objeto | Columnas utilizadas |
| --- | --- |
| `actividades` | `id`, `nombre`, `categoria`, `unidad_medida` |
| `materiales` | `id`, `nombre`, `marca_referencia`, `unidad_medida`, `precio_referencial` |
| `vista_plantilla_completa` | `actividad_id`, `material_id`, `material_nombre`, `marca_referencia`, `material_unidad_compra`, `rendimiento_m2`, `precio_referencial` |

La vista se consulta por `actividad_id`. Este repositorio no incluye el SQL de creación de esos catálogos ni sus relaciones; deben existir en Supabase antes de ejecutar la app.

### Habilitar comentarios

Antes de usar el formulario, abre el SQL Editor del proyecto Supabase y ejecuta [`supabase/setup_comments.sql`](supabase/setup_comments.sql). El script crea `public.comentarios`, activa RLS y deja permisos de tabla solo para `service_role`; el endpoint valida y guarda el tipo y el mensaje. Los comentarios pueden revisarse desde el panel de Supabase.

El formulario no solicita nombre ni correo. Pide a los usuarios que no incluyan datos personales o de clientes. Como el envío es público, una prueba abierta puede recibir spam; para un lanzamiento amplio, añade protección contra abuso o rate limiting en un endpoint de servidor.

## Estructura del proyecto

```text
api/
	catalogo.js       Lecturas del catálogo
	plantilla.js      Insumos por actividad
	calcular.js       Validación y cálculo del presupuesto
	cotizacion.js     PDF y cuota mensual
	comentarios.js    Recepción anónima de comentarios
	estado.js         Cuota disponible
server/
	calculation.js    Reglas de cálculo y validación
	quota.js          Cookie de cuota firmada
	pdf.js            Generación del documento
	supabase.js       Cliente Supabase privado del servidor
src/
	App.vue       Interfaz y estado visual
	api.js        Cliente HTTP same-origin
	main.js       Punto de entrada de Vue y registro del service worker
public/
	pwa-192x192.png  Icono de la aplicación
	pwa-512x512.png  Icono grande y máscara PWA
supabase/
	setup_comments.sql  Esquema privado de comentarios
index.html      Documento HTML servido por Vite
vite.config.js  Configuración de Vite y PWA
```

## Aplicación instalable (PWA)

`vite-plugin-pwa` genera el manifiesto y el service worker durante la compilación. La aplicación registra el service worker con actualización automática y precarga los archivos estáticos incluidos en el build. En un navegador compatible, puede instalarse desde la opción de instalación del navegador; para publicar el service worker, el sitio debe servirse por HTTPS (localhost también es válido para desarrollo).

El cacheado cubre recursos estáticos, no las llamadas a las funciones API. Por eso se necesita conexión a internet para cargar actividades, materiales y enviar operaciones; la aplicación no ofrece actualmente uso completo sin conexión. Los iconos de instalación están en `public/pwa-192x192.png` y `public/pwa-512x512.png`.

## Cuota y persistencia

La cuota se firma en una cookie `HttpOnly`, por lo que JavaScript no puede modificar directamente su contador. Como no hay cuentas de usuario ni una base de cuotas, borrar la cookie permite empezar otra vez; no es una barrera antifraude fuerte.

La aplicación no guarda presupuestos ni persiste las actividades o insumos personalizados. Los precios y rendimientos editados se mantienen en el estado de la sesión hasta recargar. El servidor valida las entradas antes de calcular y generar el PDF.

## Scripts disponibles

| Comando | Acción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo Vite. |
| `npm run dev:vercel` | Inicia la interfaz y las funciones API localmente. |
| `npm run build` | Genera la versión de producción en `dist/`. |
| `npm run preview` | Sirve localmente la compilación de `dist/`. |
| `npm test` | Ejecuta pruebas unitarias de cálculo y cuota. |

Las funciones API deben probarse con `vercel dev`; `vite preview` solo sirve la salida estática.
