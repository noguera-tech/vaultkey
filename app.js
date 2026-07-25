// Reemplaza la función renderFav() con esto:
function renderFav() {
  const grid = $('favGrid');
  const emptyState = $('favEmptyState');
  
  if (!grid) return;
  
  const favs = vault.filter(e => e.fav);
  
  if (favs.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }
  
  emptyState.style.display = 'none';
  
  grid.innerHTML = favs.map(entry => `
    <div class="vk-r1-list-item vk-r1-list-item--tappable" onclick="openEntry('${entry.id}')">
      <div class="vk-r1-list-item__icon">
        ${vkIcon(entryTypeIcon(entry.type), 'var(--vk-r1-color-secondary)')}
      </div>
      <div class="vk-r1-list-item__content">
        <div class="vk-r1-list-item__title">${esc(entry.service)}</div>
        <div class="vk-r1-list-item__subtitle">${esc(entryTypeLabel(entry.type))}</div>
      </div>
      <div class="vk-r1-list-item__actions">
        <button class="vk-button vk-button--icon" onclick="event.stopPropagation(); copyField(entry, 'user')">
          <svg viewBox="0 0 24 24"><path d="M5.5 13.5A1.5 1.5 0 0 0 4 15v4a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5v-4a1.5 1.5 0 0 0-1.5-1.5h-4zm10 0A1.5 1.5 0 0 0 14 15v4a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5v-4a1.5 1.5 0 0 0-1.5-1.5h-4zm-8.5-8A1.5 1.5 0 0 0 5.5 7h-4A1.5 1.5 0 0 0 0 8.5v4A1.5 1.5 0 0 0 1.5 14h4a1.5 1.5 0 0 0 1.5-1.5v-4zm8.5-1.5A1.5 1.5 0 0 0 14 5.5v-4A1.5 1.5 0 0 0 12.5 0h-4A1.5 1.5 0 0 0 7 1.5v4A1.5 1.5 0 0 0 8.5 7h4z"/></svg>
        </button>
        <button class="vk-button vk-button--icon" onclick="event.stopPropagation(); copyField(entry, 'pass')">
          <svg viewBox="0 0 24 24"><path d="M7 14c1.104 0 2-.896 2-2s-.896-2-2-2-2 .896-2 2 .896 2 2 2zm0 0v6m6-12c1.104 0 2-.896 2-2s-.896-2-2-2-2 .896-2 2 .896 2 2 2zm0 0v6m0 0c1.104 0 2 .896 2 2s-.896 2-2 2-2-.896-2-2 .896-2 2-2zm0 4v2m6-16c1.104 0 2 .896 2 2s-.896 2-2 2-2-.896-2-2 .896-2 2-2zm0 0v6m0 0c1.104 0 2 .896 2 2s-.896 2-2 2-2-.896-2-2 .896-2 2-2zm0 4v6"/></svg>          
        </button>
      </div>
    </div>  
  `).join('');
}
