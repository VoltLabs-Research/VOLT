export const FOCUSABLE_BASE_SELECTOR = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(', ');

export const ROLE_MENUITEM_SELECTOR = [
    '[role="menuitem"]:not([disabled])',
    '[role="menuitemcheckbox"]:not([disabled])',
    '[role="menuitemradio"]:not([disabled])'
].join(', ');

export const FOCUSABLE_SELECTOR = `${ROLE_MENUITEM_SELECTOR}, ${FOCUSABLE_BASE_SELECTOR}`;

export const PANEL_FOCUSABLE_SELECTOR = FOCUSABLE_BASE_SELECTOR;