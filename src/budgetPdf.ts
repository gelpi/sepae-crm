const price = (n:number) => `$ ${n.toLocaleString("es-UY")}`;
const day = (s:string) => s ? s.slice(0,10).split("-").reverse().join("/") : "—";

// PDF de texto vectorial, descargable sin enviar los datos a un servicio externo.
export function downloadBudgetPdf(b:any) {
  const lines = ["SEPAE | Presupuesto", `Referencia: ${b.id}`, `Cliente: ${b.customer.name}`, ...(b.customer.locality ? [`Localidad: ${b.customer.locality}`] : []), `Estado: ${b.status}`, `Emitido: ${day(b.issuedAt || b.createdAt)}`, `Vigencia indicada hasta: ${day(b.validUntil)}`, "", "Alternativas por persona", ""];
  for (const o of b.options) {
    lines.push(`${o.hours} horas - Acompañamiento${o.convalescence ? " + Convalecencia" : ""}${b.selectedOption === o.id ? " [ACEPTADA]" : ""}`, `Precio de lista: ${price(o.listPrice)}`, `Descuento permanente: ${o.discount}%`);
    if (o.debit) lines.push(`Primeros 3 meses con débito: ${price(o.firstMonths)} por mes`, `Desde el 4.º mes: ${price(o.monthly)} por mes`);
    else lines.push(`Cuota mensual: ${price(o.monthly)}`);
    lines.push(`Ahorro mensual${o.debit ? " primeros 3 meses" : ""}: ${price(o.listPrice-o.firstMonths)}`, "");
  }
  lines.push("La fecha de vigencia es informativa. Consultá con tu vendedora.", "Los valores corresponden a una persona y a las condiciones cotizadas.");
  if (b.status === "Borrador") lines.unshift("BORRADOR - No emitido", "");
  const wrapped = lines.flatMap(line => line.match(/.{1,86}(?:\s|$)|.{1,86}/g)?.map(s=>s.trim()) || [""]);
  const pages:string[][] = [];
  for (let i=0;i<wrapped.length;i+=43) pages.push(wrapped.slice(i,i+43));
  const escape = (value:string) => Array.from(value.normalize("NFC")).map(c => {
    const code=c.charCodeAt(0);
    if (c === "\\" || c === "(" || c === ")") return `\\${c}`;
    if (code > 127 && code <= 255) return `\\${code.toString(8).padStart(3,"0")}`;
    return code > 255 ? "-" : c;
  }).join("");
  const objects:string[] = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"];
  const pageIds:number[]=[];
  pages.forEach((page,index)=>{
    const id=objects.length+1, contentId=id+1;
    pageIds.push(id);
    const stream=`BT /F1 11 Tf 0.09 0.19 0.38 rg 48 790 Td 16 TL ${page.map((line,i)=>`${i?"T* ":""}(${escape(line)}) Tj`).join("\n")} ET\nBT /F1 9 Tf 48 35 Td (SEPAE - ${index+1}/${pages.length}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects[1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  let pdf="%PDF-1.4\n"; const offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const start=pdf.length;
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(o=>`${String(o).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  const url=URL.createObjectURL(new Blob([new Uint8Array(Array.from(pdf,c=>c.charCodeAt(0)))],{type:"application/pdf"}));
  const link=document.createElement("a");link.href=url;link.download=`SEPAE-presupuesto-${b.id.slice(0,8)}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
