# Sistema Backend de Turnos y Reservas — Routers, Controllers y Managers

API REST del **Sistema Backend de Turnos y Reservas** construida con **Node.js y Express**, con persistencia en archivos JSON.

En esta entrega se **reorganizó la API** en tres capas con responsabilidades separadas: **rutas → controllers → managers**. No se agregaron endpoints nuevos: las URLs y el comportamiento externo de la API son los mismos de la entrega anterior.

## Tecnologías

- Node.js 18 o superior
- Express 5
- FileSystem (`node:fs/promises`)
- dotenv
- Módulos ES (`"type": "module"`)

## Arquitectura en capas

```
Petición HTTP
     │
     ▼
┌──────────────┐   Solo define endpoints y los conecta con su controller.
│   Routers    │   No contiene lógica.
└──────┬───────┘
       ▼
┌──────────────┐   Lee req.params, req.query y req.body, llama al manager
│ Controllers  │   y responde con res.status().json().
└──────┬───────┘
       ▼
┌──────────────┐   Lógica de datos: validación, ids, lectura y escritura
│   Managers   │   de los archivos JSON. No usan req ni res.
└──────┬───────┘
       ▼
  services.json / bookings.json
```

| Capa        | Archivos | Responsabilidad |
|-------------|----------|-----------------|
| Routers     | `services.router.js`, `bookings.router.js` | Definir método + ruta y asignar la función del controller |
| Controllers | `services.controller.js`, `bookings.controller.js` | Recibir la request, invocar a los managers y devolver la response con el código HTTP |
| Managers    | `ServiceManager.js`, `BookingManager.js` | Manejar los datos en `services.json` y `bookings.json` |

### Funciones de cada controller

| Controller | Función | Manager que utiliza |
|------------|---------|---------------------|
| `services.controller.js` | `getServices` | `ServiceManager.getServices` |
| | `getServiceById` | `ServiceManager.getServiceById` |
| | `createService` | `ServiceManager.addService` |
| | `updateService` | `ServiceManager.updateService` |
| | `deleteService` | `ServiceManager.deleteService` |
| `bookings.controller.js` | `createBooking` | `BookingManager.createBooking` (y `ServiceManager.getServiceById` para validar los servicios enviados) |
| | `getBookingById` | `BookingManager.getBookingById` |
| | `addServiceToBooking` | `BookingManager.addServiceToBooking`, validando la existencia del servicio con `ServiceManager.getServiceById` |

## Estructura del proyecto

```
src/
  config/
    env.config.js             # Variables de entorno (puerto y rutas de los JSON)
  controllers/
    services.controller.js    # getServices, getServiceById, createService, updateService, deleteService
    bookings.controller.js    # createBooking, getBookingById, addServiceToBooking
  managers/
    ServiceManager.js         # Lógica de datos de services
    BookingManager.js         # Lógica de datos de bookings
  routes/
    services.router.js        # Endpoints de /api/services
    bookings.router.js        # Endpoints de /api/bookings
  data/
    services.json             # Persistencia de servicios
    bookings.json             # Persistencia de reservas
  utils/
    errors.js                 # ValidationError (400) y conversión de errores a respuesta
    jsonFile.js               # Lectura/escritura de JSON y cola de escrituras
  app.js                      # Configuración de Express y montaje de routers
  server.js                   # Arranque del servidor
package.json
.env.example
.gitignore
README.md
```

## Instalación y ejecución

1. Clonar el repositorio e ingresar a la carpeta:

   ```bash
   git clone https://github.com/sebakine/sistema-turnos-reservas-routers-controllers.git
   cd sistema-turnos-reservas-routers-controllers
   ```

2. Instalar las dependencias:

   ```bash
   npm install
   ```

3. Crear el archivo `.env` a partir del ejemplo (si no existe, el servidor usa el puerto `8080`):

   ```bash
   cp .env.example .env      # En Windows (PowerShell): Copy-Item .env.example .env
   ```

4. Levantar el servidor:

   ```bash
   npm start       # modo normal
   npm run dev     # modo desarrollo (se reinicia al guardar cambios)
   ```

El servidor queda disponible en `http://localhost:8080`.

### Variables de entorno

| Variable        | Descripción               | Valor por defecto        |
|-----------------|---------------------------|--------------------------|
| `PORT`          | Puerto del servidor       | `8080`                   |
| `SERVICES_FILE` | Archivo JSON de servicios | `src/data/services.json` |
| `BOOKINGS_FILE` | Archivo JSON de reservas  | `src/data/bookings.json` |

---

## Endpoints (sin cambios de comportamiento)

| Método | Ruta                               | Controller            | Respuestas |
|--------|------------------------------------|-----------------------|------------|
| GET    | `/api/services`                    | `getServices`         | 200 · 400 filtro inválido |
| GET    | `/api/services/:sid`               | `getServiceById`      | 200 · 404 |
| POST   | `/api/services`                    | `createService`       | 201 · 400 |
| PUT    | `/api/services/:sid`               | `updateService`       | 200 · 400 · 404 |
| DELETE | `/api/services/:sid`               | `deleteService`       | 200 · 404 |
| POST   | `/api/bookings`                    | `createBooking`       | 201 · 400 |
| GET    | `/api/bookings/:bid`               | `getBookingById`      | 200 · 404 |
| POST   | `/api/bookings/:bid/services/:sid` | `addServiceToBooking` | 200 · 404 · 400 si la reserva está cancelada |

`GET /api/services` acepta filtros opcionales por query params: `?category=salud` y `?available=true`.

### Modelo de `services`

| Campo         | Tipo    | Reglas |
|---------------|---------|--------|
| `id`          | string  | Generado automáticamente (UUID). No se envía en el body y no se puede modificar |
| `name`        | string  | Obligatorio, no vacío |
| `description` | string  | Obligatorio, no vacío |
| `duration`    | integer | Obligatorio, minutos, mayor a 0 |
| `price`       | number  | Obligatorio, mayor o igual a 0 |
| `category`    | string  | Obligatorio, no vacío (se guarda en minúsculas) |
| `available`   | boolean | Obligatorio, `true` o `false` |

### Modelo de `bookings`

| Campo         | Tipo   | Reglas |
|---------------|--------|--------|
| `id`          | string | Generado automáticamente (UUID) |
| `clientName`  | string | Obligatorio, no vacío |
| `clientEmail` | string | Obligatorio, email válido |
| `date`        | string | Obligatorio, formato `YYYY-MM-DD` y fecha existente |
| `time`        | string | Obligatorio, formato `HH:mm` (24 horas) |
| `status`      | string | Opcional: `pending` (por defecto), `confirmed` o `cancelled` |
| `services`    | array  | Opcional, puede iniciar vacío. Elementos `{ "service": idDelServicio, "quantity": 1 }` |

Si el mismo servicio se agrega de nuevo a una reserva, no se duplica: se incrementa su `quantity`.

---

## Ejemplos de uso

```bash
# Servicios
curl http://localhost:8080/api/services
curl "http://localhost:8080/api/services?category=salud&available=true"
curl http://localhost:8080/api/services/b3f1c2a4-5d6e-4f70-8a91-0b1c2d3e4f50

curl -X POST http://localhost:8080/api/services \
  -H "Content-Type: application/json" \
  -d '{"name":"Control dental","description":"Revisión y limpieza dental","duration":40,"price":30000,"category":"salud","available":true}'

curl -X PUT http://localhost:8080/api/services/b3f1c2a4-5d6e-4f70-8a91-0b1c2d3e4f50 \
  -H "Content-Type: application/json" \
  -d '{"price":27000,"available":false}'

curl -X DELETE http://localhost:8080/api/services/b3f1c2a4-5d6e-4f70-8a91-0b1c2d3e4f50

# Reservas
curl -X POST http://localhost:8080/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"clientName":"Juan Pérez","clientEmail":"juan.perez@example.com","date":"2026-10-20","time":"16:00","services":[]}'

curl http://localhost:8080/api/bookings/f7d5a6e8-9102-43b4-8e35-4f5061728394

curl -X POST http://localhost:8080/api/bookings/f7d5a6e8-9102-43b4-8e35-4f5061728394/services/d5b3e4c6-7f80-4192-8c13-2d3e4f506172
```

Respuesta al agregar dos veces el mismo servicio:

```json
"services": [
  { "service": "b3f1c2a4-5d6e-4f70-8a91-0b1c2d3e4f50", "quantity": 1 },
  { "service": "d5b3e4c6-7f80-4192-8c13-2d3e4f506172", "quantity": 2 }
]
```

## Formato de respuestas y códigos HTTP

```json
{ "status": "success", "payload": { } }
{ "status": "error", "error": "Descripción del error", "details": ["..."] }
```

| Código | Uso |
|--------|-----|
| 200 | Consulta, actualización, eliminación o servicio agregado a una reserva |
| 201 | Servicio o reserva creados |
| 400 | Campos faltantes, datos inválidos o JSON mal formado |
| 404 | Servicio, reserva o ruta inexistente |
| 500 | Error inesperado del servidor |

## Decisiones de diseño

- **Routers sin lógica:** cada archivo de rutas solo contiene líneas del tipo `router.get("/:sid", getServiceById)`.
- **Controllers como intermediarios:** son los únicos que usan `req` y `res`; traducen los errores de los managers al código HTTP correspondiente.
- **Managers independientes de Express:** reciben datos simples, validan, generan ids con `crypto.randomUUID()` y leen/escriben los JSON. Ante datos inválidos lanzan un `ValidationError` y, si un recurso no existe, devuelven `null`; nunca construyen la respuesta HTTP.
- **Validación cruzada en el controller:** `addServiceToBooking` y `createBooking` comprueban la existencia de los servicios mediante `ServiceManager`, sin que un manager dependa del otro.
- **Escrituras en serie:** las operaciones sobre un mismo archivo se encolan para evitar que peticiones simultáneas se sobrescriban.

## Autor

Sebastián Muñoz
