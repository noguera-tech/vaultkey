
'use strict';

const fs = require('fs');
const path = require('path');

let ok = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✔ ' + name);
    ok += 1;
  } catch (error) {
    console.error('  ✘ ' + name);
    console.error('    ' + error.message);
    failed += 1;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const root = path.resolve(__dirname, '..');
const appHtml = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

const expectedOrder = [
  'vault-crypto.js',
  'vault-store.js',
  'vault-keys.js',
  'vault-state.js',
  'transaction-store.js',
  'transaction-recovery.js',
  'router.js'
];

console.log('== Orden de carga en app.html ==');

test('los módulos aparecen exactamente una vez', function () {
  [
    'vault-keys.js',
    'vault-state.js',
    'transaction-store.js',
    'transaction-recovery.js'
  ].forEach(function (file) {
    const pattern = new RegExp(
      '<script\\s+src=["\']' +
      file.replace('.', '\\.') +
      '["\']\\s*><\\/script>',
      'g'
    );

    const matches = appHtml.match(pattern) || [];

    assert(
      matches.length === 1,
      file + ' debe aparecer exactamente una vez; aparece ' + matches.length
    );
  });
});

test('el orden de scripts es el esperado', function () {
  let previousPosition = -1;

  expectedOrder.forEach(function (file) {
    const marker = '<script src="' + file + '"></script>';
    const position = appHtml.indexOf(marker);

    assert(position !== -1, 'No se encontró ' + marker);
    assert(
      position > previousPosition,
      file + ' aparece fuera del orden esperado'
    );

    previousPosition = position;
  });
});

console.log('== Carga pasiva sin efectos secundarios ==');

let storageReads = 0;
let storageWrites = 0;
let indexedDbAccesses = 0;

global.localStorage = {
  getItem: function () {
    storageReads += 1;
    throw new Error('localStorage.getItem fue llamado durante la carga');
  },
  setItem: function () {
    storageWrites += 1;
    throw new Error('localStorage.setItem fue llamado durante la carga');
  },
  removeItem: function () {
    storageWrites += 1;
    throw new Error('localStorage.removeItem fue llamado durante la carga');
  }
};

Object.defineProperty(global, 'indexedDB', {
  configurable: true,
  get: function () {
    indexedDbAccesses += 1;
    throw new Error('indexedDB fue consultado durante la carga');
  }
});

test('vault-keys.js se carga sin acceder al almacenamiento', function () {
  const api = require(path.join(root, 'vault-keys.js'));
  assert(api && api.TX && api.VK2 && api.V1, 'La API de claves no está disponible');
});

test('vault-state.js se carga sin leer la bóveda', function () {
  const api = require(path.join(root, 'vault-state.js'));
  assert(
    api && typeof api.detectVaultState === 'function',
    'detectVaultState no está exportada'
  );
});

test('transaction-store.js se carga sin iniciar una transacción', function () {
  const api = require(path.join(root, 'transaction-store.js'));
  assert(
    api && typeof api.beginTransaction === 'function',
    'beginTransaction no está exportada'
  );
});

test('transaction-recovery.js se carga sin ejecutar recuperación', function () {
  const api = require(path.join(root, 'transaction-recovery.js'));
  assert(
    api && typeof api.recoverInterruptedTransaction === 'function',
    'recoverInterruptedTransaction no está exportada'
  );
});

test('la carga no realiza lecturas de localStorage', function () {
  assert(
    storageReads === 0,
    'Se detectaron ' + storageReads + ' lecturas durante la carga'
  );
});

test('la carga no realiza escrituras ni borrados', function () {
  assert(
    storageWrites === 0,
    'Se detectaron ' + storageWrites + ' escrituras o borrados durante la carga'
  );
});

test('la carga no abre ni consulta IndexedDB', function () {
  assert(
    indexedDbAccesses === 0,
    'Se detectaron ' + indexedDbAccesses + ' accesos a IndexedDB'
  );
});

console.log('');
console.log(ok + ' OK, ' + failed + ' FALLOS');

if (failed > 0) {
  process.exitCode = 1;
}