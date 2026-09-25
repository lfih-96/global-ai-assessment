# Guía para entender y presentar Global AI Assessment

## Explicación de 60 segundos

> Construí un prototipo de evaluación A2 que transforma diez preguntas en una expedición corta. El estudiante inicia sesión, responde preguntas de gramática, comprensión lectora y vocabulario, y recibe resultados por habilidad, explicaciones y un siguiente paso sugerido. Elegí Node 24 con SQLite para que la prueba se ejecute localmente sin instalaciones adicionales. La interfaz pide las preguntas a una API; las soluciones y la calificación permanecen en el servidor. Cada intento y cada respuesta quedan almacenados. El English Coach actual usa reglas explícitas y preparé la arquitectura para cambiarlo después por un proveedor de IA. Para producción priorizaría identidad, seguridad, versiones de examen y PostgreSQL.

Personaliza **“construí”** tras revisar, probar y modificar el código. En esta versión Codex ayudó a generar el primer prototipo. Sé transparente al indicarlo.

## Mapa mental del sistema

```text
Navegador → API Node → SQLite
   ↑           ↓
 resultados ← cálculo de nota con respuestas privadas
```

- `public/app.js`: estado de pantalla, formularios, selección temporal y recuperación desde la API y render de resultados. Nunca decide si una respuesta es correcta.
- `server/index.js`: rutas HTTP, cookies de sesión, validación, cálculo de puntajes, feedback y registro transaccional.
- `server/db.js`: crea tablas, un usuario de demostración y el examen inicial.
- `server/questions.js`: banco inicial de 10 preguntas; el backend guarda la clave, pero **no la incluye en la respuesta de `/api/assessment`**.

Ejemplo: si envías 7 respuestas correctas de 10, el servidor registra 70%. Si acertaste 5 de 6 en Grammar, 1 de 2 en Reading y 1 de 2 en Vocabulary, devuelve respectivamente 83%, 50% y 50%. El feedback escoge una de las habilidades con menor puntuación y muestra una sugerencia predefinida. Es una interpretación educativa, no una clasificación clínica ni certificación MCER.

## Demostración sugerida en 3 minutos

1. Abrir `http://localhost:4173`, entrar con el usuario demo y mostrar el dashboard.
2. Abrir el examen; mostrar Estación Prisma, Ruta de los Ecos y Puerto de las Palabras. Cada reto se confirma en orden y se guarda en SQLite.
3. Confirmar una respuesta correcta y una incorrecta, leer el feedback y recargar para demostrar recuperación. Completar los diez retos y mostrar nota y desglose por habilidad.
4. Mostrar explicaciones y el historial de intentos; repetir el examen para enseñar la evolución.
5. En DevTools, abrir Network → `/api/assessment`: se ven enunciados y opciones, pero no las respuestas correctas. Explicar que el servidor ignora `score` enviado desde el navegador.
6. Mostrar `npm test` y el PDF de decisiones técnicas.

## Las 10 preguntas de la entrevista

**1. ¿Qué cambiarías al pasar de 100 a 100.000 estudiantes?**

Mantendría el contrato de la API, migraría SQLite a PostgreSQL administrado con índices en `attempts(user_id, created_at)`; desplegaría varias instancias sin estado compartido, almacenaría sesiones en un sistema compartido o usaría tokens de sesión verificables y revocables, añadiría caché de contenido público, colas para tareas asíncronas y observabilidad. La carga real guiaría los cambios: medir consultas, concurrencia, latencia y coste antes de escalar.

**2. ¿Cómo impedirías que vean respuestas correctas en el navegador?**

La ruta de consulta selecciona solo `id`, `type`, `skill`, `prompt`, opciones y contexto. Las claves están en la base de datos y se consultan únicamente durante `POST /api/expedition/:id/answers`. Después de confirmar se revela únicamente la solución de esa pregunta para enseñar; en un examen de alta integridad limitaría este desglose hasta cerrar la convocatoria y usaría un banco rotativo de preguntas.

**3. ¿Dónde guardarías progreso e intentos?**

En `expeditions` guardo el intento abierto y en `expedition_answers` cada confirmación y su explicación. Al terminar, en `attempts` guardo fecha, usuario, evaluación, porcentaje y desglose; en `attempt_answers`, cada respuesta y si acertó. El progreso se calcula consultando intentos del usuario en orden descendente; una tabla de resumen o vistas materializadas puede añadirse para analítica intensiva.

**4. ¿Cómo incluirías Pre-Beginner, A1, A2, B1, B2 y C1?**

Las evaluaciones y preguntas tienen campo `level`, relacionados por `assessment_id`. Agregaría filas para cada nivel y versiones de evaluación sin cambiar la tabla de intentos. El siguiente paso sería una tabla `assessment_versions` para preservar exactamente qué preguntas respondió cada estudiante, además de un catálogo controlado de niveles MCER.

**5. ¿Qué pasaría al reemplazar Claude?**

Hoy no hay LLM: `feedbackFor()` genera texto por reglas. Para integrar IA definiría `FeedbackProvider.generate(context)`; implementaciones `RulesProvider`, `ClaudeProvider` u otra. El servicio de evaluación pediría feedback por esa interfaz; cambiar de proveedor solo afectaría su adaptador y configuración, manteniendo el cálculo de notas separado del LLM.

**6. ¿Cómo separarías estudiante, profesor y administrador?**

`users.role` ya permite registrar un rol, pero las rutas de gestión aún no están hechas. Añadiría middleware de autorización por permiso y ámbito: estudiante solo ve sus intentos, profesor solo sus grupos, administrador gestiona catálogo y usuarios. Toda comprobación va en el backend y queda auditada.

**7. ¿Qué pasa si se pierde la conexión?**

Las respuestas confirmadas viven en SQLite. Al recargar o reiniciar el servidor se recuperan mediante GET /api/expedition. Si se pierde la respuesta de red, repetir la misma confirmación devuelve el progreso sin duplicar puntos ni intentos. Cambiar una respuesta confirmada se rechaza. La selección aún no confirmada vive solo en memoria; no hay modo sin conexión.

**8. ¿Cómo evitas que modifiquen la puntuación?**

El backend no lee `score` del cuerpo de la solicitud. Calcula aciertos contra las claves guardadas en SQLite, dentro de una transacción que guarda intento y respuestas. La prueba integrada envía `score:100` con respuestas incorrectas y comprueba que el resultado real sea 0%.

**9. ¿Qué pruebas priorizarías?**

Primero seguridad de acceso, que el examen público no filtre claves, cálculo correcto por habilidad y propiedad de intentos. Después recuperación de conexión, accesibilidad de teclado, responsive y pruebas de carga para los puntos críticos. Las pruebas actuales incluyen aislamiento entre dos usuarios, orden, duplicados, recuperación tras reiniciar, notas 0/90/100 y rollback si falla la escritura del resultado. La interfaz se recorrió en navegador móvil y escritorio; falta una auditoría con lector de pantalla y dispositivos físicos.

**10. ¿Qué harías durante tres meses?**

Mes 1: entrevistas con estudiantes/profesores, diseño curricular, autenticación real, versiones de examen, accesibilidad y CI. Mes 2: PostgreSQL, roles, editor de preguntas, versionado de contenido y sincronización entre instancias. Mes 3: observabilidad, pruebas de carga y seguridad, piloto, métricas de aprendizaje e integración de IA con consentimiento y control de costes. Dejaría certificados y speaking automático para una fase posterior si el piloto confirma valor.

## Preguntas que te pueden hacer sobre IA

- **¿Usaste IA en la prueba?** Sí. Codex ayudó a generar el primer prototipo, revisar arquitectura, redactar documentación y automatizar pruebas. Explica qué cambiaste y probaste personalmente antes de presentarlo.
- **¿El English Coach usa realmente IA?** No. Está simulado con reglas, tal como permite el enunciado. Calcula la habilidad más débil y elige una sugerencia ya escrita. No afirmes que es una llamada a Claude.
- **¿Cómo evitarías feedback inventado?** Enviaría al LLM solo resultados verificados y objetivos curriculares permitidos, pediría salida estructurada, validaría la respuesta y ofrecería fallback por reglas; nunca permitiría que el modelo altere la puntuación.

## Cambios pequeños para practicar antes de la entrevista

1. Cambia el texto de bienvenida en `public/app.js` y un color en `public/styles.css`.
2. Añade una pregunta a `server/questions.js` **en una base nueva**, actualiza el requisito de 10 preguntas si mantienes el cambio y prueba su resultado. Para la entrega, conserva exactamente 10.
3. Explica con tus palabras por qué `correct_answer` no aparece en `assessmentForClient()` y por qué `submit()` calcula `score` de nuevo.
4. Ejecuta `npm test`, revisa el resultado y ensaya la demo de tres minutos sin leer esta guía.

## Límites que conviene reconocer sin rodeos

La demo tiene una sola cuenta, una evaluación A2 y un coach de reglas. La selección sin confirmar solo existe en memoria; las confirmaciones sí persisten en SQLite. El límite de login está en memoria de una instancia y SQLite no es la base elegida para 100.000 usuarios. El prototipo demuestra el recorrido principal y deja claro qué reforzar antes de producción.
