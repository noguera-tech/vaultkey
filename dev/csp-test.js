'use strict';

/* Verifica que cada script inline de las paginas publicas este autorizado por
   un hash exacto y que unsafe-inline no habilite bloques <script> generales. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function policyFrom(html, file) {
  const match = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]+)"/i);
  if (!match) throw new Error(`${file}: falta la CSP`);
  const directives = {};
  for (const part of match[1].split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length) directives[tokens[0]] = tokens.slice(1);
  }
  return directives;
}

function inlineHashes(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    /* El parser HTML normaliza CRLF/CR a LF antes de validar el hash. */
    .map(match => match[1].replace(/\r\n?/g, '\n'))
    .map(source => `'sha256-${crypto.createHash('sha256').update(source, 'utf8').digest('base64')}'`);
}

function requireHashes(file, directive) {
  const html = read(file);
  const policy = policyFrom(html, file);
  const sources = policy[directive] || [];
  if (sources.includes("'unsafe-inline'")) {
    throw new Error(`${file}: ${directive} conserva unsafe-inline`);
  }
  for (const hash of inlineHashes(html)) {
    if (!sources.includes(hash)) throw new Error(`${file}: hash inline ausente: ${hash}`);
  }
  return policy;
}

const appPolicy = requireHashes('app.html', 'script-src-elem');
if (!appPolicy['script-src-attr'] || !appPolicy['script-src-attr'].includes("'unsafe-inline'")) {
  throw new Error('app.html: los manejadores legacy deben conservarse explicitamente durante la fase 1');
}
if ((appPolicy['style-src'] || []).includes("'unsafe-inline'") ||
    (appPolicy['style-src-elem'] || []).includes("'unsafe-inline'")) {
  throw new Error('app.html: los bloques de estilo no deben permitir unsafe-inline');
}
if (!appPolicy['style-src-attr'] || !appPolicy['style-src-attr'].includes("'unsafe-inline'")) {
  throw new Error('app.html: los estilos de atributo legacy deben conservarse durante la fase 1');
}

requireHashes('index.html', 'script-src');
console.log('OK: hashes CSP de app.html e index.html verificados');
