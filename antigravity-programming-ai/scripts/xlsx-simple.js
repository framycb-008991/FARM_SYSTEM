'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function readZipEntries(filePath) {
  const buf = fs.readFileSync(filePath);
  const min = Math.max(0, buf.length - 0x10000 - 22);
  let eocd = -1;
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid XLSX: ZIP end-of-central-directory not found.');
  const entries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  let p = cdOffset;
  for (let i = 0; i < entries; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Invalid XLSX: bad central directory entry.');
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');

    if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid XLSX: bad local header for ${name}`);
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const data = buf.slice(dataStart, dataStart + compressedSize);
    let inflated;
    if (method === 0) inflated = data;
    else if (method === 8) inflated = zlib.inflateRawSync(data);
    else throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);
    out.set(name.replace(/\\/g, '/'), inflated.toString('utf8'));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function attrs(xmlTag) {
  const out = {};
  const re = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
  let m;
  while ((m = re.exec(xmlTag))) out[m[1]] = unescapeXml(m[2]);
  return out;
}

function unescapeXml(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function columnIndex(cellRef) {
  const letters = String(cellRef || '').match(/^[A-Z]+/i);
  if (!letters) return 0;
  let n = 0;
  for (const ch of letters[0].toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const strings = [];
  const siRe = /<si\b[\s\S]*?<\/si>/g;
  let si;
  while ((si = siRe.exec(xml))) {
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t;
    let text = '';
    while ((t = tRe.exec(si[0]))) text += unescapeXml(t[1]);
    strings.push(text);
  }
  return strings;
}

function parseWorkbook(entries) {
  const workbookXml = entries.get('xl/workbook.xml');
  const relsXml = entries.get('xl/_rels/workbook.xml.rels');
  if (!workbookXml || !relsXml) throw new Error('Invalid XLSX: workbook metadata missing.');

  const rels = new Map();
  const relRe = /<Relationship\b[^>]*>/g;
  let rel;
  while ((rel = relRe.exec(relsXml))) {
    const a = attrs(rel[0]);
    rels.set(a.Id, a.Target.replace(/^\//, ''));
  }

  const sheets = [];
  const sheetRe = /<sheet\b[^>]*>/g;
  let sh;
  while ((sh = sheetRe.exec(workbookXml))) {
    const a = attrs(sh[0]);
    const rid = a['r:id'];
    let target = rels.get(rid);
    if (!target) continue;
    if (!target.startsWith('xl/')) target = path.posix.join('xl', target);
    sheets.push({ name: a.name, path: target });
  }
  return sheets;
}

function parseSheet(xml, sharedStrings) {
  const rows = [];
  const rowRe = /<row\b[^>]*>[\s\S]*?<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(xml))) {
    const row = [];
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cell;
    while ((cell = cellRe.exec(rowMatch[0]))) {
      const a = attrs('<c' + cell[1] + '>');
      const idx = columnIndex(a.r);
      let value = '';
      const v = cell[2].match(/<v>([\s\S]*?)<\/v>/);
      const inline = cell[2].match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
      if (v) value = unescapeXml(v[1]);
      else if (inline) value = unescapeXml(inline[1]);
      if (a.t === 's') value = sharedStrings[Number(value)] || '';
      row[idx] = value;
    }
    rows.push(row.map(v => v == null ? '' : v));
  }
  return rows;
}

function readWorkbook(filePath) {
  const entries = readZipEntries(filePath);
  const sharedStrings = parseSharedStrings(entries.get('xl/sharedStrings.xml'));
  const sheets = parseWorkbook(entries).map(sheet => ({
    name: sheet.name,
    rows: parseSheet(entries.get(sheet.path), sharedStrings)
  }));
  return { sheets };
}

module.exports = { readWorkbook };
