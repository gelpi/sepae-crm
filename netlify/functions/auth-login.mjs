import { createToken, getSheets, passwordMatches, reply, spreadsheetId } from "./_shared.mjs";

export default async (request) => {
  if (request.method !== "POST") return reply(405, { error: "Método no permitido" });
  try {
    const { username, password } = await request.json();
    if (!username || !password) return reply(400, { error: "Ingresá usuario y contraseña." });
    const sheets = getSheets();
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Usuarios!A2:F" });
    const user = (result.data.values ?? []).map(([id, name, hash, role, active]) => ({ id, username: name, hash, role, active }))
      .find((entry) => entry.username?.toLowerCase() === username.trim().toLowerCase());
    if (!user || String(user.active).toUpperCase() !== "TRUE" || !passwordMatches(password, user.hash)) return reply(401, { error: "Usuario o contraseña incorrectos." });
    return reply(200, { token: createToken(user), user: { username: user.username, role: user.role } });
  } catch (error) { console.error("Login error", error); return reply(500, { error: "No se pudo iniciar sesión." }); }
};
