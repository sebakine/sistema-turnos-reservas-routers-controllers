import ServiceManager from "../managers/ServiceManager.js";
import envConfig from "../config/env.config.js";
import { toErrorResponse } from "../utils/errors.js";

/**
 * Controller de services: lee la request (req.params, req.query, req.body),
 * llama al ServiceManager y responde con res.status().json().
 */
const serviceManager = new ServiceManager(envConfig.SERVICES_FILE);

/** Responde un error usando el código HTTP que corresponde. */
const sendError = (res, error) => {
  const { statusCode, body } = toErrorResponse(error);
  return res.status(statusCode).json(body);
};

/** GET /api/services -> todos los servicios (filtros opcionales ?category= y ?available=) */
export const getServices = async (req, res) => {
  try {
    const { category, available } = req.query;
    const filters = {};

    if (category !== undefined) {
      if (typeof category !== "string" || category.trim() === "") {
        return res.status(400).json({ status: "error", error: "El filtro category debe ser un texto no vacío" });
      }
      filters.category = category;
    }
    if (available !== undefined) {
      if (available !== "true" && available !== "false") {
        return res.status(400).json({ status: "error", error: "El filtro available solo acepta true o false" });
      }
      filters.available = available === "true";
    }

    const services = await serviceManager.getServices(filters);
    return res.status(200).json({ status: "success", count: services.length, payload: services });
  } catch (error) {
    return sendError(res, error);
  }
};

/** GET /api/services/:sid -> un servicio por id */
export const getServiceById = async (req, res) => {
  try {
    const { sid } = req.params;
    const service = await serviceManager.getServiceById(sid);
    if (!service) {
      return res.status(404).json({ status: "error", error: `No existe un servicio con id ${sid}` });
    }
    return res.status(200).json({ status: "success", payload: service });
  } catch (error) {
    return sendError(res, error);
  }
};

/** POST /api/services -> crea un servicio (el id se genera en el manager) */
export const createService = async (req, res) => {
  try {
    const newService = await serviceManager.addService(req.body);
    return res.status(201).json({ status: "success", message: "Servicio creado", payload: newService });
  } catch (error) {
    return sendError(res, error);
  }
};

/** PUT /api/services/:sid -> actualiza un servicio (el id no se modifica) */
export const updateService = async (req, res) => {
  try {
    const { sid } = req.params;
    const updated = await serviceManager.updateService(sid, req.body);
    if (!updated) {
      return res.status(404).json({ status: "error", error: `No existe un servicio con id ${sid}` });
    }
    return res.status(200).json({ status: "success", message: "Servicio actualizado", payload: updated });
  } catch (error) {
    return sendError(res, error);
  }
};

/** DELETE /api/services/:sid -> elimina un servicio */
export const deleteService = async (req, res) => {
  try {
    const { sid } = req.params;
    const deleted = await serviceManager.deleteService(sid);
    if (!deleted) {
      return res.status(404).json({ status: "error", error: `No existe un servicio con id ${sid}` });
    }
    return res.status(200).json({ status: "success", message: "Servicio eliminado", payload: deleted });
  } catch (error) {
    return sendError(res, error);
  }
};
