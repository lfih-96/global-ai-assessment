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
4. Navega entre los checkpoints; las respuestas se guardan como borrador en el almacenamiento local del navegador.
5. Envía las respuestas. El servidor calcula la nota y guarda el intento junto a sus respuestas.
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

Una sola aplicación sirve archivos estáticos y API en el mismo origen; esto evita configuración de CORS en la demo. El navegador solicita `GET /api/assessment`, que excluye `correct_answer` y `explanation`. El servidor compara respuestas y guarda los resultados mediante una transacción. `POST /api/attempts` ignora cualquier `score` que envíe el cliente.

| Método | Ruta | Propósito |
| --- | --- | --- |
| POST | `/api/login` | Credenciales y cookie de sesión |
| GET | `/api/me` | Sesión actual |
| POST | `/api/logout` | Revocar sesión |
| GET | `/api/assessment` | Evaluación sin respuestas correctas |
| POST | `/api/attempts` | Calificar y registrar intento |
| GET | `/api/attempts` | Historial propio |

Entidades: `users`, `sessions`, `assessments`, `questions`, `attempts`, `attempt_answers`. `assessments.level` y `questions.level` permiten añadir niveles sin rehacer los intentos. Las contraseñas se guardan con salt y scrypt; la cookie es HttpOnly y SameSite=Strict; solo el hash del token se guarda en SQLite. La cookie requiere `Secure` al desplegar detrás de HTTPS (véase límites de producción).

## Decisiones y límites conscientes

- Stack sin dependencias externas: ejecutable rápidamente en Node 24; SQLite almacena los intentos de forma real y permite inspeccionar los datos. Para una instalación distribuida migraría a PostgreSQL.
- El English Coach es **simulado/determinista**; no hay llamadas a Claude u otro modelo ni coste o clave de IA. La selección de la habilidad a reforzar se calcula a partir del menor porcentaje; el contenido de las recomendaciones es fijo y revisable.
- El borrador en `localStorage` sobrevive a un refresh en el mismo navegador, pero no sincroniza entre dispositivos. Si se pierde conexión durante el envío, hay que reintentar; podría haberse guardado el intento aunque se perdiera la respuesta. En producción usaría un identificador idempotente por intento.
- Existe una sola cuenta de demostración y un solo examen A2. No se ha implementado gestión de profesores o administradores, certificados, audio ni niveles adicionales.
- La semilla inicial se inserta si la pregunta aún no existe; para editar una pregunta ya publicada se necesitaría versionado y migraciones. No cambiar preguntas en una versión histórica del examen.
- Para producción: HTTPS, cookies Secure detrás de proxy, configuración de secretos, recuperación de contraseña, auditoría, protección distribuida ante abuso, control de acceso por rol, accesibilidad probada con usuarios, copias de seguridad y CI/CD.

## Pruebas

`npm test` levanta un servidor aislado con SQLite temporal y verifica: acceso denegado sin login, rechazo de contraseña incorrecta, tipos y cantidad de preguntas, ausencia de claves de respuesta en la API, validación de envíos incompletos, 100% con respuestas correctas, 0% aunque el cliente envíe `score:100`, historial y revocación de sesión.

## Publicación en GitHub

El archivo comprimido contiene el código, la documentación y un repositorio Git local con un commit inicial. Para publicarlo desde tu equipo, descomprime y ejecuta:

```powershell
cd global-ai-assessment
git log -1 --oneline
git remote add origin https://github.com/TU_USUARIO/global-ai-assessment.git
git push -u origin main
```

Crea primero un repositorio vacío en GitHub. La carpeta `data/` y `.env` están excluidos por `.gitignore`. Reemplaza `TU_USUARIO`. Si al descomprimir no aparece `.git`, usa `git init -b main`, `git add .` y `git commit -m "feat: implementa evaluación de inglés Global AI"` antes de añadir el remoto. No publiques credenciales reales: las de este README son exclusivamente para la demo.

## Uso de IA en la prueba

**Declaración transparente:** se utilizó Codex como asistente para proponer el diseño, generar el primer prototipo, redactar documentación y ejecutar la prueba automática. El candidato debe revisar el código, ejecutarlo, modificar al menos una parte por sí mismo y poder explicar cada decisión antes de enviarlo. No se usó un LLM en tiempo de ejecución; el English Coach usa reglas. La autoría y el trabajo personal durante la revisión deben describirse según lo que realmente haga el candidato.

Consulta `GUIA_ENTREVISTA.md` y el documento `Decisiones_Tecnicas_Global_AI.pdf` que acompaña al archivo comprimido.
