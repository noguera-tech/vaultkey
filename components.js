/* ============================================================
   VaultKey 2.0 — components.js
   Comportamiento UI mínimo de los componentes base R1
   (Plan Módulo 1 · 1.6 · Commit 2)

   REGLA (decisión 08-07): solo comportamiento UI reutilizable.
   Cero lógica de bóveda, cero Drive, cero localStorage,
   cero datos reales, cero integración con app.js.

   API pública:
     vkSheetOpen(id) / vkSheetClose(id)
     vkDialogOpen(id) / vkDialogClose(id)

   Delegación (sin inicialización necesaria):
     [data-vk-open-sheet="id"]   → abre el Bottom Sheet
     [data-vk-open-dialog="id"]  → abre el diálogo
     [data-vk-close]             → cierra la capa contenedora
     click en scrim              → cierra la capa
     .vk-field__eye              → alterna máscara del input
     .vk-chip                    → selección exclusiva en su .vk-chips
                                   (emite evento 'vk-chip-change')
   ============================================================ */

'use strict';

/* ---------- Capas: Bottom Sheet y Diálogo ---------- */

function vkLayerOpen(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.add('vk-open');
  el.setAttribute('aria-hidden', 'false');
  document.body.classList.add('vk-lock');
}

function vkLayerClose(id) {
  var el = typeof id === 'string' ? document.getElementById(id) : id;
  if (!el) return;
  el.classList.remove('vk-open');
  el.setAttribute('aria-hidden', 'true');
  /* Solo desbloquear el scroll si no queda ninguna capa abierta */
  if (!document.querySelector('.vk-sheet.vk-open, .vk-dialog.vk-open')) {
    document.body.classList.remove('vk-lock');
  }
}

function vkSheetOpen(id)  { vkLayerOpen(id); }
function vkSheetClose(id) { vkLayerClose(id); }
function vkDialogOpen(id)  { vkLayerOpen(id); }
function vkDialogClose(id) { vkLayerClose(id); }

/* ---------- Ojo de campos enmascarados ---------- */

function vkToggleEye(btn) {
  var control = btn.closest('.vk-field__control');
  var input = control ? control.querySelector('.vk-input') : null;
  if (!input) return;
  var show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.setAttribute('aria-label', show ? 'Ocultar' : 'Mostrar');
  var eyeOn = btn.querySelector('.vk-eye-on');
  var eyeOff = btn.querySelector('.vk-eye-off');
  if (eyeOn && eyeOff) {
    eyeOn.style.display = show ? 'none' : '';
    eyeOff.style.display = show ? '' : 'none';
  }
}

/* ---------- Chips: selección exclusiva ---------- */

function vkSelectChip(chip) {
  var group = chip.closest('.vk-chips');
  if (!group) return;
  var chips = group.querySelectorAll('.vk-chip');
  for (var i = 0; i < chips.length; i++) {
    chips[i].classList.toggle('vk-chip--active', chips[i] === chip);
    chips[i].setAttribute('aria-pressed', chips[i] === chip ? 'true' : 'false');
  }
  group.dispatchEvent(new CustomEvent('vk-chip-change', {
    bubbles: true,
    detail: { value: chip.getAttribute('data-vk-value') || chip.textContent.trim() }
  }));
}

/* ---------- Delegación global ---------- */

document.addEventListener('click', function (e) {
  var t;

  /* Abrir sheet / diálogo */
  t = e.target.closest('[data-vk-open-sheet]');
  if (t) { vkSheetOpen(t.getAttribute('data-vk-open-sheet')); return; }

  t = e.target.closest('[data-vk-open-dialog]');
  if (t) { vkDialogOpen(t.getAttribute('data-vk-open-dialog')); return; }

  /* Cerrar: botón explícito o toque en el scrim */
  t = e.target.closest('[data-vk-close]');
  if (t) { vkLayerClose(t.closest('.vk-sheet, .vk-dialog')); return; }

  if (e.target.classList &&
      (e.target.classList.contains('vk-sheet__scrim') ||
       e.target.classList.contains('vk-dialog__scrim'))) {
    vkLayerClose(e.target.closest('.vk-sheet, .vk-dialog'));
    return;
  }

  /* Ojo de campo enmascarado */
  t = e.target.closest('.vk-field__eye');
  if (t) { vkToggleEye(t); return; }

  /* Chips */
  t = e.target.closest('.vk-chip');
  if (t) { vkSelectChip(t); return; }
});

/* Escape cierra la capa superior (comodidad en desarrollo/escritorio) */
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var open = document.querySelectorAll('.vk-sheet.vk-open, .vk-dialog.vk-open');
  if (open.length) vkLayerClose(open[open.length - 1]);
});
