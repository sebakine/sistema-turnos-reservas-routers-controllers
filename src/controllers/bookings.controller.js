import BookingManager from "../managers/BookingManager.js";
import ServiceManager from "../managers/ServiceManager.js";
import envConfig from "../config/env.config.js";
import { toErrorResponse } from "../utils/errors.js";

/**
 * Controller de bookings: lee la request, llama al BookingManager (y al ServiceManager
 * para validar que los servicios existan) y responde con res.status().json().
 */
const bookingManager = new BookingManager(envConfig.BOOKINGS_FILE);
const serviceManager = new ServiceManager(envConfig.SERVICES_FILE);

/** Responde un error usando el código HTTP que corresponde. */
const sendError = (res, error) => {
  const { statusCode, body } = toErrorResponse(error);
  return res.status(statusCode).json(body);
};

/** POST /api/bookings -> crea una reserva (services puede iniciar vacío) */
export const createBooking = async (req, res) => {
  try {
    // 1. Valida los datos de la reserva y el formato de services
    const services = bookingManager.validateBooking(req.body);

    // 2. Verifica, vía ServiceManager, que los servicios enviados existan
    const notFound = [];
    for (const { service } of services) {
      if (!(await serviceManager.getServiceById(service))) notFound.push(service);
    }
    if (notFound.length) {
      return res.status(400).json({
        status: "error",
        error: `No existen los servicios: ${notFound.join(", ")}`,
        details: notFound,
      });
    }

    // 3. Crea la reserva
    const newBooking = await bookingManager.createBooking(req.body);
    return res.status(201).json({ status: "success", message: "Reserva creada", payload: newBooking });
  } catch (error) {
    return sendError(res, error);
  }
};

/** GET /api/bookings/:bid -> una reserva por id */
export const getBookingById = async (req, res) => {
  try {
    const { bid } = req.params;
    const booking = await bookingManager.getBookingById(bid);
    if (!booking) {
      return res.status(404).json({ status: "error", error: `No existe una reserva con id ${bid}` });
    }
    return res.status(200).json({ status: "success", payload: booking });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * POST /api/bookings/:bid/services/:sid -> agrega un servicio a una reserva existente.
 * Valida que exista la reserva (BookingManager) y el servicio (ServiceManager).
 * Si el servicio ya estaba en la reserva, se incrementa su quantity.
 */
export const addServiceToBooking = async (req, res) => {
  try {
    const { bid, sid } = req.params;

    const booking = await bookingManager.getBookingById(bid);
    if (!booking) {
      return res.status(404).json({ status: "error", error: `No existe una reserva con id ${bid}` });
    }

    const service = await serviceManager.getServiceById(sid);
    if (!service) {
      return res.status(404).json({ status: "error", error: `No existe un servicio con id ${sid}` });
    }

    const updated = await bookingManager.addServiceToBooking(bid, sid);
    if (!updated) {
      return res.status(404).json({ status: "error", error: `No existe una reserva con id ${bid}` });
    }
    return res.status(200).json({ status: "success", message: "Servicio agregado a la reserva", payload: updated });
  } catch (error) {
    return sendError(res, error);
  }
};
