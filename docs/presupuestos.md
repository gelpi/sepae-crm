# Presupuestos

## Uso

- Desde Cotizador, el botón Crear presupuesto conserva las condiciones ingresadas. Se elige un contacto o se da de alta con el formulario existente y se seleccionan hasta seis alternativas (8/16/24 h, con o sin Convalecencia).
- Desde Presupuestos se pueden crear y consultar presupuestos, buscar por nombre/ID y filtrar por estado. La ficha de contacto incluye acceso a sus presupuestos.
- El borrador puede editarse. Al emitir se vuelven a consultar las tarifas y los datos del contacto; desde entonces se conserva la copia emitida.
- Aprobar exige elegir una alternativa y una fecha de venta. El contacto queda como socio y se agrega una entrada al historial. La misma aprobación no agrega ventas al reintentarse.
- La vigencia es informativa: no bloquea el enlace ni cambia automáticamente el estado. Vencido se marca manualmente. Los aprobados conservan su estado; no se cancelan con el botón de presupuesto.
- Los enlaces de borradores y cancelados no son públicos. Los emitidos, vencidos y aprobados pueden compartirse. Un PDF ya descargado no puede revocarse.

## Almacenamiento y despliegue

No hay variables de entorno nuevas. Se utilizan GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON y AUTH_SECRET existentes. La cuenta de servicio necesita los permisos de edición que ya usa el CRM.

La pestaña **Presupuestos** se crea automáticamente al guardar el primer borrador, sin modificar las columnas de contactos, Calculadora o Ventas. Cada fila contiene ID, vendedora, ID permanente del contacto, estado, fecha, vigencia, alternativa elegida y una copia JSON de datos, condiciones, alternativas e historial. Se guarda una fila por presupuesto para actualizar aprobación y contacto en una misma operación de Sheets; no hace falta otra pestaña para alternativas. Los cambios de estado se gestionan desde la app.

Las ventas manuales siguen en Ventas. Las ventas por presupuesto se derivan de su fila aprobada, con ID `presupuesto:<ID>`, y se combinan en el endpoint de ventas y los indicadores de contactos. Esto evita agregar filas duplicadas por reintentos o dos solicitudes simultáneas. Los reportes externos que lean solamente la pestaña Ventas deben incorporar los presupuestos aprobados.

La clave pública se calcula con HMAC y un ámbito distinto de los tokens de sesión. El ID por sí solo no da acceso. El enlace lleva la clave en su fragmento; la consulta pública la envía en una cabecera. La respuesta pública solo incluye nombre, localidad, fechas, estado y alternativas; omite teléfono, cédula, dirección, email, comentarios internos y vendedora. Quien tenga el enlace completo puede verlo. Rotar AUTH_SECRET invalida los enlaces compartidos (y las sesiones existentes).

## Verificación

- `pnpm test`: integración con Sheets en memoria; permisos, tarifas, precios guardados, vigencia, aprobación concurrente, venta única y acceso público.
- `pnpm typecheck`: comprobación TypeScript.
- `pnpm build`: compilación de producción.
- `tests/budgets-ui.mjs`: prueba de navegador con respuestas simuladas. Requiere Playwright y Edge; acepta PLAYWRIGHT_PATH si Playwright está fuera del proyecto. Verifica navegación móvil, ficha, alta desde cotizador, aprobación y descarga PDF.

Antes de habilitarlo al equipo, probar en Netlify con un contacto de prueba: crear borrador, emitir, compartir enlace sin sesión, descargar PDF, aprobar y comprobar Mis ventas. Estas pruebas no se ejecutan sobre contactos reales automáticamente.
