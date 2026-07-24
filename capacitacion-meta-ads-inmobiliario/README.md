# Capacitación Meta Ads · Sector Inmobiliario

Material para la capacitación de Meta Ads que imparte **Isabela** a un cliente
del sector inmobiliario. Diseño con la marca de **AdCenter** (azul, gris, negro, blanco).

## Archivos

| Documento | Uso | Descripción |
|-----------|-----|-------------|
| `Capacitacion-Meta-Ads-Inmobiliario.pdf` | **Cliente** (compartir pantalla) | 11 páginas: **contexto de Avora Real Estate**, panorama, flujo del lead, tipos de campaña, **campañas a WhatsApp + regla de los 5 minutos + CRM con IA**, creatividades, segmentación, pixel, landing, métricas y embudo. Termina con **2 checklists entregables** (Captación de propiedades y Venta de desarrollos). Personalizado para Avora (Culiacán; ticket $2.95M+ / premium $5M+; CRM Wiggot Pro). |
| `Guia-Interna-Isabela.pdf` | **Interno** (solo Isabela) | 4 páginas: logística previa, cómo presentarse con autoridad (guion), estructura de las 2 horas y recordatorio de grabar la sesión. **No compartir con el cliente.** |

Los archivos `.html` son la fuente editable (logo incrustado en base64, autocontenidos).

## Regenerar los PDF

Con Chromium headless:

```bash
chromium --headless --no-pdf-header-footer \
  --print-to-pdf="Capacitacion-Meta-Ads-Inmobiliario.pdf" \
  Capacitacion-Meta-Ads-Inmobiliario.html
```
