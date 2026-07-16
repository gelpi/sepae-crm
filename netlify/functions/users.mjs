import { createPasswordHash, currentUser, getSheets, isAdmin, reply, spreadsheetId } from "./_shared.mjs";

export default async (request) => {
  const admin = currentUser(request);
  if (!isAdmin(admin)) return reply(403, { error: "Acceso exclusivo de administración." });
  try {
    const sheets = getSheets();
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Usuarios!A2:G" });
    const rows = result.data.values ?? [];
    if (request.method === "GET") return reply(200, { users: rows.map(([id, username, , role, active, , seller]) => ({ id, username, role, active: String(active).toUpperCase() === "TRUE", seller: seller || "" })) });
    if (request.method !== "POST") return reply(405, { error: "Método no permitido." });
    const { username, password, role, seller } = await request.json();
    if (!username || !password || !role) return reply(400, { error: "Completá usuario, contraseña y rol." });
    if (!['admin', 'vendedor'].includes(role)) return reply(400, { error: "Rol no válido." });
    if (role === 'vendedor' && !seller) return reply(400, { error: "Seleccioná la vendedora vinculada." });
    if (rows.some((row) => String(row[1]).toLowerCase() === username.trim().toLowerCase())) return reply(409, { error: "Ese usuario ya existe." });
    const id = `usr_${Date.now()}`;
    await sheets.spreadsheets.values.append({ spreadsheetId, range: "Usuarios!A:G", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: [[id, username.trim(), createPasswordHash(password), role, "TRUE", new Date().toISOString(), seller?.trim() || ""]] } });
    return reply(201, { user: { id, username: username.trim(), role, active: true, seller: seller?.trim() || "" } });
  } catch (error) { console.error("Users error", error); return reply(500, { error: "No se pudo gestionar los usuarios." }); }
};
