import crypto from "node:crypto";
import { readJsonArray, writeJsonArray, enqueue } from "../utils/jsonFile.js";
import { ValidationError } from "../utils/errors.js";

/** Campos obligatorios de un servicio (el id se genera internamente). */
const FIELDS = ["name", "description", "duration", "price", "category", "available"];

/** Reglas de validación de cada campo. */
const RULES = {
  name: {
    isValid: (v) => typeof v === "string" && v.trim().length > 0,
    message: "name debe ser un texto no vacío",
  },
  description: {
    isValid: (v) => typeof v === "string" && v.trim().length > 0,
    message: "description debe ser un texto no vacío",
  },
  duration: {
    isValid: (v) => Number.isInteger(v) && v > 0,
    message: "duration debe ser un número entero de minutos mayor a 0",
  },
  price: {
    isValid: (v) => typeof v === "number" && Number.isFinite(v) && v >= 0,
    message: "price debe ser un número mayor o igual a 0",
  },
  category: {
    isValid: (v) => typeof v === "string" && v.trim().length > 0,
    message: "category debe ser un texto no vacío",
  },
  available: {
    isValid: (v) => typeof v === "boolean",
    message: "available debe ser true o false",
  },
};

const isMissing = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/**
 * ServiceManager: gestiona el recurso "services" persistido en services.json.
 * Métodos: getServices, getServiceById, addService, updateService, deleteService.
 */
export default class ServiceManager {
  #path;

  constructor(filePath) {
    if (!filePath) throw new Error("ServiceManager requiere la ruta de services.json");
    this.#path = filePath;
  }

  // ---------- Validación ----------

  /** Conserva solo los campos permitidos (descarta el id y campos desconocidos). */
  #pick(data) {
    const source = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    const picked = {};
    for (const field of FIELDS) {
      if (Object.hasOwn(source, field)) picked[field] = source[field];
    }
    return picked;
  }

  /** Valida tipos y normaliza textos de los campos presentes. */
  #validate(data) {
    const errors = FIELDS.filter((f) => f in data && !RULES[f].isValid(data[f])).map((f) => RULES[f].message);
    if (errors.length) throw new ValidationError("Datos inválidos", errors);

    const clean = { ...data };
    for (const f of ["name", "description"]) if (clean[f] !== undefined) clean[f] = clean[f].trim();
    if (clean.category !== undefined) clean.category = clean.category.trim().toLowerCase();
    return clean;
  }

  // ---------- Métodos públicos ----------

  /**
   * Devuelve todos los servicios. Admite filtros opcionales { category, available }.
   */
  async getServices(filters = {}) {
    let services = await readJsonArray(this.#path);
    if (filters.category !== undefined) {
      const category = String(filters.category).trim().toLowerCase();
      services = services.filter((s) => String(s.category).toLowerCase() === category);
    }
    if (filters.available !== undefined) {
      services = services.filter((s) => s.available === filters.available);
    }
    return services;
  }

  /** Devuelve el servicio con el id indicado o null si no existe. */
  async getServiceById(id) {
    const services = await readJsonArray(this.#path);
    return services.find((s) => s.id === id) ?? null;
  }

  /**
   * Crea un servicio validando todos sus campos.
   * El id se genera con crypto.randomUUID(); si llega un id en el body, se ignora.
   */
  async addService(data) {
    const payload = this.#pick(data);
    const missing = FIELDS.filter((f) => isMissing(payload[f]));
    if (missing.length) {
      throw new ValidationError(`Faltan campos obligatorios: ${missing.join(", ")}`, missing);
    }
    const valid = this.#validate(payload);

    return enqueue(this.#path, async () => {
      const services = await readJsonArray(this.#path);
      const newService = {
        id: crypto.randomUUID(),
        name: valid.name,
        description: valid.description,
        duration: valid.duration,
        price: valid.price,
        category: valid.category,
        available: valid.available,
      };
      services.push(newService);
      await writeJsonArray(this.#path, services);
      return newService;
    });
  }

  /**
   * Actualiza los campos enviados de un servicio. El id nunca se modifica.
   * Devuelve el servicio actualizado o null si no existe.
   */
  async updateService(id, data) {
    const payload = this.#pick(data);
    if (Object.keys(payload).length === 0) {
      throw new ValidationError(`Debe enviar al menos un campo a actualizar: ${FIELDS.join(", ")}`, FIELDS);
    }
    const empty = Object.keys(payload).filter((f) => isMissing(payload[f]));
    if (empty.length) {
      throw new ValidationError(`Los siguientes campos no pueden estar vacíos: ${empty.join(", ")}`, empty);
    }
    const valid = this.#validate(payload);

    return enqueue(this.#path, async () => {
      const services = await readJsonArray(this.#path);
      const index = services.findIndex((s) => s.id === id);
      if (index === -1) return null;

      services[index] = { ...services[index], ...valid, id: services[index].id };
      await writeJsonArray(this.#path, services);
      return services[index];
    });
  }

  /** Elimina un servicio. Devuelve el servicio eliminado o null si no existe. */
  async deleteService(id) {
    return enqueue(this.#path, async () => {
      const services = await readJsonArray(this.#path);
      const index = services.findIndex((s) => s.id === id);
      if (index === -1) return null;

      const [deleted] = services.splice(index, 1);
      await writeJsonArray(this.#path, services);
      return deleted;
    });
  }
}
