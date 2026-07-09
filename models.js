/* ============================================================
   VaultKey 2.0 — models.js
   Modelos de datos base (Plan Módulo 1 · 1.8)

   REGLAS (decisión 08-07):
   · Pieza aislada: NO se integra en app.js en el Módulo 1.
   · No lee localStorage, no toca Drive, no cifra, no accede a
     bóveda real ni a datos reales.
   · schemaVersion: 2 marca el esquema lógico de VaultKey 2.0.
     El blob 1.x era version: 1. Este marcador NO toca el formato
     cifrado de respaldo (Módulo 2+); solo etiqueta el esquema
     lógico para la futura decisión de Migración 1.x.
   · Favoritos NO es un modelo: es la vista agregada fav === true.

   NOTA DE AUDITORÍA (aprobada 08-07): crypto.randomUUID() se usa
   ÚNICAMENTE para generar identificadores de entrada. No es
   criptografía de bóveda: aquí no hay cifrado, KDF, claves ni
   secretos. Cualquier auditoría futura debe leerlo como un
   generador de IDs estándar del navegador/Node, no como parte
   de la superficie criptográfica de VaultKey.
   ============================================================ */

(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.vkModels = api; }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var SCHEMA_VERSION = 2;

  var TYPES = ['password', 'note', 'card', 'document'];
  var PASSWORD_SUBTYPES = ['web', 'wifi', 'pin', 'recovery'];
  var DOC_TYPES = ['dni', 'pasaporte', 'permiso', 'sanitaria', 'vacunas', 'seguro', 'otro'];

  /* Campos comunes a toda entrada */
  var COMMON_FIELDS = ['id', 'type', 'title', 'fav', 'tags', 'createdAt', 'updatedAt'];

  /* Campos específicos por tipo (lista blanca) — propuesta inicial
     aprobada el 08-07, pendiente de validación contra Figma */
  var TYPE_FIELDS = {
    password: ['subtype', 'username', 'password', 'url', 'notes', 'codes', 'passHistory'],
    note:     ['body'],
    card:     ['holder', 'number', 'expiry', 'cvv', 'brand', 'notes'],
    document: ['docType', 'number', 'expiry', 'notes', 'attachmentRef']
  };

  /* Defaults por tipo al crear */
  var TYPE_DEFAULTS = {
    password: { subtype: 'web', username: '', password: '', url: '', notes: '', codes: '', passHistory: [] },
    note:     { body: '' },
    card:     { holder: '', number: '', expiry: '', cvv: '', brand: '', notes: '' },
    document: { docType: 'otro', number: '', expiry: '', notes: '', attachmentRef: '' }
  };

  /* ---------- Utilidades ---------- */

  function uuid() {
    /* Solo IDs — ver NOTA DE AUDITORÍA en cabecera */
    var c = (typeof crypto !== 'undefined' && crypto) ||
            (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
    if (c && typeof c.randomUUID === 'function') { return c.randomUUID(); }
    /* Fallback no criptográfico, suficiente para IDs locales */
    var s = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return s.replace(/[xy]/g, function (ch) {
      var r = Math.floor(Math.random() * 16);
      var v = ch === 'x' ? r : (r % 4) + 8;
      return v.toString(16);
    });
  }

  function isString(v) { return typeof v === 'string'; }
  function isNumber(v) { return typeof v === 'number' && isFinite(v); }
  function isStringArray(v) {
    if (!Array.isArray(v)) { return false; }
    for (var i = 0; i < v.length; i++) { if (!isString(v[i])) { return false; } }
    return true;
  }

  function allowedFields(type) {
    return COMMON_FIELDS.concat(TYPE_FIELDS[type] || []);
  }

  /* Copia una entrada conservando SOLO los campos de la lista
     blanca de su tipo. Los campos desconocidos se descartan. */
  function pickKnown(raw) {
    var out = {};
    var allow = allowedFields(raw && raw.type);
    for (var i = 0; i < allow.length; i++) {
      var k = allow[i];
      if (raw && Object.prototype.hasOwnProperty.call(raw, k)) { out[k] = raw[k]; }
    }
    return out;
  }

  /* ---------- API ---------- */

  function create(type, data) {
    if (TYPES.indexOf(type) === -1) {
      throw new Error('vkModels.create: tipo desconocido "' + type + '"');
    }
    data = data || {};
    var now = Date.now();
    var entry = {
      id: uuid(),
      type: type,
      title: isString(data.title) ? data.title : '',
      fav: data.fav === true,
      tags: isStringArray(data.tags) ? data.tags.slice() : [],
      createdAt: now,
      updatedAt: now
    };
    var defaults = TYPE_DEFAULTS[type];
    var fields = TYPE_FIELDS[type];
    for (var i = 0; i < fields.length; i++) {
      var k = fields[i];
      entry[k] = Object.prototype.hasOwnProperty.call(data, k)
        ? data[k]
        : (Array.isArray(defaults[k]) ? defaults[k].slice() : defaults[k]);
    }
    return entry;
  }

  function validate(entry) {
    var errors = [];
    if (!entry || typeof entry !== 'object') {
      return { ok: false, errors: ['entrada no es un objeto'] };
    }
    if (TYPES.indexOf(entry.type) === -1) {
      return { ok: false, errors: ['type inválido: ' + entry.type] };
    }
    /* Comunes */
    if (!isString(entry.id) || !entry.id) { errors.push('id requerido'); }
    if (!isString(entry.title) || entry.title.trim() === '') { errors.push('title requerido'); }
    if (typeof entry.fav !== 'boolean') { errors.push('fav debe ser boolean'); }
    if (!isStringArray(entry.tags)) { errors.push('tags debe ser array de strings'); }
    if (!isNumber(entry.createdAt)) { errors.push('createdAt debe ser número'); }
    if (!isNumber(entry.updatedAt)) { errors.push('updatedAt debe ser número'); }

    /* Por tipo */
    if (entry.type === 'password') {
      if (PASSWORD_SUBTYPES.indexOf(entry.subtype) === -1) {
        errors.push('subtype inválido: ' + entry.subtype);
      } else if (entry.subtype === 'recovery') {
        if (!isString(entry.codes) || entry.codes.trim() === '') {
          errors.push('codes requerido en subtype recovery');
        }
      } else {
        if (!isString(entry.password) || entry.password === '') {
          errors.push('password requerido en subtype ' + entry.subtype);
        }
      }
      if (!Array.isArray(entry.passHistory)) { errors.push('passHistory debe ser array'); }
    }
    if (entry.type === 'note') {
      if (!isString(entry.body)) { errors.push('body debe ser string'); }
    }
    if (entry.type === 'card') {
      var cardStr = ['holder', 'number', 'expiry', 'cvv', 'brand', 'notes'];
      for (var i = 0; i < cardStr.length; i++) {
        if (!isString(entry[cardStr[i]])) { errors.push(cardStr[i] + ' debe ser string'); }
      }
    }
    if (entry.type === 'document') {
      if (DOC_TYPES.indexOf(entry.docType) === -1) {
        errors.push('docType inválido: ' + entry.docType);
      }
      if (!isString(entry.attachmentRef)) { errors.push('attachmentRef debe ser string (solo referencia)'); }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function serialize(entries) {
    if (!Array.isArray(entries)) {
      throw new Error('vkModels.serialize: se esperaba un array de entradas');
    }
    return JSON.stringify({
      app: 'VaultKey',
      schemaVersion: SCHEMA_VERSION,
      exported: Date.now(),
      entries: entries
    });
  }

  function deserialize(json) {
    var parsed;
    try { parsed = JSON.parse(json); }
    catch (e) { return { ok: false, entries: [], errors: ['JSON inválido'] }; }

    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) {
      return {
        ok: false, entries: [],
        errors: ['schemaVersion no soportada: ' + (parsed && parsed.schemaVersion)]
      };
    }
    if (!Array.isArray(parsed.entries)) {
      return { ok: false, entries: [], errors: ['entries debe ser array'] };
    }
    var entries = [];
    var errors = [];
    for (var i = 0; i < parsed.entries.length; i++) {
      var clean = pickKnown(parsed.entries[i]); /* descarta campos desconocidos */
      var v = validate(clean);
      if (v.ok) { entries.push(clean); }
      else { errors.push('entrada ' + i + ': ' + v.errors.join('; ')); }
    }
    return { ok: errors.length === 0, entries: entries, errors: errors };
  }

  function favorites(entries) {
    if (!Array.isArray(entries)) { return []; }
    return entries.filter(function (e) { return e && e.fav === true; });
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    TYPES: TYPES.slice(),
    PASSWORD_SUBTYPES: PASSWORD_SUBTYPES.slice(),
    DOC_TYPES: DOC_TYPES.slice(),
    create: create,
    validate: validate,
    serialize: serialize,
    deserialize: deserialize,
    favorites: favorites
  };
});
