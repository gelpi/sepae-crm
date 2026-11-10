export function contactChannels(body) {
  const rawPhone = String(body.phone || "").trim();
  const phone = rawPhone.replace(/\D/g, "");
  const address = String(body.address || "").trim();
  if (rawPhone && (phone.length < 8 || phone.length > 15)) return { error: "Ingresá un teléfono válido o dejalo vacío y completá la dirección." };
  if (!phone && !address) return { error: "Ingresá un teléfono o una dirección para poder contactar a esta persona." };
  return { phone, address };
}
