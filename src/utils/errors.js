/**
 * Errores de dominio que lanzan los managers.
 * No dependen de Express: cada error solo indica qué código HTTP le corresponde
 * y son los controllers quienes construyen la respuesta.
 */

/** Datos inválidos o incompletos -> HTTP 400 */
export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
    this.details = details;
  }
}

/**
 * Convierte un error en { statusCode, body } para que el controller responda.
 * Los errores inesperados se informan como 500 sin exponer detalles internos.
 */
export const toErrorResponse = (error) => {
  if (error?.statusCode) {
    const body = { status: "error", error: error.message };
    if (error.details?.length) body.details = error.details;
    return { statusCode: error.statusCode, body };
  }
  console.error(error);
  return { statusCode: 500, body: { status: "error", error: "Error interno del servidor" } };
};
