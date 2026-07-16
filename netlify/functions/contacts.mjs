import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";

export default async (request) => {
  const user = currentUser(request);
  if (!user) return reply(401, { error: "Sesión no válida." });
  try {
    const sheets = getSheets();
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Respuestas de formulario 1!A2:I" });
    const allRows = result.data.values ?? [];
    const visibleRows = user.role === "admin" ? allRows : allRows.filter((row) => String(row[1]).trim().toLowerCase() === String(user.seller).trim().toLowerCase());
    const contacts = visibleRows.slice().reverse().slice(0, 100).map((row, index) => ({
      id: visibleRows.length - index,
      fecha: row[0] || "",
      vendedora: row[1] || "Sin asignar",
      nombre: row[2] || "Sin nombre",
      telefono: row[3] || "Sin teléfono",
      origen: row[6] || "Sin origen",
      comentario: row[7] || "Sin comentarios",
      tipo: row[8] || "Sin clasificar"
    }));
    const today = new Date().toLocaleDateString("en-CA");
    return reply(200, { contacts, metrics: { total: visibleRows.length, hoy: visibleRows.filter((row) => String(row[0]).startsWith(today)).length, conTelefono: visibleRows.filter((row) => row[3]).length, sinClasificar: visibleRows.filter((row) => !row[8]).length } });
  } catch (error) { console.error("Contacts error", error); return reply(500, { error: "No se pudieron cargar los contactos." }); }
};
