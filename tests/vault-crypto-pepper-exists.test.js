/* Ejecutable desde cualquier directorio:
   node tests/vault-crypto-pepper-exists.test.js */
'use strict';

var path = require('path');

if (!globalThis.crypto) {
  globalThis.crypto = require('crypto').webcrypto;
}

var pass = 0;
var fail = 0;

function t(name, condition) {
  if (condition) {
    pass++;
    console.log('  \u2714 ' + name);
  } else {
    fail++;
    console.log('  \u2718 FALLO: ' + name);
  }
}

function rejects(promise) {
  return promise.then(
    function () { return false; },
    function () { return true; }
  );
}

function createIndexedDBMock(options) {
  options = options || {};

  var stats = {
    modes: [],
    gets: 0,
    puts: 0,
    deletes: 0
  };

  var indexedDB = {
    open: function () {
      var openRequest = {};

      setTimeout(function () {
        if (options.openError) {
          openRequest.error = new Error('open failed');
          if (openRequest.onerror) {
            openRequest.onerror();
          }
          return;
        }

        openRequest.result = {
          transaction: function (storeName, mode) {
            stats.modes.push(mode);

            if (options.transactionError) {
              throw new Error('transaction failed');
            }

            return {
              objectStore: function () {
                return {
                  get: function () {
                    stats.gets++;

                    var getRequest = {};

                    setTimeout(function () {
                      if (options.getError) {
                        getRequest.error = new Error('get failed');
                        if (getRequest.onerror) {
                          getRequest.onerror();
                        }
                        return;
                      }

                      getRequest.result = options.hasPepper
                        ? { type: 'secret', algorithm: { name: 'HKDF' } }
                        : undefined;

                      if (getRequest.onsuccess) {
                        getRequest.onsuccess();
                      }
                    }, 0);

                    return getRequest;
                  },

                  put: function () {
                    stats.puts++;
                  },

                  delete: function () {
                    stats.deletes++;
                  }
                };
              }
            };
          }
        };

        if (openRequest.onsuccess) {
          openRequest.onsuccess();
        }
      }, 0);

      return openRequest;
    }
  };

  return {
    indexedDB: indexedDB,
    stats: stats
  };
}

globalThis.indexedDB = createIndexedDBMock().indexedDB;

var vkCrypto = require(
  path.join(__dirname, '..', 'vault-crypto.js')
);

(async function () {
  console.log('== API pública ==');

  t(
    'pepperExists está exportada',
    typeof vkCrypto.pepperExists === 'function'
  );

  console.log('== Pepper existente ==');

  var existing = createIndexedDBMock({ hasPepper: true });
  globalThis.indexedDB = existing.indexedDB;

  var existsResult = await vkCrypto.pepperExists();

  t('devuelve true cuando existe', existsResult === true);
  t(
    'usa una transacción readonly',
    existing.stats.modes.length === 1 &&
      existing.stats.modes[0] === 'readonly'
  );
  t('consulta exactamente una vez', existing.stats.gets === 1);
  t(
    'no escribe ni borra',
    existing.stats.puts === 0 &&
      existing.stats.deletes === 0
  );

  console.log('== Pepper ausente ==');

  var missing = createIndexedDBMock({ hasPepper: false });
  globalThis.indexedDB = missing.indexedDB;

  var missingResult = await vkCrypto.pepperExists();

  t('devuelve false cuando no existe', missingResult === false);
  t(
    'la comprobación ausente también es readonly',
    missing.stats.modes.length === 1 &&
      missing.stats.modes[0] === 'readonly'
  );
  t(
    'no crea un pepper al comprobar ausencia',
    missing.stats.puts === 0 &&
      missing.stats.deletes === 0
  );

  console.log('== Errores técnicos ==');

  var openFailure = createIndexedDBMock({ openError: true });
  globalThis.indexedDB = openFailure.indexedDB;

  t(
    'rechaza cuando falla indexedDB.open',
    await rejects(vkCrypto.pepperExists())
  );

  var getFailure = createIndexedDBMock({ getError: true });
  globalThis.indexedDB = getFailure.indexedDB;

  t(
    'rechaza cuando falla la lectura',
    await rejects(vkCrypto.pepperExists())
  );

  var transactionFailure = createIndexedDBMock({
    transactionError: true
  });
  globalThis.indexedDB = transactionFailure.indexedDB;

  t(
    'rechaza cuando no puede crear la transacción readonly',
    await rejects(vkCrypto.pepperExists())
  );

  console.log('\n' + pass + ' OK, ' + fail + ' FALLOS');
  process.exit(fail > 0 ? 1 : 0);
})().catch(function (err) {
  console.error('FALLO NO CONTROLADO:', err);
  process.exit(1);
});
