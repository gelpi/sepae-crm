import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";

export default async (request) => {
  const user = currentUser(request);
  if (!user) return reply(401, { error: "Sesión no válida." });
  try {
    const params = new URL(request.url).searchParams;
    const query = (params.get("q") || "").trim().toLowerCase();
    const origin = params.get("origin") || "";
    const type = params.get("type") || "";
    const member = params.get("member") || "";
    const deleted = params.get("deleted") === "1" && user.role === "admin";
    const sheets = getSheets();
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Respuestas de formulario 1!A2:J" });
    const allRows = (result.data.values ?? []).map((row, index) => ({ row, rowNumber: index + 2 }));
    const visibleRows = allRows.filter(({ row }) => (user.role === "admin" || String(row[1]).trim().toLowerCase() === String(user.seller).trim().toLowerCase()) && (deleted ? Boolean(row[9]) : !row[9]));
    const filteredRows = visibleRows.filter(({ row }) => {
      const searchable = [row[2], row[3], row[4], row[7]].join(" ").toLowerCase();
      const typeMatches = !type || (type === "Sin clasificar" ? !row[8] || row[8] === "Sin clasificar" : row[8] === type);
      return (!query || searchable.includes(query)) && (!origin || row[6] === origin) && typeMatches && (!member || row[5] === member);
    });
    const contacts = filteredRows.slice().reverse().slice(0, 100).map(({ row, rowNumber }) => ({
      id: rowNumber,
      fecha: row[0] || "",
      vendedora: row[1] || "Sin asignar",
      nombre: row[2] || "Sin nombre",
      telefono: row[3] || "Sin teléfono",
      document: row[4] || "",
      origen: row[6] || "Sin origen",
      comentario: row[7] || "Sin comentarios",
      tipo: row[8] || "Sin clasificar",
      socio: row[5] || "Sin dato"
    }));
    const today = new Date().toLocaleDateString("en-CA");
    const options = (column) => [...new Set(visibleRows.map(({ row }) => row[column]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es"));
    const types = [...new Set([...options(8), "Sin clasificar"])];
    return reply(200, { contacts, totalFiltered: filteredRows.length, filters: { origins: options(6), types, members: options(5), sellers: options(1) }, metrics: { total: visibleRows.length, hoy: visibleRows.filter(({ row }) => String(row[0]).startsWith(today)).length, conTelefono: visibleRows.filter(({ row }) => row[3]).length, sinClasificar: visibleRows.filter(({ row }) => !row[8] || row[8] === "Sin clasificar").length } });
  } catch (error) { console.error("Contacts error", error); return reply(500, { error: "No se pudieron cargar los contactos." }); }
};
