/* Offlined — barra lateral común de los addons de oficina (Documento de texto,
 * Pizarra, Hoja de cálculo, Notas de audio). MIT.
 *
 * El MISMO archivo va copiado en los cuatro addons (cada addon tiene que
 * funcionar solo); si lo cambias, cópialo a los otros tres.
 *
 * Diseño igual que la barra de conversaciones del chat de Offlined: cabecera
 * con plegar, «Nuevo…» como fila plana, buscador + orden en una línea,
 * Fijados → Carpetas (plegables) → resto agrupado por fecha, filas de una
 * línea con los detalles en el tooltip y menú «…» por fila. Lo activo se
 * marca solo con color, sin sombras en los botones.
 *
 * Fijados y carpetas se guardan en el almacenamiento propio del addon
 * (/api/addons/<id>/storage), separados por usuario de Offlined:
 *   { version: 2, users: { <uid>: { pinned: [id], folders: [{id, name, collapsed}],
 *                                   placement: { itemId: folderId }, extra: {} } } }
 *
 * Uso:
 *   const sb = OflSidebar.create({ host, before, addonId, lang, strings, ...callbacks });
 *   await sb.ready;  sb.setItems([{ id, title, time, snippet, info, badge }]);
 */
(function () {
  "use strict";

  const I18N = {
    en: { collapse:"Hide sidebar", expand:"Show sidebar", sortRecent:"Recent", sortAZ:"A–Z", pinned:"Pinned",
          folders:"Folders", today:"Today", yesterday:"Yesterday", last7:"Previous 7 days", last30:"Previous 30 days",
          noDate:"No date", newFolder:"New folder", folderNamePh:"Folder name", create:"Create", rename:"Rename",
          pin:"Pin", unpin:"Unpin", moveTo:"Move to folder", noFolder:"No folder", back:"Back", del:"Delete",
          duplicate:"Duplicate", deleteFolder:"Delete folder", deleteFolderTitle:"Delete folder?",
          deleteFolderMsg:'What is inside "{name}" is not deleted: it moves to "No folder".',
          noResults:"No results.", folderEmpty:"Empty folder", modified:"Modified {date}", unsaved:"Unsaved changes",
          more:"More actions", cancel:"Cancel", ok:"OK", movedToast:'Moved to "{name}"', nameTaken:"That name is already in use." },
    es: { collapse:"Ocultar barra lateral", expand:"Mostrar barra lateral", sortRecent:"Recientes", sortAZ:"A–Z", pinned:"Fijados",
          folders:"Carpetas", today:"Hoy", yesterday:"Ayer", last7:"Últimos 7 días", last30:"Últimos 30 días",
          noDate:"Sin fecha", newFolder:"Nueva carpeta", folderNamePh:"Nombre de la carpeta", create:"Crear", rename:"Renombrar",
          pin:"Fijar", unpin:"Quitar de fijados", moveTo:"Mover a carpeta", noFolder:"Sin carpeta", back:"Atrás", del:"Eliminar",
          duplicate:"Duplicar", deleteFolder:"Eliminar carpeta", deleteFolderTitle:"¿Eliminar carpeta?",
          deleteFolderMsg:"Lo que hay en «{name}» no se borra: pasa a «Sin carpeta».",
          noResults:"Sin resultados.", folderEmpty:"Carpeta vacía", modified:"Modificado: {date}", unsaved:"Cambios sin guardar",
          more:"Más acciones", cancel:"Cancelar", ok:"Aceptar", movedToast:"Movido a «{name}»", nameTaken:"Ese nombre ya está en uso." },
    fr: { collapse:"Masquer la barre latérale", expand:"Afficher la barre latérale", sortRecent:"Récents", sortAZ:"A–Z", pinned:"Épinglés",
          folders:"Dossiers", today:"Aujourd'hui", yesterday:"Hier", last7:"7 derniers jours", last30:"30 derniers jours",
          noDate:"Sans date", newFolder:"Nouveau dossier", folderNamePh:"Nom du dossier", create:"Créer", rename:"Renommer",
          pin:"Épingler", unpin:"Désépingler", moveTo:"Déplacer vers un dossier", noFolder:"Sans dossier", back:"Retour", del:"Supprimer",
          duplicate:"Dupliquer", deleteFolder:"Supprimer le dossier", deleteFolderTitle:"Supprimer le dossier ?",
          deleteFolderMsg:"Le contenu de « {name} » n'est pas supprimé : il passe dans « Sans dossier ».",
          noResults:"Aucun résultat.", folderEmpty:"Dossier vide", modified:"Modifié : {date}", unsaved:"Modifications non enregistrées",
          more:"Plus d'actions", cancel:"Annuler", ok:"OK", movedToast:"Déplacé vers « {name} »", nameTaken:"Ce nom est déjà utilisé." },
    pt: { collapse:"Ocultar barra lateral", expand:"Mostrar barra lateral", sortRecent:"Recentes", sortAZ:"A–Z", pinned:"Fixados",
          folders:"Pastas", today:"Hoje", yesterday:"Ontem", last7:"Últimos 7 dias", last30:"Últimos 30 dias",
          noDate:"Sem data", newFolder:"Nova pasta", folderNamePh:"Nome da pasta", create:"Criar", rename:"Mudar o nome",
          pin:"Fixar", unpin:"Desafixar", moveTo:"Mover para pasta", noFolder:"Sem pasta", back:"Voltar", del:"Eliminar",
          duplicate:"Duplicar", deleteFolder:"Eliminar pasta", deleteFolderTitle:"Eliminar pasta?",
          deleteFolderMsg:"O que está em «{name}» não é eliminado: passa para «Sem pasta».",
          noResults:"Sem resultados.", folderEmpty:"Pasta vazia", modified:"Modificado: {date}", unsaved:"Alterações não guardadas",
          more:"Mais ações", cancel:"Cancelar", ok:"OK", movedToast:"Movido para «{name}»", nameTaken:"Esse nome já está a ser usado." },
    it: { collapse:"Nascondi barra laterale", expand:"Mostra barra laterale", sortRecent:"Recenti", sortAZ:"A–Z", pinned:"Fissati",
          folders:"Cartelle", today:"Oggi", yesterday:"Ieri", last7:"Ultimi 7 giorni", last30:"Ultimi 30 giorni",
          noDate:"Senza data", newFolder:"Nuova cartella", folderNamePh:"Nome della cartella", create:"Crea", rename:"Rinomina",
          pin:"Fissa", unpin:"Rimuovi dai fissati", moveTo:"Sposta in cartella", noFolder:"Senza cartella", back:"Indietro", del:"Elimina",
          duplicate:"Duplica", deleteFolder:"Elimina cartella", deleteFolderTitle:"Eliminare la cartella?",
          deleteFolderMsg:"Il contenuto di «{name}» non viene eliminato: passa a «Senza cartella».",
          noResults:"Nessun risultato.", folderEmpty:"Cartella vuota", modified:"Modificato: {date}", unsaved:"Modifiche non salvate",
          more:"Altre azioni", cancel:"Annulla", ok:"OK", movedToast:"Spostato in «{name}»", nameTaken:"Questo nome è già in uso." },
    de: { collapse:"Seitenleiste ausblenden", expand:"Seitenleiste einblenden", sortRecent:"Neueste", sortAZ:"A–Z", pinned:"Angeheftet",
          folders:"Ordner", today:"Heute", yesterday:"Gestern", last7:"Letzte 7 Tage", last30:"Letzte 30 Tage",
          noDate:"Ohne Datum", newFolder:"Neuer Ordner", folderNamePh:"Ordnername", create:"Erstellen", rename:"Umbenennen",
          pin:"Anheften", unpin:"Lösen", moveTo:"In Ordner verschieben", noFolder:"Kein Ordner", back:"Zurück", del:"Löschen",
          duplicate:"Duplizieren", deleteFolder:"Ordner löschen", deleteFolderTitle:"Ordner löschen?",
          deleteFolderMsg:"Der Inhalt von „{name}“ wird nicht gelöscht: Er kommt nach „Kein Ordner“.",
          noResults:"Keine Ergebnisse.", folderEmpty:"Leerer Ordner", modified:"Geändert: {date}", unsaved:"Nicht gespeicherte Änderungen",
          more:"Weitere Aktionen", cancel:"Abbrechen", ok:"OK", movedToast:"Verschoben nach „{name}“", nameTaken:"Dieser Name wird bereits verwendet." },
    zh: { collapse:"隐藏侧边栏", expand:"显示侧边栏", sortRecent:"最近", sortAZ:"A–Z", pinned:"已置顶",
          folders:"文件夹", today:"今天", yesterday:"昨天", last7:"过去 7 天", last30:"过去 30 天",
          noDate:"无日期", newFolder:"新建文件夹", folderNamePh:"文件夹名称", create:"创建", rename:"重命名",
          pin:"置顶", unpin:"取消置顶", moveTo:"移动到文件夹", noFolder:"无文件夹", back:"返回", del:"删除",
          duplicate:"复制", deleteFolder:"删除文件夹", deleteFolderTitle:"删除文件夹？",
          deleteFolderMsg:"“{name}”中的内容不会被删除，而是移到“无文件夹”。",
          noResults:"无结果。", folderEmpty:"空文件夹", modified:"修改于 {date}", unsaved:"未保存的更改",
          more:"更多操作", cancel:"取消", ok:"确定", movedToast:"已移动到“{name}”", nameTaken:"该名称已被使用。" },
    hi: { collapse:"साइडबार छिपाएँ", expand:"साइडबार दिखाएँ", sortRecent:"हाल के", sortAZ:"A–Z", pinned:"पिन किए गए",
          folders:"फ़ोल्डर", today:"आज", yesterday:"कल", last7:"पिछले 7 दिन", last30:"पिछले 30 दिन",
          noDate:"कोई तारीख नहीं", newFolder:"नया फ़ोल्डर", folderNamePh:"फ़ोल्डर का नाम", create:"बनाएँ", rename:"नाम बदलें",
          pin:"पिन करें", unpin:"पिन हटाएँ", moveTo:"फ़ोल्डर में ले जाएँ", noFolder:"कोई फ़ोल्डर नहीं", back:"वापस", del:"हटाएँ",
          duplicate:"डुप्लिकेट करें", deleteFolder:"फ़ोल्डर हटाएँ", deleteFolderTitle:"फ़ोल्डर हटाएँ?",
          deleteFolderMsg:'"{name}" के अंदर की चीज़ें हटाई नहीं जातीं: वे "कोई फ़ोल्डर नहीं" में चली जाती हैं।',
          noResults:"कोई परिणाम नहीं।", folderEmpty:"खाली फ़ोल्डर", modified:"संशोधित: {date}", unsaved:"असहेजे परिवर्तन",
          more:"और क्रियाएँ", cancel:"रद्द करें", ok:"ठीक है", movedToast:'"{name}" में ले जाया गया', nameTaken:"यह नाम पहले से उपयोग में है।" },
    ar: { collapse:"إخفاء الشريط الجانبي", expand:"إظهار الشريط الجانبي", sortRecent:"الأحدث", sortAZ:"أ–ي", pinned:"المثبّتة",
          folders:"المجلدات", today:"اليوم", yesterday:"أمس", last7:"آخر 7 أيام", last30:"آخر 30 يومًا",
          noDate:"بلا تاريخ", newFolder:"مجلد جديد", folderNamePh:"اسم المجلد", create:"إنشاء", rename:"إعادة التسمية",
          pin:"تثبيت", unpin:"إلغاء التثبيت", moveTo:"نقل إلى مجلد", noFolder:"بلا مجلد", back:"رجوع", del:"حذف",
          duplicate:"تكرار", deleteFolder:"حذف المجلد", deleteFolderTitle:"حذف المجلد؟",
          deleteFolderMsg:"لن يُحذف ما في «{name}»: سينتقل إلى «بلا مجلد».",
          noResults:"لا توجد نتائج.", folderEmpty:"مجلد فارغ", modified:"تم التعديل: {date}", unsaved:"تغييرات غير محفوظة",
          more:"إجراءات أخرى", cancel:"إلغاء", ok:"موافق", movedToast:"نُقل إلى «{name}»", nameTaken:"هذا الاسم مستخدم بالفعل." },
    ru: { collapse:"Скрыть боковую панель", expand:"Показать боковую панель", sortRecent:"Недавние", sortAZ:"А–Я", pinned:"Закреплённые",
          folders:"Папки", today:"Сегодня", yesterday:"Вчера", last7:"Последние 7 дней", last30:"Последние 30 дней",
          noDate:"Без даты", newFolder:"Новая папка", folderNamePh:"Название папки", create:"Создать", rename:"Переименовать",
          pin:"Закрепить", unpin:"Открепить", moveTo:"Переместить в папку", noFolder:"Без папки", back:"Назад", del:"Удалить",
          duplicate:"Дублировать", deleteFolder:"Удалить папку", deleteFolderTitle:"Удалить папку?",
          deleteFolderMsg:"Содержимое «{name}» не удаляется: оно переходит в «Без папки».",
          noResults:"Ничего не найдено.", folderEmpty:"Пустая папка", modified:"Изменено: {date}", unsaved:"Несохранённые изменения",
          more:"Другие действия", cancel:"Отмена", ok:"ОК", movedToast:"Перемещено в «{name}»", nameTaken:"Это имя уже занято." },
  };

  // Trazos de Lucide (ISC), incrustados: no depende del sprite de Offlined.
  const ICONS = {
    "panel-left-close": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/>',
    "panel-left-open":  '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/>',
    "square-pen": '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
    "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    "folder": '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    "folder-open": '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
    "folder-plus": '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    "folder-input": '<path d="M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1"/><path d="M2 13h10"/><path d="m9 16 3-3-3-3"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "ellipsis": '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    "pin": '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    "pin-off": '<path d="M12 17v5"/><path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"/><path d="m2 2 20 20"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/>',
    "pencil": '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    "copy": '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    "volume-2": '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
    "map-pin": '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    "trash-2": '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    "file-text": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    "file-code": '<path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>',
    "save": '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    "image": '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    "calendar-plus": '<path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/>',
    "play": '<polygon points="6 3 20 12 6 21 6 3"/>',
    "pause": '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    "mic": '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    "sheet": '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="3" x2="21" y1="15" y2="15"/><line x1="9" x2="9" y1="9" y2="21"/><line x1="15" x2="15" y1="9" y2="21"/>',
    "plus": '<path d="M5 12h14"/><path d="M12 5v14"/>',
  };
  function ic(name, cls) { return `<svg class="ofs-ic ${cls || ""}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`; }
  function hydrateIcons(root) {
    (root || document).querySelectorAll("[data-ic]").forEach(el => {
      const name = el.getAttribute("data-ic");
      if (el.tagName.toLowerCase() === "svg") {
        el.setAttribute("viewBox", "0 0 24 24"); el.setAttribute("aria-hidden", "true");
        el.classList.add("ofs-ic");
        el.innerHTML = ICONS[name] || "";
      } else el.innerHTML = ic(name);
      el.removeAttribute("data-ic");
    });
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch])); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  const STYLES = `
.ofs-ic { width: 18px; height: 18px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ofs-root {
  --ofs-line: var(--muted); --ofs-subtle: var(--subtle); --ofs-danger: #d93d42;
  --ofs-hover: color-mix(in srgb, var(--ink) 6%, transparent);
  --ofs-active: color-mix(in srgb, var(--ink) 11%, transparent);
}
[data-theme="dark"] .ofs-root, [data-theme="dark"] .ofs-layer { --ofs-danger: #ff6369; }
.ofs-sidebar {
  width: 264px; flex: 0 0 264px; display: flex; flex-direction: column; min-width: 0; min-height: 0;
  background: var(--bg); border-inline-end: 1px solid var(--ofs-line); color: var(--ink);
  transition: width .15s ease, flex-basis .15s ease; font-size: 14px;
}
.ofs-sidebar.collapsed { width: 0; flex-basis: 0; border-inline-end: none; overflow: hidden; }
.ofs-icon-btn {
  flex: 0 0 auto; width: 32px; height: 32px; padding: 0; margin: 0; border-radius: 8px; border: none;
  background: transparent; color: var(--ofs-subtle); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.ofs-icon-btn:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink); }
[dir="rtl"] .ofs-flip .ofs-ic { transform: scaleX(-1); }
.ofs-rail {
  flex: 0 0 52px; width: 52px; display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 0; background: var(--bg); border-inline-end: 1px solid var(--ofs-line);
}
.ofs-rail.hidden { display: none; }
.ofs-backdrop { display: none; }
.ofs-head { display: flex; align-items: center; justify-content: space-between; gap: 4px; padding-block: 10px 4px; padding-inline: 16px 8px; flex: 0 0 auto; }
.ofs-heading { font-size: .92rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ofs-head-actions { display: flex; gap: 2px; }
.ofs-new-btn {
  flex: 0 0 auto; display: flex; align-items: center; gap: 10px; margin: 2px 8px 6px; padding: 8px 10px;
  border-radius: 8px; border: none; background: transparent; color: var(--ink); cursor: pointer;
  font: inherit; font-size: .86rem; font-weight: 600; text-align: start;
}
.ofs-new-btn .ofs-ic { width: 17px; height: 17px; }
.ofs-new-btn:hover { background: var(--ofs-hover); }
.ofs-search-wrap {
  flex: 0 0 auto; display: flex; align-items: center; gap: 6px; margin: 0 8px 6px; padding-inline: 10px 4px;
  height: 34px; border-radius: 8px; background: var(--ofs-hover); border: 1px solid transparent;
}
.ofs-search-wrap:focus-within { border-color: var(--ofs-line); background: var(--panel); }
.ofs-search-wrap > .ofs-ic { width: 15px; height: 15px; color: var(--ofs-subtle); }
.ofs-search {
  flex: 1; min-width: 0; height: 100%; padding: 0; margin: 0; border: none; outline: none; background: transparent;
  color: var(--ink); font: inherit; font-size: .84rem;
}
.ofs-search::placeholder { color: var(--ofs-subtle); }
.ofs-sort {
  flex: 0 1 auto; max-width: 42%; height: 26px; margin: 0; padding-inline: 8px 4px;
  border: none; border-inline-start: 1px solid var(--ofs-line); border-radius: 0; background: transparent;
  color: var(--ofs-subtle); font: inherit; font-size: .76rem; cursor: pointer; text-overflow: ellipsis;
}
.ofs-sort:hover { color: var(--ink); }
.ofs-sort option { background: var(--panel); color: var(--ink); }
.ofs-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 10px; }
.ofs-list.drop-root { background: color-mix(in srgb, var(--ink) 3%, transparent); }
.ofs-section-title { padding: 14px 10px 4px; font-size: .72rem; font-weight: 600; color: var(--ofs-subtle); user-select: none; }
.ofs-section-title:first-child { padding-top: 6px; }
.ofs-folder {
  position: relative; display: flex; align-items: center; gap: 9px; min-height: 32px; padding-inline: 10px 4px;
  border-radius: 8px; cursor: pointer; font-size: .84rem; color: var(--ink); user-select: none;
}
.ofs-folder:hover { background: var(--ofs-hover); }
.ofs-folder > .ofs-ic { width: 16px; height: 16px; color: var(--ofs-subtle); }
.ofs-folder-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ofs-folder-count { font-size: .72rem; color: var(--ofs-subtle); }
.ofs-folder .ofs-caret { width: 14px; height: 14px; color: var(--ofs-subtle); transition: transform .12s ease; }
.ofs-folder.collapsed .ofs-caret { transform: rotate(-90deg); }
[dir="rtl"] .ofs-folder.collapsed .ofs-caret { transform: rotate(90deg); }
.ofs-folder-body { padding-inline-start: 6px; margin-inline-start: 17px; border-inline-start: 1px solid var(--ofs-line); }
.ofs-folder-empty { padding: 6px 10px; font-size: .76rem; color: var(--ofs-subtle); }
.ofs-drop-target { background: var(--ofs-active) !important; outline: 1px dashed var(--ofs-subtle); outline-offset: -1px; }
.ofs-item {
  position: relative; display: flex; align-items: center; gap: 8px; min-height: 34px; padding-inline: 10px 4px;
  border-radius: 8px; cursor: pointer; font-size: .85rem; color: var(--ink);
}
.ofs-item:hover { background: var(--ofs-hover); }
.ofs-item.active { background: var(--ofs-active); font-weight: 600; }
.ofs-item.dragging { opacity: .4; }
.ofs-item-title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ofs-badge { flex: 0 0 auto; font-size: .72rem; font-weight: 400; color: var(--ofs-subtle); font-variant-numeric: tabular-nums; }
.ofs-dot { display: none; width: 7px; height: 7px; border-radius: 50%; background: var(--ofs-subtle); flex: 0 0 auto; }
.ofs-item.dirty .ofs-dot { display: inline-block; }
.ofs-row-btn {
  flex: 0 0 auto; width: 26px; height: 26px; padding: 0; margin: 0; border: none; border-radius: 6px;
  background: transparent; color: var(--ofs-subtle); cursor: pointer; opacity: 0;
  display: flex; align-items: center; justify-content: center;
}
.ofs-row-btn .ofs-ic { width: 16px; height: 16px; }
.ofs-row-btn.ofs-act .ofs-ic { width: 14px; height: 14px; }
.ofs-item:hover .ofs-row-btn, .ofs-item.active .ofs-row-btn, .ofs-item:focus-within .ofs-row-btn,
.ofs-folder:hover .ofs-row-btn, .ofs-folder:focus-within .ofs-row-btn, .ofs-row-btn.open, .ofs-row-btn.on { opacity: 1; }
.ofs-item:hover .ofs-badge, .ofs-item:focus-within .ofs-badge, .ofs-item.active .ofs-badge { display: none; }
.ofs-item.has-badge:not(:hover):not(:focus-within):not(.active) .ofs-row-btn:not(.open):not(.on) { display: none; }
.ofs-item.has-badge { padding-inline-end: 10px; }
.ofs-item.has-badge:hover, .ofs-item.has-badge:focus-within, .ofs-item.has-badge.active { padding-inline-end: 4px; }
.ofs-row-btn:hover, .ofs-row-btn.open { background: var(--ofs-active); color: var(--ink); }
@media (hover: none) { .ofs-row-btn { opacity: 1; } }
.ofs-item:focus-visible, .ofs-folder:focus-visible, .ofs-new-btn:focus-visible, .ofs-icon-btn:focus-visible, .ofs-row-btn:focus-visible {
  outline: 2px solid var(--ofs-subtle); outline-offset: -2px;
}
.ofs-rename-input {
  flex: 1; min-width: 0; font: inherit; font-weight: 400; color: inherit; background: var(--panel);
  border: 1px solid var(--ofs-subtle); border-radius: 5px; padding: 1px 4px; margin: 0; outline: none;
}
.ofs-empty { padding: 20px 16px; text-align: center; font-size: .8rem; color: var(--ofs-subtle); }
.ofs-menu {
  position: fixed; z-index: 400; min-width: 200px; max-width: 290px; padding: 6px; border-radius: 10px;
  background: var(--panel); color: var(--ink); border: 1px solid var(--ofs-line); box-shadow: 0 8px 28px rgba(0,0,0,.28);
  font-size: 14px;
}
.ofs-menu-item {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; margin: 0;
  border: none; background: transparent; color: inherit; text-align: start; border-radius: 7px;
  cursor: pointer; font: inherit; font-size: .84rem;
}
.ofs-menu-item .ofs-ic { width: 16px; height: 16px; }
.ofs-menu-item span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ofs-menu-item:hover, .ofs-menu-item:focus-visible { background: color-mix(in srgb, var(--ink) 7%, transparent); outline: none; }
.ofs-menu-item.current { color: var(--ofs-subtle); cursor: default; }
.ofs-menu-item.current:hover { background: transparent; }
.ofs-menu-item.danger { color: var(--ofs-danger); }
.ofs-menu-sep { height: 1px; margin: 5px 4px; background: var(--ofs-line); }
.ofs-menu-scroll { max-height: 220px; overflow-y: auto; }
.ofs-menu-back { color: var(--ofs-subtle); font-size: .78rem; }
.ofs-preview {
  position: fixed; z-index: 390; width: 240px; padding: 6px; border-radius: 10px; pointer-events: none;
  background: var(--panel); border: 1px solid var(--ofs-line); box-shadow: 0 8px 28px rgba(0,0,0,.28);
}
.ofs-preview img { display: block; width: 100%; max-height: 180px; object-fit: contain; border-radius: 6px; background: #fff; }
.ofs-preview div { padding: 6px 4px 2px; font-size: .78rem; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ofs-dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; z-index: 450; }
.ofs-dialog { background: var(--panel); color: var(--ink); border-radius: 12px; padding: 18px; width: min(340px, calc(100vw - 32px)); box-shadow: 0 10px 30px rgba(0,0,0,.25); font-size: 14px; }
.ofs-dialog-title { font-weight: 700; margin: 0 0 6px; }
.ofs-dialog-msg { margin: 0 0 16px; color: var(--ofs-subtle); font-size: .88rem; }
.ofs-dialog-input {
  width: 100%; box-sizing: border-box; margin: 4px 0 16px; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--ofs-line);
  background: var(--bg); color: var(--ink); font: inherit; font-size: .9rem; outline: none;
}
.ofs-dialog-input:focus { border-color: var(--ofs-subtle); }
.ofs-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
.ofs-dialog-btn {
  padding: 6px 14px; margin: 0; border-radius: 8px; border: 1px solid var(--ofs-line); background: var(--soft);
  color: var(--ink); font: inherit; font-size: .84rem; cursor: pointer;
}
.ofs-dialog-btn:hover { background: color-mix(in srgb, var(--ink) 10%, var(--soft)); }
.ofs-dialog-btn.primary { font-weight: 600; }
.ofs-dialog-btn.danger { color: var(--ofs-danger); font-weight: 600; }
@media (max-width: 880px) {
  .ofs-sidebar { position: absolute; inset-block: 0; inset-inline-start: 0; z-index: 60; width: min(300px, 86vw); flex-basis: auto; box-shadow: 4px 0 16px rgba(0,0,0,.25); }
  .ofs-sidebar.collapsed { box-shadow: none; }
  .ofs-sidebar:not(.collapsed) ~ .ofs-backdrop { display: block; position: absolute; inset: 0; z-index: 59; background: rgba(0,0,0,.35); }
  .ofs-rail { flex-basis: 44px; width: 44px; }
}`;
  function injectCSS() {
    if (document.getElementById("ofs-style")) return;
    const st = document.createElement("style");
    st.id = "ofs-style"; st.textContent = STYLES;
    document.head.append(st);
  }

  function langOf(lang) {
    const l = String(lang || "en").slice(0, 2).toLowerCase();
    return I18N[l] ? l : "en";
  }

  // ── Diálogos (confirmar / pedir un nombre), también para el resto del addon ──
  function dialog({ lang, title, message, confirmLabel, cancelLabel, danger, input }) {
    const L = langOf(lang || document.documentElement.lang);
    const tt = k => I18N[L][k] || I18N.en[k];
    return new Promise(resolve => {
      const ov = document.createElement("div");
      ov.className = "ofs-dialog-overlay ofs-root ofs-layer";
      const card = document.createElement("div");
      card.className = "ofs-dialog"; card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true");
      const h = document.createElement("p"); h.className = "ofs-dialog-title"; h.textContent = title || "";
      card.append(h);
      if (message) { const m = document.createElement("p"); m.className = "ofs-dialog-msg"; m.textContent = message; card.append(m); }
      let inp = null;
      if (input) {
        inp = document.createElement("input");
        inp.className = "ofs-dialog-input"; inp.type = "text"; inp.maxLength = input.maxLength || 120;
        inp.placeholder = input.placeholder || ""; inp.value = input.value || "";
        card.append(inp);
      }
      const acts = document.createElement("div"); acts.className = "ofs-dialog-actions";
      const cancel = document.createElement("button"); cancel.className = "ofs-dialog-btn"; cancel.textContent = cancelLabel || tt("cancel");
      const ok = document.createElement("button"); ok.className = "ofs-dialog-btn " + (danger ? "danger" : "primary"); ok.textContent = confirmLabel || tt("ok");
      if (cancelLabel !== false) acts.append(cancel);
      acts.append(ok); card.append(acts); ov.append(card); document.body.append(ov);
      const close = v => { ov.remove(); document.removeEventListener("keydown", onKey, true); resolve(v); };
      const doOk = () => {
        if (inp && !inp.value.trim()) { inp.focus(); return; }
        close(inp ? inp.value.trim() : true);
      };
      const onKey = e => {
        if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close(inp ? null : false); }
        else if (e.key === "Enter" && (inp ? document.activeElement === inp : true)) { e.preventDefault(); e.stopPropagation(); doOk(); }
      };
      document.addEventListener("keydown", onKey, true);
      ov.addEventListener("click", e => { if (e.target === ov) close(inp ? null : false); });
      cancel.addEventListener("click", () => close(inp ? null : false));
      ok.addEventListener("click", doOk);
      if (inp) { inp.focus(); inp.select(); } else ok.focus();
    });
  }

  function create(cfg) {
    injectCSS();
    const L = langOf(cfg.lang);
    const S = Object.assign({}, cfg.strings || {});
    const t = k => S[k] || I18N[L][k] || I18N.en[k] || k;
    const tf = (k, p) => { let s = t(k); for (const x in (p || {})) s = s.replace(`{${x}}`, p[x]); return s; };
    const RTL = () => document.documentElement.getAttribute("dir") === "rtl";
    const MQ = window.matchMedia("(max-width: 880px)");
    const PREF = `ofs.${cfg.addonId}.`;
    const STORE = `/api/addons/${encodeURIComponent(cfg.addonId)}/storage`;
    const toast = cfg.toast || (() => {});

    const host = cfg.host;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.classList.add("ofs-root");

    // ── DOM ──
    const rail = document.createElement("nav");
    rail.className = "ofs-rail hidden";
    rail.innerHTML = `<button class="ofs-icon-btn ofs-flip" data-k="expand" data-ic="panel-left-open"></button>
      <button class="ofs-icon-btn" data-k="new" data-ic="${cfg.newIcon || "square-pen"}"></button>
      <button class="ofs-icon-btn" data-k="search" data-ic="search"></button>`;
    const aside = document.createElement("aside");
    aside.className = "ofs-sidebar";
    aside.innerHTML = `<div class="ofs-head"><span class="ofs-heading"></span><div class="ofs-head-actions">
        <button class="ofs-icon-btn" data-k="folder" data-ic="folder-plus"></button>
        <button class="ofs-icon-btn ofs-flip" data-k="collapse" data-ic="panel-left-close"></button></div></div>
      <button class="ofs-new-btn"><svg data-ic="${cfg.newIcon || "square-pen"}"></svg><span></span></button>
      <div class="ofs-search-wrap"><svg data-ic="search"></svg><input class="ofs-search" type="search" autocomplete="off" spellcheck="false"><select class="ofs-sort"></select></div>
      <div class="ofs-list" role="tree"></div>`;
    const backdrop = document.createElement("div");
    backdrop.className = "ofs-backdrop";
    const before = cfg.before || host.firstChild;
    host.insertBefore(rail, before); host.insertBefore(aside, before); host.insertBefore(backdrop, before);
    hydrateIcons(rail); hydrateIcons(aside);

    const $ = sel => aside.querySelector(sel);
    const list = $(".ofs-list"), search = $(".ofs-search"), sortSel = $(".ofs-sort");
    $(".ofs-heading").textContent = t("heading");
    $(".ofs-new-btn span").textContent = t("newItem");
    search.placeholder = t("searchPh");
    sortSel.innerHTML = `<option value="recent">${esc(t("sortRecent"))}</option><option value="az">${esc(t("sortAZ"))}</option>`;
    const tip = (el, k) => { el.title = t(k); el.setAttribute("aria-label", t(k)); };
    tip($('[data-k="folder"]'), "newFolder"); tip($('[data-k="collapse"]'), "collapse");
    tip(rail.querySelector('[data-k="expand"]'), "expand"); tip(rail.querySelector('[data-k="new"]'), "newItem");
    tip(rail.querySelector('[data-k="search"]'), "searchPh");

    // ── Estado ──
    const st = {
      items: [], activeId: null, dirty: false, q: "",
      sort: lsGet(PREF + "sort") === "az" ? "az" : "recent",
    };
    sortSel.value = st.sort;
    let all = { version: 2, users: {} };
    let uid = "_";
    let meta = { pinned: [], folders: [], placement: {}, extra: {} };
    let loaded = false;

    function normMeta(d) {
      d = d || {};
      return {
        pinned: Array.isArray(d.pinned) ? d.pinned.map(String) : [],
        folders: Array.isArray(d.folders)
          ? d.folders.filter(f => f && f.id && f.name).map(f => ({ id: String(f.id), name: String(f.name), collapsed: !!f.collapsed }))
          : [],
        placement: (d.placement && typeof d.placement === "object") ? Object.assign({}, d.placement) : {},
        extra: (d.extra && typeof d.extra === "object") ? Object.assign({}, d.extra) : {},
      };
    }
    async function loadMeta() {
      try {
        const s = await (await fetch("/api/users/session", { cache: "no-store" })).json();
        const id = s && (s.active || s.last_user);
        if (id) uid = String(id);
      } catch (_) { /* fuera de Offlined o sin usuarios: un solo cajón */ }
      try {
        const r = await fetch(STORE, { cache: "no-store" });
        if (r.ok) {
          const d = (await r.json())?.data || {};
          if (d.users && typeof d.users === "object") all = { version: 2, users: d.users };
          else if (d.pinned || d.folders || d.placement) {           // versión 1 (sin usuarios): pasa al usuario actual
            all = { version: 2, users: { [uid]: d } };
            loaded = true; saveMeta();
          }
        }
      } catch (e) { console.warn("[sidebar] No se pudo leer:", e); }
      meta = normMeta(all.users[uid]);
      loaded = true;
    }
    let saveT = null;
    function saveMeta() {
      if (!loaded) return;
      all.users[uid] = meta;
      clearTimeout(saveT);
      saveT = setTimeout(async () => {
        try {
          await fetch(STORE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: all }) });
        } catch (e) { console.warn("[sidebar] No se pudo guardar:", e); }
      }, 250);
    }
    function prune() {
      // Lista vacía = puede que el backend no haya respondido: no se borra nada.
      if (!st.items.length) return;
      const ids = new Set(st.items.map(n => n.id));
      const fids = new Set(meta.folders.map(f => f.id));
      let ch = false;
      const p = meta.pinned.filter(id => ids.has(id));
      if (p.length !== meta.pinned.length) { meta.pinned = p; ch = true; }
      for (const id of Object.keys(meta.placement)) {
        if (!ids.has(id) || !fids.has(meta.placement[id])) { delete meta.placement[id]; ch = true; }
      }
      if (ch) saveMeta();
    }
    const isPinned = id => meta.pinned.includes(id);
    const folderOf = id => meta.placement[id] || null;
    const folderById = fid => meta.folders.find(f => f.id === fid);
    const itemById = id => st.items.find(n => n.id === id);
    const cmpName = (a, b) => String(a).localeCompare(String(b), L, { sensitivity: "base", numeric: true });

    // ── Fechas ──
    function bucket(ms) {
      if (!ms) return { key: "nodate", label: t("noDate") };
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const DAY = 86400000;
      if (ms >= start) return { key: "today", label: t("today") };
      if (ms >= start - DAY) return { key: "yesterday", label: t("yesterday") };
      if (ms >= start - 7 * DAY) return { key: "last7", label: t("last7") };
      if (ms >= start - 30 * DAY) return { key: "last30", label: t("last30") };
      const d = new Date(ms);
      let label = d.toLocaleDateString(L, { month: "long", year: "numeric" });
      label = label.charAt(0).toLocaleUpperCase(L) + label.slice(1);
      return { key: `m${d.getFullYear()}-${d.getMonth()}`, label };
    }
    function fmtFull(ms) {
      try { return new Date(ms).toLocaleString(L, { dateStyle: "long", timeStyle: "short" }); }
      catch (_) { return new Date(ms).toLocaleString(); }
    }

    // ── Filas ──
    function sectionTitle(text) {
      const el = document.createElement("div");
      el.className = "ofs-section-title"; el.textContent = text;
      return el;
    }
    function tooltip(n) {
      const lines = [n.title || t("untitled")];
      if (n.time) lines.push(tf("modified", { date: fmtFull(n.time) }));
      if (n.info) lines.push(n.info);
      if (n.snippet) lines.push("", n.snippet);
      return lines.join("\n");
    }
    function moveFocus(from, dir) {
      const rows = [...list.querySelectorAll(".ofs-item, .ofs-folder")];
      rows[rows.indexOf(from) + dir]?.focus();
    }
    function itemRow(n) {
      const el = document.createElement("div");
      el.className = "ofs-item" + (n.badge ? " has-badge" : "");
      el.dataset.id = n.id;
      el.tabIndex = 0; el.draggable = true;
      el.setAttribute("role", "treeitem");
      if (!cfg.preview) el.title = tooltip(n);
      if (n.id === st.activeId) { el.classList.add("active"); el.setAttribute("aria-current", "true"); if (st.dirty) el.classList.add("dirty"); }
      let html = `<span class="ofs-item-title"></span><span class="ofs-dot" title="${esc(t("unsaved"))}"></span>`;
      if (n.badge) html += `<span class="ofs-badge">${esc(n.badge)}</span>`;
      const act = cfg.rowAction ? cfg.rowAction(n) : null;
      if (act) html += `<button class="ofs-row-btn ofs-act${act.on ? " on" : ""}" title="${esc(act.label)}" aria-label="${esc(act.label)}">${ic(act.icon)}</button>`;
      html += `<button class="ofs-row-btn ofs-more" title="${esc(t("more"))}" aria-label="${esc(t("more"))}">${ic("ellipsis")}</button>`;
      el.innerHTML = html;
      el.querySelector(".ofs-item-title").textContent = n.title || t("untitled");
      const more = el.querySelector(".ofs-more");
      more.addEventListener("click", ev => { ev.stopPropagation(); if (menuBtn === more) closeMenu(); else openItemMenu(n.id, more); });
      if (act) el.querySelector(".ofs-act").addEventListener("click", ev => { ev.stopPropagation(); act.onClick(); });
      el.addEventListener("click", () => { if (!el.querySelector(".ofs-rename-input")) select(n.id); });
      el.addEventListener("contextmenu", ev => { ev.preventDefault(); openItemMenu(n.id, null, ev.clientX, ev.clientY); });
      el.addEventListener("keydown", ev => {
        if (ev.target !== el) return;
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(n.id); }
        else if (ev.key === "F2") { ev.preventDefault(); startRename(n.id); }
        else if (ev.key === "Delete") { ev.preventDefault(); confirmDelete(n.id); }
        else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); moveFocus(el, ev.key === "ArrowDown" ? 1 : -1); }
      });
      el.addEventListener("dragstart", ev => {
        hidePreview();
        ev.dataTransfer.setData("text/x-ofs-item", n.id);
        ev.dataTransfer.effectAllowed = "move";
        el.classList.add("dragging");
      });
      el.addEventListener("dragend", () => { el.classList.remove("dragging"); clearDrop(); });
      if (cfg.preview) {
        el.addEventListener("mouseenter", () => schedulePreview(n, el));
        el.addEventListener("mouseleave", hidePreview);
      }
      return el;
    }
    function folderRow(f, count, forced) {
      const el = document.createElement("div");
      const collapsed = f.collapsed && !forced;
      el.className = "ofs-folder" + (collapsed ? " collapsed" : "");
      el.dataset.fid = f.id; el.tabIndex = 0;
      el.setAttribute("role", "treeitem"); el.setAttribute("aria-expanded", String(!collapsed));
      el.innerHTML = `${ic(collapsed ? "folder" : "folder-open")}<span class="ofs-folder-name"></span>` +
        `<span class="ofs-folder-count">${count}</span>` +
        `<button class="ofs-row-btn ofs-more" title="${esc(t("more"))}" aria-label="${esc(t("more"))}">${ic("ellipsis")}</button>` +
        ic("chevron-down", "ofs-caret");
      el.querySelector(".ofs-folder-name").textContent = f.name;
      el.title = f.name;
      const more = el.querySelector(".ofs-more");
      more.addEventListener("click", ev => { ev.stopPropagation(); if (menuBtn === more) closeMenu(); else openFolderMenu(f.id, more); });
      const toggle = () => {
        f.collapsed = !f.collapsed; saveMeta(); render();
        list.querySelector(`.ofs-folder[data-fid="${CSS.escape(f.id)}"]`)?.focus();
      };
      el.addEventListener("click", toggle);
      el.addEventListener("contextmenu", ev => { ev.preventDefault(); openFolderMenu(f.id, null, ev.clientX, ev.clientY); });
      el.addEventListener("keydown", ev => {
        if (ev.target !== el) return;
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); }
        else if (ev.key === "F2") { ev.preventDefault(); renameFolder(f.id); }
        else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); moveFocus(el, ev.key === "ArrowDown" ? 1 : -1); }
      });
      el.addEventListener("dragover", ev => {
        if (!ev.dataTransfer.types.includes("text/x-ofs-item")) return;
        ev.preventDefault(); ev.stopPropagation(); clearDrop(); el.classList.add("ofs-drop-target");
      });
      el.addEventListener("dragleave", () => el.classList.remove("ofs-drop-target"));
      el.addEventListener("drop", ev => {
        const id = ev.dataTransfer.getData("text/x-ofs-item");
        if (!id) return;
        ev.preventDefault(); ev.stopPropagation(); clearDrop();
        moveTo(id, f.id);
      });
      return el;
    }
    function clearDrop() {
      list.classList.remove("drop-root");
      list.querySelectorAll(".ofs-drop-target").forEach(x => x.classList.remove("ofs-drop-target"));
    }
    list.addEventListener("dragover", ev => {
      if (!ev.dataTransfer.types.includes("text/x-ofs-item")) return;
      ev.preventDefault(); clearDrop(); list.classList.add("drop-root");
    });
    list.addEventListener("dragleave", ev => { if (!list.contains(ev.relatedTarget)) clearDrop(); });
    list.addEventListener("drop", ev => {
      const id = ev.dataTransfer.getData("text/x-ofs-item");
      clearDrop();
      if (!id) return;
      ev.preventDefault();
      if (folderOf(id)) moveTo(id, null);
    });

    function render() {
      const scroll = list.scrollTop;
      list.innerHTML = "";
      hidePreview();
      const q = st.q.trim().toLowerCase();
      const match = n => !q || (n.title || "").toLowerCase().includes(q) || (n.snippet || "").toLowerCase().includes(q);
      const items = st.items.filter(match);
      const sorter = st.sort === "az" ? (a, b) => cmpName(a.title || "", b.title || "") : (a, b) => (b.time || 0) - (a.time || 0);
      if (!st.items.length && !meta.folders.length) {
        list.innerHTML = `<div class="ofs-empty">${esc(t("empty"))}</div>`;
        return;
      }
      const pinned = items.filter(n => isPinned(n.id)).sort(sorter);
      const rest = items.filter(n => !isPinned(n.id));
      const byFolder = new Map(meta.folders.map(f => [f.id, []]));
      const loose = [];
      rest.forEach(n => { const fid = folderOf(n.id); (fid && byFolder.has(fid) ? byFolder.get(fid) : loose).push(n); });
      loose.sort(sorter);
      let shown = 0;
      if (pinned.length) {
        list.append(sectionTitle(t("pinned")));
        pinned.forEach(n => list.append(itemRow(n)));
        shown += pinned.length;
      }
      const folders = [...meta.folders].sort((a, b) => cmpName(a.name, b.name)).filter(f => !q || byFolder.get(f.id).length);
      if (folders.length) {
        list.append(sectionTitle(t("folders")));
        folders.forEach(f => {
          const arr = byFolder.get(f.id).sort(sorter);
          list.append(folderRow(f, arr.length, !!q));
          if (!f.collapsed || q) {
            const body = document.createElement("div");
            body.className = "ofs-folder-body"; body.setAttribute("role", "group");
            if (arr.length) arr.forEach(n => body.append(itemRow(n)));
            else body.innerHTML = `<div class="ofs-folder-empty">${esc(t("folderEmpty"))}</div>`;
            list.append(body);
          }
          shown += arr.length;
        });
      }
      if (loose.length) {
        if (st.sort === "az") {
          if (pinned.length || folders.length) list.append(sectionTitle(t("noFolder")));
          loose.forEach(n => list.append(itemRow(n)));
        } else {
          let last = null;
          loose.forEach(n => {
            const b = bucket(n.time);
            if (b.key !== last) { list.append(sectionTitle(b.label)); last = b.key; }
            list.append(itemRow(n));
          });
        }
        shown += loose.length;
      }
      if (!shown && q) list.insertAdjacentHTML("beforeend", `<div class="ofs-empty">${esc(t("noResults"))}</div>`);
      else if (!st.items.length) list.insertAdjacentHTML("beforeend", `<div class="ofs-empty">${esc(t("empty"))}</div>`);
      list.scrollTop = scroll;
    }

    // ── Vista previa al pasar el ratón (imagen) ──
    let pvT = null, pvEl = null;
    function schedulePreview(n, row) {
      clearTimeout(pvT);
      pvT = setTimeout(() => {
        const url = cfg.preview(n);
        if (!url || menuEl) return;
        hidePreview();
        const card = document.createElement("div");
        card.className = "ofs-preview ofs-root ofs-layer";
        const img = new Image();
        img.alt = "";
        img.onerror = () => { img.remove(); };
        img.src = url;
        const cap = document.createElement("div");
        cap.textContent = n.time ? `${n.title} · ${fmtFull(n.time)}` : n.title;
        card.append(img, cap);
        document.body.append(card);
        pvEl = card;
        const r = row.getBoundingClientRect();
        const w = 240;
        let x = RTL() ? r.left - w - 8 : r.right + 8;
        if (x + w > innerWidth - 6) x = Math.max(6, r.left - w - 8);
        if (x < 6) x = Math.min(innerWidth - w - 6, r.right + 8);
        card.style.left = x + "px";
        card.style.top = Math.max(6, Math.min(r.top - 20, innerHeight - 230)) + "px";
      }, 380);
    }
    function hidePreview() { clearTimeout(pvT); pvEl?.remove(); pvEl = null; }
    list.addEventListener("scroll", hidePreview);

    // ── Menú flotante ──
    let menuEl = null, menuBtn = null;
    function closeMenu() {
      menuEl?.remove(); menuEl = null;
      menuBtn?.classList.remove("open"); menuBtn = null;
    }
    function showMenu(entries, anchor, x, y) {
      const keep = menuEl ? { left: menuEl.style.left, top: menuEl.style.top } : null;
      const prevBtn = menuBtn;
      closeMenu(); hidePreview();
      const m = document.createElement("div");
      m.className = "ofs-menu ofs-root ofs-layer";
      m.setAttribute("role", "menu");
      let box = null, lastSep = true;
      entries.forEach(e => {
        if (!e) return;
        if (e === "-") {
          if (lastSep) return;
          const s = document.createElement("div"); s.className = "ofs-menu-sep"; m.append(s); lastSep = true; return;
        }
        if (e === "scroll") { box = document.createElement("div"); box.className = "ofs-menu-scroll"; m.append(box); return; }
        if (e === "/scroll") { box = null; return; }
        const b = document.createElement("button");
        b.className = "ofs-menu-item" + (e.danger ? " danger" : "") + (e.current ? " current" : "") + (e.back ? " ofs-menu-back" : "");
        b.setAttribute("role", "menuitem");
        b.innerHTML = `${ic(e.icon)}<span></span>${e.sub ? ic(RTL() ? "chevron-left" : "chevron-right") : ""}`;
        b.querySelector("span").textContent = e.label;
        b.addEventListener("click", ev => {
          ev.stopPropagation();
          if (e.current) return;
          if (e.sub) { e.onClick(); return; }
          closeMenu(); e.onClick();
        });
        (box || m).append(b);
        lastSep = false;
      });
      if (m.lastElementChild?.classList.contains("ofs-menu-sep")) m.lastElementChild.remove();
      document.body.append(m);
      menuEl = m;
      menuBtn = anchor || prevBtn || null;
      menuBtn?.classList.add("open");
      if (keep && !anchor && x == null) { m.style.left = keep.left; m.style.top = keep.top; }
      else {
        let px = x, py = y;
        if (anchor) { const r = anchor.getBoundingClientRect(); px = RTL() ? r.left : r.right - m.offsetWidth; py = r.bottom + 4; }
        px = Math.max(6, Math.min(px, innerWidth - m.offsetWidth - 6));
        if (py + m.offsetHeight > innerHeight - 6) py = Math.max(6, (anchor ? anchor.getBoundingClientRect().top - 4 : py) - m.offsetHeight);
        m.style.left = px + "px"; m.style.top = py + "px";
      }
      m.querySelector(".ofs-menu-item:not(.current)")?.focus();
    }
    document.addEventListener("click", ev => { if (menuEl && !menuEl.contains(ev.target)) closeMenu(); });
    document.addEventListener("keydown", ev => {
      if (!menuEl) return;
      if (ev.key === "Escape") { const b = menuBtn; closeMenu(); b?.focus(); }
      else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        const its = [...menuEl.querySelectorAll(".ofs-menu-item:not(.current)")];
        const i = its.indexOf(document.activeElement);
        its[(i + (ev.key === "ArrowDown" ? 1 : -1) + its.length) % its.length]?.focus();
      }
    });
    window.addEventListener("resize", () => { closeMenu(); hidePreview(); });
    window.addEventListener("blur", () => { closeMenu(); hidePreview(); });
    list.addEventListener("scroll", closeMenu);

    function openItemMenu(id, anchor, x, y) {
      const n = itemById(id); if (!n) return;
      const pin = isPinned(id);
      const extra = cfg.menuItems ? (cfg.menuItems(n) || []) : [];
      const exp = cfg.exportItems ? (cfg.exportItems(n) || []) : [];
      showMenu([
        cfg.onRename && { icon: "pencil", label: t("rename"), onClick: () => startRename(id) },
        { icon: pin ? "pin-off" : "pin", label: pin ? t("unpin") : t("pin"), onClick: () => togglePin(id) },
        { icon: "folder-input", label: t("moveTo"), sub: true, onClick: () => openMoveMenu(id) },
        cfg.onDuplicate && { icon: "copy", label: t("duplicate"), onClick: () => duplicate(id) },
        "-", ...extra, "-", ...exp, "-",
        cfg.onDelete && { icon: "trash-2", label: t("del"), danger: true, onClick: () => confirmDelete(id) },
      ], anchor, x, y);
    }
    function openMoveMenu(id) {
      const cur = folderOf(id);
      const folders = [...meta.folders].sort((a, b) => cmpName(a.name, b.name));
      showMenu([
        { icon: RTL() ? "chevron-right" : "chevron-left", label: t("back"), back: true, sub: true, onClick: () => openItemMenu(id) },
        "-",
        { icon: "file-text", label: t("noFolder"), current: !cur, onClick: () => moveTo(id, null) },
        "scroll",
        ...folders.map(f => ({ icon: "folder", label: f.name, current: cur === f.id, onClick: () => moveTo(id, f.id) })),
        "/scroll", "-",
        { icon: "folder-plus", label: t("newFolder"), onClick: async () => { const fid = await createFolder(); if (fid) moveTo(id, fid); } },
      ]);
    }
    function openFolderMenu(fid, anchor, x, y) {
      showMenu([
        { icon: "pencil", label: t("rename"), onClick: () => renameFolder(fid) },
        cfg.onNew && { icon: cfg.newIcon || "square-pen", label: t("newItem"), onClick: () => cfg.onNew(fid) },
        "-",
        { icon: "trash-2", label: t("deleteFolder"), danger: true, onClick: () => deleteFolder(fid) },
      ], anchor, x, y);
    }

    // ── Carpetas, fijados ──
    async function createFolder() {
      const name = await dialog({ lang: L, title: t("newFolder"), input: { placeholder: t("folderNamePh"), maxLength: 80 }, confirmLabel: t("create") });
      if (!name) return null;
      const f = { id: "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, collapsed: false };
      meta.folders.push(f); saveMeta(); render();
      return f.id;
    }
    async function renameFolder(fid) {
      const f = folderById(fid); if (!f) return;
      const name = await dialog({ lang: L, title: t("rename"), input: { placeholder: t("folderNamePh"), value: f.name, maxLength: 80 } });
      if (!name || name === f.name) return;
      f.name = name; saveMeta(); render();
    }
    async function deleteFolder(fid) {
      const f = folderById(fid); if (!f) return;
      const ok = await dialog({ lang: L, title: t("deleteFolderTitle"), message: tf("deleteFolderMsg", { name: f.name }), confirmLabel: t("del"), danger: true });
      if (!ok) return;
      meta.folders = meta.folders.filter(x => x.id !== fid);
      for (const id of Object.keys(meta.placement)) if (meta.placement[id] === fid) delete meta.placement[id];
      saveMeta(); render();
    }
    function moveTo(id, fid, { quiet = false } = {}) {
      if ((folderOf(id) || null) === (fid || null)) return;
      if (fid) { meta.placement[id] = fid; const f = folderById(fid); if (f) f.collapsed = false; }
      else delete meta.placement[id];
      saveMeta(); render();
      if (!quiet) toast(tf("movedToast", { name: fid ? (folderById(fid)?.name || "") : t("noFolder") }));
    }
    function togglePin(id) {
      if (isPinned(id)) meta.pinned = meta.pinned.filter(x => x !== id);
      else meta.pinned.unshift(id);
      saveMeta(); render();
    }

    // ── Renombrar en la fila ──
    function startRename(id) {
      const row = list.querySelector(`.ofs-item[data-id="${CSS.escape(id)}"]`);
      const n = itemById(id);
      if (!row || !n || !cfg.onRename) return;
      hidePreview();
      const span = row.querySelector(".ofs-item-title");
      const inp = document.createElement("input");
      inp.className = "ofs-rename-input"; inp.value = n.title || ""; inp.maxLength = 150;
      span.replaceWith(inp);
      row.draggable = false;
      inp.focus(); inp.select();
      let done = false;
      const finish = async commit => {
        if (done) return; done = true;
        const v = inp.value.trim();
        if (commit && v && v !== n.title) {
          try {
            const newId = await cfg.onRename(id, v);
            if (newId && newId !== id) renameId(id, newId);
          } catch (e) { toast("❌ " + (e && e.message ? e.message : e)); }
        }
        render();
        list.querySelector(`.ofs-item[data-id="${CSS.escape(id)}"]`)?.focus();
      };
      inp.addEventListener("keydown", ev => {
        ev.stopPropagation();
        if (ev.key === "Enter") { ev.preventDefault(); finish(true); }
        else if (ev.key === "Escape") { ev.preventDefault(); finish(false); }
      });
      inp.addEventListener("blur", () => finish(true));
      inp.addEventListener("click", ev => ev.stopPropagation());
    }
    async function duplicate(id) {
      try {
        const newId = await cfg.onDuplicate(id);
        if (newId) { const fid = folderOf(id); if (fid) { meta.placement[newId] = fid; saveMeta(); render(); } }
      } catch (e) { toast("❌ " + (e && e.message ? e.message : e)); }
    }
    async function confirmDelete(id) {
      const n = itemById(id);
      if (!n || !cfg.onDelete) return;
      const ok = await dialog({
        lang: L, title: t("deleteTitle"), message: tf("deleteMsg", { name: n.title || t("untitled") }),
        confirmLabel: t("del"), danger: true,
      });
      if (!ok) return;
      try { await cfg.onDelete(id); removeId(id); }
      catch (e) { toast("❌ " + (e && e.message ? e.message : e)); }
    }

    // ── Plegar ──
    function setCollapsed(c, persist = true) {
      aside.classList.toggle("collapsed", c);
      rail.classList.toggle("hidden", !c);
      if (persist && !MQ.matches) lsSet(PREF + "collapsed", c ? "1" : "0");
      closeMenu(); hidePreview();
      if (cfg.onLayout) setTimeout(cfg.onLayout, 170);
    }
    $('[data-k="collapse"]').addEventListener("click", () => setCollapsed(true));
    $('[data-k="folder"]').addEventListener("click", () => createFolder());
    rail.querySelector('[data-k="expand"]').addEventListener("click", () => setCollapsed(false));
    rail.querySelector('[data-k="new"]').addEventListener("click", () => cfg.onNew && cfg.onNew(null));
    rail.querySelector('[data-k="search"]').addEventListener("click", () => { setCollapsed(false); setTimeout(() => search.focus(), 160); });
    $(".ofs-new-btn").addEventListener("click", () => cfg.onNew && cfg.onNew(null));
    backdrop.addEventListener("click", () => setCollapsed(true, false));
    MQ.addEventListener?.("change", e => setCollapsed(e.matches ? true : lsGet(PREF + "collapsed") === "1", false));
    setCollapsed(MQ.matches ? true : lsGet(PREF + "collapsed") === "1", false);

    function select(id) {
      if (MQ.matches) setCollapsed(true, false);
      if (id !== st.activeId || cfg.reopenActive) cfg.onOpen && cfg.onOpen(id);
    }

    search.addEventListener("input", () => { st.q = search.value || ""; render(); });
    search.addEventListener("keydown", ev => {
      if (ev.key === "Escape" && search.value) { ev.preventDefault(); search.value = ""; st.q = ""; render(); }
      else if (ev.key === "ArrowDown") { ev.preventDefault(); list.querySelector(".ofs-item, .ofs-folder")?.focus(); }
    });
    sortSel.addEventListener("change", () => { st.sort = sortSel.value === "az" ? "az" : "recent"; lsSet(PREF + "sort", st.sort); render(); });

    // ── API pública ──
    function renameId(oldId, newId) {
      if (!oldId || !newId || oldId === newId) return;
      meta.pinned = meta.pinned.map(x => x === oldId ? newId : x);
      if (meta.placement[oldId]) { meta.placement[newId] = meta.placement[oldId]; delete meta.placement[oldId]; }
      const n = itemById(oldId); if (n) n.id = newId;
      if (st.activeId === oldId) st.activeId = newId;
      saveMeta(); render();
    }
    function removeId(id) {
      st.items = st.items.filter(n => n.id !== id);
      meta.pinned = meta.pinned.filter(x => x !== id);
      if (meta.placement[id]) delete meta.placement[id];
      saveMeta(); render();
    }
    const api = {
      ready: null,
      t, ic, hydrateIcons,
      dialog: o => dialog(Object.assign({ lang: L }, o)),
      setItems(items) {
        st.items = (items || []).map(n => Object.assign({}, n, { id: String(n.id) }));
        if (loaded) prune();
        render();
      },
      upsert(item) {
        const id = String(item.id);
        const i = st.items.findIndex(n => n.id === id);
        if (i >= 0) st.items[i] = Object.assign({}, st.items[i], item, { id });
        else st.items.unshift(Object.assign({}, item, { id }));
        render();
      },
      getItem: itemById,
      get items() { return st.items.slice(); },
      get activeId() { return st.activeId; },
      setActive(id) {
        st.activeId = id == null ? null : String(id);
        render();
        if (st.activeId) list.querySelector(`.ofs-item[data-id="${CSS.escape(st.activeId)}"]`)?.scrollIntoView({ block: "nearest" });
      },
      setDirty(v) {
        st.dirty = !!v;
        if (st.activeId) list.querySelector(`.ofs-item[data-id="${CSS.escape(st.activeId)}"]`)?.classList.toggle("dirty", st.dirty);
      },
      renameId, removeId,
      placeIn(id, fid) { if (fid && folderById(fid)) moveTo(String(id), fid, { quiet: true }); },
      folderOf, revealFolderOf(id) { const f = folderById(folderOf(id)); if (f && f.collapsed) { f.collapsed = false; render(); } },
      newestId() { return [...st.items].sort((a, b) => (b.time || 0) - (a.time || 0))[0]?.id || null; },
      getExtra(k) { return meta.extra[k]; },
      setExtra(k, v) { meta.extra[k] = v; saveMeta(); },
      collapse(c) { setCollapsed(!!c, false); },
      isMobile() { return MQ.matches; },
      render,
    };
    api.ready = loadMeta().then(() => { prune(); render(); });
    return api;
  }

  window.OflSidebar = { create, dialog, ic, hydrateIcons, ICONS };
})();
