# SmartStock · Agente de reposición y servidor MCP

Componente que analiza necesidades de reposición y prepara propuestas de compra con los datos de SmartStock. Reúne el orquestador de IA, el servidor MCP y la API REST interna que usa el Gateway para iniciar un análisis.

**Stack** · Node.js, TypeScript, Express, SDK oficial de Model Context Protocol, API del modelo y PostgreSQL.

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

El repositorio reúne el flujo de análisis, los adaptadores REST y MCP, y el registro de ejecuciones en PostgreSQL. Para una ejecución integrada requiere el Gateway y las credenciales del proveedor del modelo configuradas en el entorno.
