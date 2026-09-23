import crypto from "node:crypto";
import { readJsonArray, writeJsonArray, enqueue } from "../utils/jsonFile.js";
import { ValidationError } from "../utils/errors.js";

/** Estados posibles de una reserva. */
export const BOOKING_STATUSES = ["pending", "confirmed", "cancelled"];

const REQUIRED_FIELDS = ["clientName", "clientEmail", "date", "time"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const isMissing = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** Comprueba que la fecha tenga formato YYYY-MM-DD y exista en el calendario. */
const isValidDate = (value) => {
  if (typeof value !== "string" || !DATE_REGEX.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/**
 * BookingManager: lógica de datos del recurso "bookings" persistido en bookings.json.
 * Métodos: createBooking, getBookingById, addServiceToBooking.
 * No depende de Express ni de la petición/respuesta HTTP: recibe datos simples y devuelve datos o lanza errores de dominio.
 */
export default class BookingManager {
  #path;

  constructor(filePath) {
    if (!filePath) throw new Error("BookingManager requiere la ruta de bookings.json");
    this.#path = filePath;
  }

  // ---------- Validación ----------

  /** Valida el array de servicios y agrupa los repetidos sumando quantity. */
  #normalizeServices(services) {
    if (services === undefined || services === null) return [];
    if (!Array.isArray(services)) {
      throw new ValidationError("services debe ser un array", ["services"]);
    }

    const grouped = new Map();
    const errors = [];

    services.forEach((item, i) => {
      const serviceId = typeof item === "string" ? item : item?.service;
      const quantity = typeof item === "object" && item !== null && item.quantity !== undefined ? item.quantity : 1;

      if (typeof serviceId !== "string" || serviceId.trim() === "") {
        errors.push(`services[${i}].service debe ser el id de un servicio`);
        return;
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        errors.push(`services[${i}].quantity debe ser un número entero mayor a 0`);
        return;
      }
      grouped.set(serviceId, (grouped.get(serviceId) ?? 0) + quantity);
    });

    if (errors.length) throw new ValidationError("Servicios inválidos", errors);
    return [...grouped].map(([service, quantity]) => ({ service, quantity }));
  }

  /**
   * Valida los datos de una reserva (cliente, email, fecha, hora, estado y formato de services).
   * Devuelve el array de servicios normalizado para que el controller verifique que existan.
   */
  validateBooking(data) {
    const source = data && typeof data === "object" && !Array.isArray(data) ? data : {};

    const missing = REQUIRED_FIELDS.filter((f) => isMissing(source[f]));
    if (missing.length) {
      throw new ValidationError(`Faltan campos obligatorios: ${missing.join(", ")}`, missing);
    }

    const errors = [];
    if (typeof source.clientName !== "string") errors.push("clientName debe ser un texto no vacío");
    if (typeof source.clientEmail !== "string" || !EMAIL_REGEX.test(source.clientEmail.trim())) {
      errors.push("clientEmail debe ser un email válido");
    }
    if (!isValidDate(source.date)) errors.push("date debe ser una fecha válida con formato YYYY-MM-DD");
    if (typeof source.time !== "string" || !TIME_REGEX.test(source.time)) {
      errors.push("time debe ser una hora válida con formato HH:mm (24 horas)");
    }
    if (source.status !== undefined && !BOOKING_STATUSES.includes(source.status)) {
      errors.push(`status debe ser uno de: ${BOOKING_STATUSES.join(", ")}`);
    }
    if (errors.length) throw new ValidationError("Datos inválidos", errors);

    return this.#normalizeServices(source.services);
  }

  // ---------- Métodos públicos ----------

  /** Devuelve la reserva con el id indicado o null si no existe. */
  async getBookingById(id) {
    const bookings = await readJsonArray(this.#path);
    return bookings.find((b) => b.id === id) ?? null;
  }

  /**
   * Crea una reserva. El id se genera internamente; status por defecto es "pending"
   * y services puede venir vacío o no enviarse.
   */
  async createBooking(data) {
    const services = this.validateBooking(data);

    return enqueue(this.#path, async () => {
      const bookings = await readJsonArray(this.#path);
      const newBooking = {
        id: crypto.randomUUID(),
        clientName: data.clientName.trim(),
        clientEmail: data.clientEmail.trim().toLowerCase(),
        date: data.date,
        time: data.time,
        status: data.status ?? "pending",
        services,
      };
      bookings.push(newBooking);
      await writeJsonArray(this.#path, bookings);
      return newBooking;
    });
  }

  /**
   * Agrega un servicio a una reserva. Si el servicio ya está, incrementa su quantity;
   * si no, lo agrega con quantity 1. Devuelve la reserva actualizada o null si no existe.
   * La existencia del servicio la valida el controller a través del ServiceManager.
   */
  async addServiceToBooking(bookingId, serviceId) {
    return enqueue(this.#path, async () => {
      const bookings = await readJsonArray(this.#path);
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return null;

      if (booking.status === "cancelled") {
        throw new ValidationError("No se pueden agregar servicios a una reserva cancelada");
      }

      if (!Array.isArray(booking.services)) booking.services = [];
      const existing = booking.services.find((item) => item.service === serviceId);
      if (existing) existing.quantity += 1;
      else booking.services.push({ service: serviceId, quantity: 1 });

      await writeJsonArray(this.#path, bookings);
      return booking;
    });
  }
}
