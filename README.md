# SmartStock · Agente de reposición y servidor MCP

Componente que analiza necesidades de reposición y prepara propuestas de compra con los datos de SmartStock. Reúne el orquestador de IA, el servidor MCP y la API REST interna que usa el Gateway para iniciar un análisis.

**Stack propuesto** · Node.js, TypeScript, Express, SDK oficial de Model Context Protocol, API del modelo y PostgreSQL.

## Responsabilidades

- Obtener el contexto de reposición de un SKU a partir de existencias, ventas recientes y cotizaciones disponibles.
- Comparar alternativas según costo, plazo de entrega y cantidad mínima, y explicar la recomendación con los datos consultados.
- Solicitar a Compras un borrador con el proveedor y la cantidad propuestos, a través del Gateway.
- Registrar las ejecuciones y sus resultados para que el operador pueda revisar la propuesta. La aprobación se realiza en el frontend y queda registrada en Compras.

## Interfaces

| Interfaz | Uso |
|---|---|
| REST interno | El Gateway solicita el inicio de un análisis. Las herramientas acceden a SmartStock a través del Gateway. |
| MCP sobre Streamable HTTP | El cliente MCP del orquestador invoca las herramientas del servidor. |
| API del modelo | El orquestador utiliza el modelo para decidir qué información consultar y formular la propuesta. |

## Herramientas de dominio

| Herramienta | Propósito |
|---|---|
| `get_stock` | Consultar las existencias de un SKU. |
| `get_sales_history` | Consultar su historial de ventas. |
| `list_supplier_offers` | Obtener las cotizaciones disponibles. |
| `request_purchase_draft` | Solicitar un borrador de reposición. |

Se prevé reunir el flujo de análisis, los adaptadores REST y MCP, y el registro de ejecuciones en PostgreSQL. Una ejecución integrada requerirá el Gateway y las credenciales del proveedor del modelo configuradas en el entorno.

## Prototipo local

El flujo integrado aún no está implementado. El contrato compartido
`smartstock-infra` en el commit `6237ae7a047c3a16077db5bdd51a6ee89f5f90f1`
solo cubre aquí la consulta GraphQL `product(sku)`. Se incluye un adaptador
aislado para esa consulta; recibe un ejecutor inyectado y no presupone URL,
credenciales, transporte interno ni que GraphQL sea la interfaz acordada para
las herramientas MCP. Los errores o respuestas parciales no se interpretan
como productos inexistentes.

El prototipo incluye un servidor y un cliente del SDK MCP oficial sobre
Streamable HTTP, herramientas de consulta, un orquestador con herramientas del
modelo OpenAI, y una API REST **provisional** para ensayos. El puerto de
Gateway se inyecta; la aplicación arrancada con `npm start` usa un adaptador
que devuelve error para todas las consultas porque no hay contrato acordado.
`request_purchase_draft` siempre devuelve `DRAFT_REQUEST_DISABLED`: tampoco
en pruebas crea un borrador ni implementa idempotencia de Compras.

Para compilar y ejecutar las pruebas con Node.js 22:

```sh
npm ci
npm test
```

Las pruebas usan dobles de Gateway y modelo, pero las llamadas MCP pasan por
HTTP y el SDK real. No requieren variables de entorno ni servicios externos.
El modelo devuelve texto no verificado: las evidencias se conservan para
revisión humana, no constituyen una garantía de que el texto sea correcto.
Solo se completa el análisis si se consultaron las cuatro fuentes y hay al
menos dos proveedores con ofertas de la forma provisional usada en las
pruebas: `supplierId`, `price`, `currency`, `leadTimeDays` y
`minimumQuantity`. Estos nombres no son un contrato de Gateway.

Para arrancar el prototipo se requieren estas variables de entorno:

| Variable | Uso |
|---|---|
| `INTERNAL_TOKEN` | Token local de al menos 32 caracteres para REST y MCP. |
| `OPENAI_API_KEY` | Credencial del proveedor; no incluirla en archivos versionados. |
| `OPENAI_MODEL` | Identificador del modelo con soporte de herramientas. |
| `PORT` | Puerto HTTP; predeterminado `3000`. |
| `HOST` | Dirección de escucha; predeterminada `127.0.0.1`. |

```sh
npm run build
npm start
```

Con `Authorization: Bearer <INTERNAL_TOKEN>`, `POST /analyses` acepta
`{"sku":"SKU-1"}` y devuelve `202` con un identificador; `GET /analyses/:id`
devuelve estado, evidencia, recomendación o error. La API, el token compartido
y las rutas son provisionales, no un acuerdo con Gateway. Las ejecuciones solo
viven en memoria, se pierden al reiniciar y están limitadas a 100 por proceso.
No hay persistencia, reconciliación, recuperación tras reinicio ni garantía de
disponibilidad. No exponer el prototipo a redes no confiables: HTTP no cifra el
token y la seguridad definitiva todavía no está acordada.

El Dockerfile compila el prototipo. Para acceder desde fuera del contenedor se
debe configurar `HOST=0.0.0.0`, limitar la publicación a una interfaz segura y
proporcionar las variables anteriores mediante el entorno, nunca mediante
argumentos de construcción. Su Gateway sigue deshabilitado.

No se ha probado la consulta GraphQL contra un Gateway real ni una ejecución
con un proveedor real. El modelo no puede completar un análisis real hasta que
se implemente un adaptador conforme al contrato acordado.

Antes de implementar el flujo integrado hay que acordar y versionar con Gateway:

- Inicio y consulta de análisis, estados, persistencia, errores y comportamiento
  asíncrono, incluidos los resultados desconocidos.
- Autenticación y autorización internas, timeouts y propagación de correlación.
- Consultas de stock, historial de ventas, necesidad y ofertas para MCP,
  incluyendo campos, unidades, errores y datos parciales.
- Solicitud de borrador por Gateway hacia Compras mediante Kafka: identificador
  idempotente, validación, deduplicación, resultado incierto y observación del
  estado. La aprobación sigue siendo exclusivamente humana.

La distribución reproducible del contrato requiere añadir
`vendor/smartstock-infra` como submódulo fijado al commit acordado cuando ese
commit esté disponible desde una URL accesible para los consumidores y CI.
