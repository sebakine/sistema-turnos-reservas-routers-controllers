import fs from "node:fs/promises";
import path from "node:path";

/**
 * Lee un archivo JSON que contiene un array.
 * Si el archivo no existe, lo crea vacío y devuelve [].
 */
export const readJsonArray = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    if (!content.trim()) return [];
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeJsonArray(filePath, []);
      return [];
    }
    throw error;
  }
};

/** Escribe un array en un archivo JSON con formato legible. */
export const writeJsonArray = async (filePath, data) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
};

const queues = new Map();

/**
 * Ejecuta una tarea en la cola asociada a un archivo. Las tareas sobre el mismo
 * archivo se ejecutan en serie, evitando que dos peticiones simultáneas se
 * sobrescriban al leer y escribir el JSON (aunque existan varias instancias del manager).
 */
export const enqueue = (filePath, task) => {
  const last = queues.get(filePath) ?? Promise.resolve();
  const run = last.then(task, task);
  queues.set(filePath, run.catch(() => {}));
  return run;
};
