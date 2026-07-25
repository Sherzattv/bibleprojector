/**
 * layout.js - Управление боковыми панелями (рейлами)
 *
 * У рейла два режима, и переключает их CSS, а не JS:
 *
 *   • Широкий экран (> 1100px) — рейл это КОЛОНКА грида. Кнопка сворачивает
 *     его до узкой полоски (атрибут data-left/data-right на .app). Центральная
 *     колонка объявлена как minmax(0, 1fr), поэтому освободившееся место
 *     достаётся ей, а противоположный рейл не сдвигается ни на пиксель.
 *
 *   • Узкий экран (≤ 1100px) — рейл это ВЫДВИЖНАЯ ПАНЕЛЬ поверх контента
 *     (класс .is-open + затемнение). Открытие панели вообще не влияет на
 *     ширину сцены, поэтому вытолкнуть что-либо за экран невозможно.
 *
 * JS здесь только хранит состояние и ставит атрибуты — вся геометрия в CSS.
 */

const STORAGE_KEY = 'bible_layout';
const OVERLAY_QUERY = '(max-width: 1100px)';

const SIDES = {
    left: {
        railId: 'rail-left',
        attr: 'data-left',
        toggleIds: ['toggle-left', 'toggle-left-mobile'],
        labels: { expand: 'Развернуть порядок служения', collapse: 'Свернуть порядок служения' }
    },
    right: {
        railId: 'rail-right',
        attr: 'data-right',
        toggleIds: ['toggle-right', 'toggle-right-mobile'],
        labels: { expand: 'Развернуть библиотеку', collapse: 'Свернуть библиотеку' }
    }
};

let app = null;
let scrim = null;
let overlayMedia = null;

/** Состояние на широком экране: свёрнут ли рейл. */
const collapsed = { left: false, right: false };
/** Состояние в оверлейном режиме: открыт ли рейл. */
const opened = { left: false, right: false };

/**
 * Инициализировать управление рейлами.
 */
export function initLayout() {
    app = document.getElementById('app');
    scrim = document.getElementById('scrim');
    if (!app) return;

    restore();

    overlayMedia = window.matchMedia(OVERLAY_QUERY);
    overlayMedia.addEventListener('change', handleModeChange);

    Object.entries(SIDES).forEach(([side, config]) => {
        config.toggleIds.forEach((id) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', () => toggleRail(side));
        });
    });

    if (scrim) scrim.addEventListener('click', closeAllDrawers);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
            e.preventDefault();
            toggleRail('left');
        }
        if (e.key === 'F4') {
            e.preventDefault();
            toggleRail('right');
        }
        if (e.key === 'Escape' && isOverlayMode() && (opened.left || opened.right)) {
            closeAllDrawers();
        }
    });

    handleModeChange();
}

/**
 * Открыт ли оверлейный режим (узкий экран).
 * @returns {boolean}
 */
export function isOverlayMode() {
    return Boolean(overlayMedia?.matches);
}

/**
 * Переключить рейл: свернуть/развернуть (широкий экран)
 * или открыть/закрыть (узкий).
 * @param {'left'|'right'} side
 */
export function toggleRail(side) {
    if (isOverlayMode()) {
        setDrawer(side, !opened[side]);
    } else {
        collapsed[side] = !collapsed[side];
        persist();
        applyState();
    }
}

/**
 * Гарантированно показать рейл (например, при переходе на его вкладку).
 * @param {'left'|'right'} side
 */
export function revealRail(side) {
    if (isOverlayMode()) {
        setDrawer(side, true);
    } else if (collapsed[side]) {
        collapsed[side] = false;
        persist();
        applyState();
    }
}

/**
 * Закрыть все выдвижные панели (только для узкого экрана).
 */
export function closeAllDrawers() {
    setDrawer('left', false);
    setDrawer('right', false);
}

function setDrawer(side, open) {
    // На узком экране одновременно открыт только один рейл — иначе они
    // перекрывают друг друга и сцену.
    if (open) {
        const other = side === 'left' ? 'right' : 'left';
        if (opened[other]) setDrawer(other, false);
    }

    opened[side] = open;
    applyState();
}

function handleModeChange() {
    // При смене режима сбрасываем состояние другого режима, чтобы не
    // остаться, например, с открытым drawer'ом на широком экране.
    if (isOverlayMode()) {
        opened.left = false;
        opened.right = false;
    }
    applyState();
}

function applyState() {
    const overlay = isOverlayMode();

    Object.entries(SIDES).forEach(([side, config]) => {
        const rail = document.getElementById(config.railId);
        const isCollapsed = collapsed[side];
        const isOpen = opened[side];

        app.setAttribute(config.attr, isCollapsed ? 'collapsed' : 'expanded');
        if (rail) rail.classList.toggle('is-open', overlay && isOpen);

        const expanded = overlay ? isOpen : !isCollapsed;
        config.toggleIds.forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            // Кнопки-«бургеры» нужны только в оверлейном режиме,
            // кнопки-«стрелки» — только в колоночном.
            const isMobileToggle = id.endsWith('-mobile');
            btn.hidden = isMobileToggle ? !overlay : overlay;

            btn.setAttribute('aria-expanded', String(expanded));
            btn.setAttribute('aria-label', expanded ? config.labels.collapse : config.labels.expand);
        });
    });

    if (scrim) scrim.classList.toggle('is-active', overlay && (opened.left || opened.right));
}

function restore() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;

        const parsed = JSON.parse(saved);
        collapsed.left = Boolean(parsed.left);
        collapsed.right = Boolean(parsed.right);
    } catch (e) {
        console.error('Failed to load layout state:', e);
    }
}

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
    } catch (e) {
        console.error('Failed to save layout state:', e);
    }
}
