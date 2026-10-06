type DocxRow = { subject: string; classwork: string; homework: string };
type DocxInput = { school: string; subtitle: string; planner: string; grade: string; className: string; week: string; semester: string; from: string; to: string; headers: [string, string, string]; rows: DocxRow[]; dictationLabel: string; dictation: string; notesLabel: string; notes: string; rtl: boolean };

const encoder = new TextEncoder();
const xml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
function paragraph(value: string, options: { bold?: boolean; size?: number; align?: string; color?: string; rtl?: boolean } = {}) {
  const { bold = false, size = 22, align, color = '172B4D', rtl = false } = options;
  const lines = value.split(/\r?\n/).map((line) => `<w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/><w:color w:val="${color}"/>${rtl ? '<w:rtl/>' : ''}</w:rPr><w:t xml:space="preserve">${xml(line || ' ')}</w:t></w:r>`).join('<w:r><w:br/></w:r>');
  return `<w:p><w:pPr>${align ? `<w:jc w:val="${align}"/>` : ''}${rtl ? '<w:bidi/>' : ''}<w:spacing w:after="100"/></w:pPr>${lines}</w:p>`;
}
function cell(value: string, width: number, options: { bold?: boolean; fill?: string; align?: string; rtl?: boolean; gridSpan?: number } = {}) {
  const { bold = false, fill, align = 'left', rtl = false, gridSpan } = options;
  const properties = `<w:tcW w:w="${width}" w:type="dxa"/>${fill ? `<w:shd w:fill="${fill}"/>` : ''}${gridSpan ? `<w:gridSpan w:val="${gridSpan}"/>` : ''}<w:vAlign w:val="center"/>`;
  return `<w:tc><w:tcPr>${properties}</w:tcPr>${paragraph(value, { bold, size: bold ? 22 : 20, align, rtl })}</w:tc>`;
}
function tableRow(cells: string[], header = false) { return `<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.join('')}</w:tr>`; }
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function u16(value: number) { return [value & 255, (value >>> 8) & 255]; }
function u32(value: number) { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }
function zip(files: { name: string; content: string }[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name), data = encoder.encode(file.content), crc = crc32(data);
    const localHeader = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    localParts.push(localHeader, name, data);
    const centralHeader = new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  const parts = [...localParts, ...centralParts, end];
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let cursor = 0;
  for (const part of parts) { output.set(part, cursor); cursor += part.length; }
  return new Blob([output.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function createWeeklyPlannerDocx(input: DocxInput) {
  const header = [paragraph(input.school, { bold: true, size: 30, align: 'center', color: '123B36', rtl: input.rtl }), paragraph(input.subtitle, { bold: true, size: 24, align: 'center', color: '123B36', rtl: input.rtl }), paragraph(input.planner, { bold: true, size: 30, align: 'center', rtl: input.rtl }), paragraph(`${input.week} · ${input.semester}     ${input.from}     ${input.to}     ${input.grade} (${input.className})`, { bold: true, size: 22, align: 'center', rtl: input.rtl })].join('');
  const widths = [2400, 6600, 5000];
  const headerRow = tableRow(input.headers.map((title, i) => cell(title, widths[i], { bold: true, fill: 'DCE6F1', align: 'center', rtl: input.rtl })), true);
  const rows = input.rows.map((row) => tableRow([
    cell(row.subject, widths[0], { bold: true, fill: 'EAF0F6', align: 'center', rtl: input.rtl }),
    cell(row.classwork || '—', widths[1], { rtl: input.rtl }),
    cell(row.homework || '—', widths[2], { rtl: input.rtl }),
  ])).join('');
  const footer = [input.dictation && tableRow([cell(input.dictationLabel, widths[0], { bold: true, fill: 'EAF0F6', rtl: input.rtl }), cell(input.dictation, widths[1] + widths[2], { gridSpan: 2, rtl: input.rtl })]), input.notes && tableRow([cell(input.notesLabel, widths[0], { bold: true, fill: 'EAF0F6', rtl: input.rtl }), cell(input.notes, widths[1] + widths[2], { gridSpan: 2, rtl: input.rtl })])].filter(Boolean).join('');
  const borders = '<w:tblBorders><w:top w:val="single" w:sz="14" w:color="123B36"/><w:left w:val="single" w:sz="14" w:color="123B36"/><w:bottom w:val="single" w:sz="14" w:color="123B36"/><w:right w:val="single" w:sz="14" w:color="123B36"/><w:insideH w:val="single" w:sz="8" w:color="64748B"/><w:insideV w:val="single" w:sz="8" w:color="64748B"/></w:tblBorders>';
  const table = `<w:tbl><w:tblPr><w:tblW w:w="14000" w:type="dxa"/>${borders}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${headerRow}${rows}${footer}</w:tbl>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${header}${table}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="480" w:right="480" w:bottom="480" w:left="480" w:header="240" w:footer="240" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return zip([
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', content: document },
  ]);
}
