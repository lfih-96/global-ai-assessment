# Global AI Assessment · The English Expedition

Prototipo funcional de evaluación de inglés A2 para la prueba técnica de Global AI. Incluye login, dashboard, 10 preguntas, resultados por habilidad, registro de intentos y progreso. La experiencia visual propone una expedición de aprendizaje con checkpoints y un mensaje del English Coach basado en reglas.

## Requisitos

- Node.js **24 o superior** (`node --version`). La base SQLite usa `node:sqlite` incorporado en Node 24.
- No requiere npm install, cuentas externas ni claves API.

## Ejecutar

1. Descomprime el proyecto y abre una terminal **dentro de `global-ai-assessment`**.
2. Ejecuta `npm start` o `node server/index.js`.
3. Abre **http://localhost:4173**.

En Windows PowerShell:

```powershell
cd global-ai-assessment
node --version
npm start
```

En otra terminal, `npm test` ejecuta la prueba de integración. `npm run dev` reinicia el servidor al modificar archivos del backend.

Credenciales de prueba (precargadas en el formulario de demostración):

```text
Correo:      estudiante@globalai.demo
Contraseña:  GlobalAI2026!
```

La base de datos se crea automáticamente en `data/global-ai.sqlite`. Para reiniciar los datos locales, detén el servidor y elimina la carpeta `data/` (esto borra los intentos registrados). El puerto se modifica con `PORT=5000` en macOS/Linux o `$env:PORT=5000; npm start` en PowerShell. La ruta de base de datos se puede configurar con `DB_PATH`.

## Recorrido del estudiante

1. Inicia sesión con las credenciales de prueba.
2. En el dashboard ve la misión y sus estadísticas; abre la evaluación.
3. Responde 10 preguntas: 4 de opción múltiple, 2 de completar, 2 de comprensión lectora y 2 de vocabulario.
4. Recorre Estación Prisma (Grammar, 6 retos), Ruta de los Ecos (Reading, 2) y Puerto de las Palabras (Vocabulary, 2). Confirma cada respuesta para recibir su explicación.
5. Cada confirmación queda guardada en SQLite y no puede cambiarse. Al confirmar el décimo reto, el servidor calcula y registra el resultado automáticamente.
6. Consulta el porcentaje global, Grammar/Reading/Vocabulary, aciertos, errores, explicación de cada pregunta y una recomendación educativa.
7. Ve el historial de hasta 20 intentos o repite la evaluación.

El nivel sugerido es una **orientación para el siguiente contenido** basada en un diagnóstico breve A2; no certifica un nivel MCER.

## Diseño técnico

```text
public/                 interfaz HTML, CSS y JavaScript modular
server/index.js         servidor HTTP, rutas API, sesión y corrección
server/db.js            esquema SQLite, seed y contraseñas
server/questions.js     banco inicial de preguntas y explicaciones
test/integration.test.js prueba integrada de login, calificación e historial
data/                   SQLite generado al ejecutar (ignorado por Git)
```

Una sola aplicación sirve archivos estáticos y API en el mismo origen; esto evita configuración de CORS en la demo. El navegador solicita `GET /api/assessment`, que excluye `correct_answer` y `explanation`. El servidor compara respuestas y guarda los resultados mediante una transacción. `POST /api/expedition/:id/answers` ignora puntos, porcentajes y banderas de acierto enviados por el cliente. El endpoint anterior de envío masivo devuelve 410.

| Método | Ruta | Propósito |
| --- | --- | --- |
| POST | `/api/login` | Credenciales y cookie de sesión |
| GET | `/api/me` | Sesión actual |
| POST | `/api/logout` | Revocar sesión |
| GET | `/api/assessment` | Evaluación sin respuestas correctas |
| GET | `/api/expedition` | Recuperar el último intento y solo el feedback confirmado |
| POST | `/api/expedition` | Crear o retomar el único intento abierto del usuario |
| POST | `/api/expedition/:id/answers` | Confirmar la siguiente pregunta y devolver feedback |
| GET | `/api/attempts` | Historial propio |

Entidades: `users`, `sessions`, `assessments`, `questions`, `attempts`, `attempt_answers`, `expeditions` y `expedition_answers`. La migración es aditiva: conserva usuarios, sesiones y resultados existentes. `assessments.level` y `questions.level` permiten añadir niveles sin rehacer los intentos. Las contraseñas se guardan con salt y scrypt; la cookie es HttpOnly y SameSite=Strict; solo el hash del token se guarda en SQLite. La cookie requiere `Secure` al desplegar detrás de HTTPS (véase límites de producción).

## Decisiones y límites conscientes

- Stack sin dependencias externas: ejecutable rápidamente en Node 24; SQLite almacena los intentos de forma real y permite inspeccionar los datos. Para una instalación distribuida migraría a PostgreSQL.
- El English Coach es **simulado/determinista**; no hay llamadas a Claude u otro modelo ni coste o clave de IA. La selección de la habilidad a reforzar se calcula a partir del menor porcentaje; el contenido de las recomendaciones es fijo y revisable.
- Las respuestas confirmadas se recuperan desde SQLite al recargar, reiniciar el servidor o volver a iniciar sesión. La selección aún no confirmada solo está en memoria y se pierde al recargar. No hay modo sin conexión: se conserva la selección durante un error de envío para poder reintentar.
- Existe una sola cuenta de demostración y un solo examen A2. No se ha implementado gestión de profesores o administradores, certificados ni niveles adicionales.
- La semilla inicial se inserta si la pregunta aún no existe; para editar una pregunta ya publicada se necesitaría versionado y migraciones. No cambiar preguntas en una versión histórica del examen.
- Para producción: HTTPS, cookies Secure detrás de proxy, configuración de secretos, recuperación de contraseña, auditoría, protección distribuida ante abuso, control de acceso por rol, accesibilidad probada con usuarios, copias de seguridad y CI/CD.

## Pruebas

`npm test` inicia servidores con SQLite temporal y prueba autenticación, origen, contrato 4/2/2/2, protección de soluciones, validación, orden, dos inicios concurrentes, envíos duplicados, conflictos, aislamiento entre usuarios, reinicio real del servidor, rollback ante un fallo al guardar el resultado, notas 0/90/100, historial y logout. Los datos de prueba se eliminan después de detener el servidor.

## Confirmación y recuperación

La clave única (expedición, pregunta) hace idempotente un reintento idéntico. Cambiar una respuesta ya confirmada o saltar preguntas se rechaza. La última respuesta y el resultado final se guardan en una misma transacción SQLite. Un índice parcial permite un solo intento abierto por usuario. Varias pestañas pueden recuperar el mismo progreso; una selección obsoleta debe recuperar el estado del servidor.

Ejemplo de confirmación: POST /api/expedition/1/answers con JSON {"questionId":"g1","value":"takes"}. Antes de confirmar, las respuestas correctas y explicaciones no están en el JSON público ni en los archivos estáticos. Después, se devuelve feedback solo de las preguntas ya confirmadas. El historial contiene únicamente resultados terminados (últimos 20).

La interfaz espera hasta 12 segundos por petición, comunica errores y permite repetir el envío o recuperar el progreso. Volver a confirmar la décima pregunta no crea otro resultado. Los tres paisajes son SVG originales, las fuentes son locales y el audio se sintetiza localmente y no hay servicios externos. Radios nativos, formularios, foco visible, feedback textual y prefers-reduced-motion acompañan la interacción.

Consulta `GUIA_ENTREVISTA.md` y el documento `Decisiones_Tecnicas_Global_AI.pdf` que acompaña al archivo comprimido.

## Verificación del flujo base

Se ejecutó la prueba original antes de modificar el proyecto (1/1). Después se ejecutó la nueva suite (7/7, incluyendo el test contenedor). En navegador se recorrieron login, los diez retos, resultados e historial; se comprobaron escritorio a 1366×900 y móvil a 390×844, selección por teclado, Enter en texto, respuesta vacía, recarga con feedback y caída real del servidor con reintento. La prueba visual usa una base SQLite separada de los datos de la demo.

Límites de validación: no se hizo una auditoría con lector de pantalla ni pruebas en dispositivos físicos. La reducción de movimiento está implementada en CSS; no se simuló la preferencia del sistema en el navegador.

## XP, insignias y celebraciones

La nota A2 no cambia. Los XP son un reconocimiento de práctica y aprendizaje, no una moneda ni una certificación.

| Acción verificada en el servidor | XP |
| --- | ---: |
| Confirmar una respuesta y recibir su explicación, incluso con error | 5 |
| Acierto, adicional al aprendizaje | 5 |
| Completar las diez preguntas | 30 |
| Superar estrictamente la mejor nota previa del mismo examen | 20 |

Sin intentos anteriores no hay bonus de mejora; empatar o bajar la mejor nota tampoco lo da. Una expedición nueva puede ganar XP de práctica y finalización otra vez. El máximo por recorrido es 150 XP con mejora, o 130 sin ella. Nunca se resta XP por un error. El aprendizaje se premia por confirmar y recibir feedback; no se pretende medir si el estudiante leyó la explicación.

Insignias originales, una sola vez por estudiante y sin XP extra:
- **Chispa Prisma:** primera respuesta confirmada. Símbolo de prisma de cuatro puntas.
- **Navegante de los Ecos:** primera expedición de diez retos terminada. Brújula circular.
- **Horizonte Ascendente:** primera superación de la mejor nota anterior. Horizonte y ruta ascendente.

El módulo server/rewards.js calcula todos los premios. reward_events tiene una clave única (expedición, evento); earned_badges tiene una clave única (usuario, insignia). Se escriben dentro de la misma transacción que la respuesta y el resultado. Un reintento idéntico, una recarga o dos envíos concurrentes no crean premios nuevos. El cliente no decide XP ni insignias. GET /api/rewards devuelve únicamente la colección y XP del usuario autenticado. Los premios de cada intento aparecen también en el historial.

La migración es aditiva y **no otorga premios retroactivos** a respuestas o intentos anteriores a esta función. Si se retoma un intento antiguo, solo sus nuevas confirmaciones generan XP; su finalización puede generar el bonus. Las notas históricas sí cuentan como referencia para mejora personal.

En un acierto, la respuesta se ilumina y una breve estela original viaja al siguiente checkpoint. En un error, hay un movimiento suave y una señal cálida con explicación. Continuar está disponible inmediatamente; no hay temporizadores que bloqueen. Diez mensajes distintos acompañan los diez aciertos. Las animaciones se omiten con prefers-reduced-motion; los mensajes y XP siguen visibles. Recuperar feedback al recargar no reproduce la celebración ni audio.

El control visible permite encender/apagar sonido y ajustar volumen. Por defecto está apagado; la preferencia se guarda en localStorage para el dispositivo. Incluso con una preferencia guardada, AudioContext solo se crea o reanuda tras una interacción. Web Audio sintetiza un acorde ascendente de acierto y dos notas suaves de reintento (menos de medio segundo). Silenciar o continuar detiene los efectos; un navegador sin Web Audio mantiene íntegro el feedback visual.


Las pruebas automatizadas cubren XP con acierto/error, primer intento, mejora, empate, regresión, mejoras sucesivas, insignias únicas, manipulación del payload, aislamiento entre cuentas, reintentos concurrentes, recarga/reinicio y rollback. Las verificaciones anteriores del diagnóstico siguen activas.

## Verificación de la capa de premios

La suite ampliada pasa 10/10 pruebas (incluye un test contenedor). Se prueban también los eventos y preferencias de Web Audio con un doble de prueba: silencio inicial, activación explícita, frecuencias diferentes, volumen cero, persistencia sin autoplay, duplicados, movimiento reducido y almacenamiento bloqueado. Se fuerzan fallos al guardar tanto el resultado como la insignia para verificar rollback de toda la transacción. Estos tests no validan la salida acústica física de los altavoces.

## Nilo, compañero ilustrado 2D

El personaje original se dibuja una sola vez en `public/explorer.svg`: ojos expresivos, chaqueta turquesa, mochila ocre y estrella. `mascot.css` anima sus grupos SVG, con pasos, brazos, cabeza y una pose de victoria; ante un error, la mirada baja y los hombros caen brevemente antes de recuperar una sonrisa alentadora.

`mascot.js` precarga el dibujo y lo muestra centrado en una capa fija, sin alterar el contenido ni capturar clics. Dura 2,7 segundos incluyendo entrada y salida suaves; Continuar lo retira inmediatamente. Con movimiento reducido muestra una pose estática durante 1,6 segundos. La explicación textual accesible sigue presente y el SVG superpuesto es decorativo.

La activación sale únicamente del feedback confirmado del servidor, mediante `effects.js`; usa el sonido existente una sola vez. Recargas y recuperación de respuestas no disparan la mascota. Si el SVG tarda en cargar y el estudiante continúa, la escena obsoleta se cancela. No se modifica la nota ni la lógica de XP e insignias.

Para revisar el dibujo sin completar preguntas **http://localhost:4173/mascot-preview.html**

Pruebas de Nilo: ambas reacciones usan el mismo SVG; la escena desaparece al continuar o al terminar su duración; un dibujo que llega tarde no aparece en otra pregunta; un fallo del asset no bloquea el flujo; movimiento reducido conserva una pose estática. Se mantiene la comprobación de una sola llamada de mascota y sonido por feedback.

Verificación final de Nilo: npm test pasa 12/12 (incluido el test contenedor). Se revisaron acierto, error y transición hacia el ánimo en navegador a 1366×900 y 390×844. Se comprobó el centrado, la retirada inmediata al pulsar Continuar, la ausencia de repetición al recargar y el recorrido hasta resultados, historial y colección. La reducción de movimiento y los fallos de carga del SVG están cubiertos con pruebas automatizadas; no se realizó una auditoría con lector de pantalla ni una comprobación acústica física.
