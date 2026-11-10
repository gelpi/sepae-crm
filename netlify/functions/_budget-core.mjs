import { createHmac, timingSafeEqual } from "node:crypto";

export const ownsBudget = (user, budget) => user.role === "admin" || String(user.seller).trim().toLowerCase() === String(budget.seller).trim().toLowerCase();
export function validDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function shareKey(id, secret = process.env.AUTH_SECRET) {
  if (!secret) throw new Error("Falta configuración de autenticación.");
  return createHmac("sha256", secret).update(`sepae-budget-share-v1:${id}`).digest("hex");
}
export function verifyKey(id, key) {
  if (!/^[a-f0-9]{64}$/.test(key || "")) return false;
  return timingSafeEqual(Buffer.from(shareKey(id)), Buffer.from(key));
}
export function quoteOptions(calculator, input) {
  const age = Number(input.age);
  if (!Number.isInteger(age) || age < 1 || age > 120) throw new Error("Ingresá una edad entre 1 y 120 años.");
  if (!["iac", "msp", "medica", "asse", "ninguna"].includes(input.coverage)) throw new Error("Elegí una afiliación válida.");
  if (input.family && !["pareja", "hijo-madre", "hijo-padre"].includes(input.family)) throw new Error("Elegí un grupo familiar válido.");
  const discount = input.coverage === "iac" ? 20 : input.coverage !== "ninguna" ? 15 : input.family ? 25 : 0;
  const group = age < 55 ? "under55" : "over55";
  if (!Array.isArray(input.options) || input.options.length < 1 || input.options.length > 6) throw new Error("Elegí entre una y seis alternativas.");
  const keys = new Set();
  return input.options.map(option => {
    const hours = Number(option.hours), convalescence = option.convalescence === true;
    const id = `${hours}-${convalescence ? "combo" : "base"}`;
    if (![8, 16, 24].includes(hours) || keys.has(id)) throw new Error("Alternativas inválidas o repetidas.");
    keys.add(id);
    const base = calculator.internacion[group].find(p => p.hours === hours)?.base;
    const upgrade = convalescence ? calculator.convalecencia[group].find(p => p.hours === hours)?.base : 0;
    if (!(base > 0) || (convalescence && !(upgrade > 0))) throw new Error("No hay una tarifa válida para esta alternativa.");
    const monthly = Math.round(base * (1 - discount / 100)) + Math.round(upgrade * (1 - discount / 100));
    const firstMonths = input.debit === true ? Math.round(Math.round(base * (1 - discount / 100)) * .75) + Math.round(Math.round(upgrade * (1 - discount / 100)) * .75) : monthly;
    return { id, hours, convalescence, listPrice: base + upgrade, monthly, firstMonths, discount, debit: input.debit === true };
  });
}
export function publicBudget(budget) {
  return { id: budget.id, status: budget.status, issuedAt: budget.issuedAt, validUntil: budget.validUntil, customer: { name: budget.customer.name, locality: budget.customer.locality }, options: budget.options, selectedOption: budget.selectedOption, saleDate: budget.saleDate };
}
export function budgetSale(budget) {
  return { id: `presupuesto:${budget.id}`, leadId: budget.leadId, nombre: budget.customer.name, vendedora: budget.seller, fecha: budget.saleDate, nota: `Presupuesto ${budget.id} · ${budget.options.find(o => o.id === budget.selectedOption)?.hours} horas${budget.options.find(o => o.id === budget.selectedOption)?.convalescence ? " + Convalecencia" : ""}`, budgetId: budget.id };
}
