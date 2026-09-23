# Integración OpenReply ↔ CRM (Twenty)

Este documento especifica las dos direcciones de integración entre OpenReply
y un CRM externo (Twenty), para que un agente/desarrollador pueda
implementarlas sin necesitar contexto adicional.

Dominio de producción: `https://social.chatmu.io`

---

## Resumen

| Dirección | Mecanismo | Quién llama a quién |
|---|---|---|
| OpenReply → CRM | Webhook saliente (configurado en OpenReply) | OpenReply hace `POST` al CRM |
| CRM → Instagram | API pública de OpenReply (`/api/v1/messages`) | El CRM hace `POST` a OpenReply, OpenReply reenvía a Instagram |

No hay una tercera dirección "Instagram → CRM directo" — todo pasa por
OpenReply, que es quien tiene la cuenta de Instagram conectada y el token de
acceso de Meta.

---

## 1. OpenReply → CRM (webhook saliente)

### Configuración

En OpenReply: **Settings → Webhooks salientes → + Agregar webhook**, pegar la
URL del endpoint del CRM que va a recibir los eventos. Al crearlo, OpenReply
genera un **secret** único para ese webhook — visible dando clic en el botón
"Secret" junto al webhook. Ese secret es necesario para verificar la firma
(ver abajo).

Se pueden crear varios webhooks (por ejemplo, uno de staging y otro de
producción). Cada uno tiene su propio secret, se puede activar/pausar
(toggle) o eliminar independientemente.

### Cuándo se dispara

| Evento | Cuándo |
|---|---|
| `contact.created` | La primera vez que alguien le escribe (comenta o manda DM) a la cuenta de Instagram conectada. |
| `contact.updated` | Cada vez que ese mismo contacto vuelve a escribir, se le asigna/quita una etiqueta, o se refresca su perfil de Instagram (nombre, seguidores, verificado — se re-sincroniza cada 24h). |

No hay filtro de eventos por webhook: cada webhook configurado recibe ambos
tipos de evento.

### Request

```
POST <tu-url-configurada>
Content-Type: application/json
X-OpenReply-Event: contact.created | contact.updated
X-OpenReply-Signature: sha256=<hex>
```

### Body

```json
{
  "event": "contact.created",
  "workspaceId": "ws_...",
  "contact": {
    "id": "clx...",
    "igsId": "17841400000000000",
    "username": "ejemplo_usuario",
    "name": "Usuario de Ejemplo",
    "profilePicUrl": "https://...",
    "followerCount": 1234,
    "isVerifiedUser": false,
    "isFollowingBusiness": true,
    "isBusinessFollowingUser": false,
    "tags": ["Artist"],
    "createdAt": "2026-09-15T13:59:00.000Z",
    "lastInteractionAt": "2026-09-15T13:59:00.000Z"
  },
  "sentAt": "2026-09-15T13:59:01.000Z"
}
```

Notas sobre los campos:

- **`igsId`** es el identificador único y estable del usuario de Instagram
  (Instagram-Scoped ID). Es el campo que hay que guardar en el CRM para
  poder mandarle mensajes después vía la API de envío (sección 2).
- **`profilePicUrl`** puede venir `null`, y cuando existe **expira en unos
  días** (limitación de Meta, no de OpenReply) — no sirve como URL
  permanente. Si el CRM quiere conservar la imagen, debe descargarla y
  re-alojarla, no solo guardar el link.
- **`tags`** es un array de strings con las etiquetas actuales del contacto
  en OpenReply (asignadas manualmente o por una automatización de Quick
  Replies). En `contact.created` normalmente viene vacío.
- **`followerCount`**, **`isVerifiedUser`**, **`isFollowingBusiness`**
  (te sigue), **`isBusinessFollowingUser`** (lo sigues) pueden venir `null`
  si todavía no se ha sincronizado el perfil con Meta.

### Verificar la firma (obligatorio)

`X-OpenReply-Signature` es el HMAC-SHA256 del **cuerpo exacto del request**
(el JSON tal cual llega, sin reformatear), calculado con el `secret` del
webhook. El header tiene el formato `sha256=<hex>`.

Pseudocódigo (Node.js):

```js
const crypto = require("crypto");

function isValidSignature(rawBody, signatureHeader, secret) {
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(rawBody) // el body crudo, ANTES de hacer JSON.parse
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expected)
  );
}
```

Importante: la firma se calcula sobre el **body crudo** (string), no sobre el
objeto ya parseado — si el framework del CRM reserializa el JSON antes de
verificar, la comparación va a fallar aunque el request sea legítimo.

### Reintentos

**No hay reintentos automáticos.** Si el endpoint del CRM no responde o
devuelve un status distinto de 2xx, OpenReply registra el error
(`lastError`, visible en Settings) pero no reintenta la entrega. El CRM debe:

- Responder rápido (idealmente `200` inmediato) y procesar el evento de forma
  asíncrona si hace falta.
- Asumir que puede perder algún evento puntual (endpoint caído en el momento
  exacto de la entrega) y no depender 100% del webhook para el estado —
  puede usar la API de solo-lectura de contactos de OpenReply para
  reconciliar si hace falta (fuera de alcance de este documento).

Hay un botón "Probar" en Settings que manda un payload de ejemplo a un
webhook específico, útil para validar la implementación del lado del CRM
antes de ir a producción.

---

## 2. CRM → Instagram (vía OpenReply)

### Autenticación

En OpenReply: **Settings → API para integraciones → Generar API Key**.
Genera una key con formato `or_<hex>`. Regenerarla invalida la anterior de
inmediato — cualquier integración usando la key vieja deja de funcionar en
ese momento.

La key se manda como Bearer token:

```
Authorization: Bearer or_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

(También se acepta el header `X-API-Key: or_...` como alternativa.)

### Endpoint

```
POST https://social.chatmu.io/api/v1/messages
Content-Type: application/json
Authorization: Bearer <API_KEY>
```

```json
{
  "igsId": "17841400000000000",
  "text": "Hola desde el CRM"
}
```

| Campo | Requerido | Descripción |
|---|---|---|
| `igsId` | Sí | El Instagram-Scoped ID del contacto (viene en el payload del webhook, sección 1). |
| `text` | Sí | Texto del mensaje, máximo 1000 caracteres. |
| `instagramAccountId` | No | Solo necesario si el workspace tiene **más de una** cuenta de Instagram conectada y se quiere elegir una en particular. Si se omite, usa la cuenta conectada más recientemente. |

### Respuesta exitosa

```json
{
  "success": true,
  "data": {
    "messageId": "mid.xxxxx",
    "recipientId": "17841400000000000"
  }
}
```

### Respuestas de error

| Status | Cuándo | Body |
|---|---|---|
| `401` | API key inválida o ausente | `{"success": false, "error": "Invalid or missing API key"}` |
| `400` | Falta `igsId`/`text`, texto muy largo, o `instagramAccountId` no pertenece al workspace | `{"success": false, "error": "..."}` |
| `422` | **Fuera de la ventana de 24h de Meta** — ver abajo | `{"success": false, "error": "...", "reason": "outside_messaging_window"}` |
| `429` | Se alcanzó el límite de envío de DMs del workspace | `{"success": false, "error": "Workspace DM sending limit reached"}` |
| `502` | Meta rechazó el envío por otra razón (token vencido, cuenta bloqueada, etc.) | `{"success": false, "error": "...", "reason": "meta_api_error"}` |

### ⚠️ Restricción crítica: ventana de mensajería de 24 horas

Esto **no es una limitación de OpenReply** — es una política de la
plataforma de mensajería de Instagram/Meta: solo se puede mandar texto libre
a un usuario si **ese usuario le escribió a la cuenta de negocio en las
últimas 24 horas**. Pasada esa ventana, cualquier intento de envío (sin
importar qué herramienta se use) es rechazado por Meta.

El endpoint de OpenReply detecta este caso específico y responde `422` con
`reason: "outside_messaging_window"` para que el CRM pueda distinguirlo de
un error real y, por ejemplo, mostrarle al usuario del CRM un mensaje del
tipo "este contacto no ha escrito recientemente, no se le puede mandar un
mensaje directo ahora" en vez de tratarlo como una falla del sistema.

No existe ningún workaround de este límite vía API — Meta exige que el
usuario final inicie o reactive la conversación escribiendo primero.

### Ejemplo completo (curl)

```bash
curl -X POST https://social.chatmu.io/api/v1/messages \
  -H "Authorization: Bearer or_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"igsId": "17841400000000000", "text": "Hola desde el CRM"}'
```

---

## Flujo típico end-to-end

1. Alguien comenta o manda DM en Instagram → OpenReply crea el `Contact` →
   dispara webhook `contact.created` al CRM → el CRM crea/actualiza el
   registro correspondiente, guardando `igsId`.
2. El contacto interactúa de nuevo, o se le cambia una etiqueta en OpenReply
   → webhook `contact.updated` → el CRM sincroniza el cambio.
3. Un agente humano (o una automatización) en el CRM decide contestarle →
   el CRM llama a `POST /api/v1/messages` con el `igsId` guardado en el paso 1
   → si el contacto escribió en las últimas 24h, el mensaje sale por
   Instagram; si no, el CRM recibe el `422` y puede avisarle al agente.

---

## Resumen de credenciales necesarias

| Credencial | Dónde se genera | Para qué |
|---|---|---|
| Webhook secret | Automático al crear un webhook en Settings | Verificar la firma de los eventos entrantes al CRM |
| API Key (`or_...`) | Botón "Generar API Key" en Settings | Autenticar los envíos del CRM hacia `/api/v1/messages` |

Ambas credenciales viven en la base de datos de OpenReply (self-hosted) y
nunca se exponen en el código fuente del repositorio.
