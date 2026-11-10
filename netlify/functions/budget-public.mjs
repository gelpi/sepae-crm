import { getSheets, reply } from "./_shared.mjs";
import { readBudgets } from "./_budgets.mjs";
import { publicBudget, verifyKey } from "./_budget-core.mjs";

export default async request => {
  if (request.method !== "GET") return reply(405, { error: "Método no permitido." });
  const id = new URL(request.url).searchParams.get("id");
  try {
    if (!/^[0-9a-f-]{36}$/.test(id || "") || !verifyKey(id, request.headers.get("X-Budget-Key"))) return reply(404, { error: "Presupuesto no disponible." });
    const { entries } = await readBudgets(getSheets());
    const budget = entries.find(e => e.budget.id === id)?.budget;
    if (!budget || !["Emitido", "Aprobado", "Vencido"].includes(budget.status)) return reply(404, { error: "Presupuesto no disponible." });
    return new Response(JSON.stringify({ budget: publicBudget(budget) }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } });
  } catch { return reply(500, { error: "No se pudo abrir el presupuesto. Intentá nuevamente." }); }
};
