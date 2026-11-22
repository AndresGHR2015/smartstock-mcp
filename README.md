# SmartStock · Agente de reposición y servidor MCP

Componente de IA que consulta datos de SmartStock, evalúa opciones de reposición y solicita un borrador de compra para revisión humana.

**Stack** · Node.js, TypeScript, Express, SDK de Model Context Protocol, API del modelo de IA y PostgreSQL.

## Alcance del MVP

Al iniciar un análisis para un SKU con stock bajo, el agente consulta las existencias y las ventas recientes. Luego usa dos cotizaciones precargadas para comparar costo, plazo de entrega y pedido mínimo. Solicita un borrador con la cantidad y el proveedor propuestos y registra la justificación. El operador aprueba desde el frontend. PostgreSQL registra las ejecuciones del análisis y sus resultados.

## Integraciones

- El Gateway inicia el análisis mediante una API REST interna.
- El agente invoca las herramientas del servidor mediante el protocolo MCP sobre Streamable HTTP.
- Las herramientas consultan y solicitan operaciones del sistema a través del Gateway. Compras valida y guarda el borrador.

## Herramientas previstas

| Herramienta | Acción |
|---|---|
| `get_stock` | Obtener el saldo del SKU. |
| `get_sales_history` | Consultar ventas recientes. |
| `list_supplier_offers` | Obtener cotizaciones para el SKU. |
| `request_purchase_draft` | Solicitar la creación del borrador. |

## Primera verificación

Ejecutar un análisis con una cotización barata que llega tarde y otra que llega a tiempo. Comprobar que el agente consulta las cotizaciones, justifica su decisión con esos datos y deja un borrador revisable.
