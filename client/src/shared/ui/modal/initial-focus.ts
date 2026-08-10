/**
 * Where focus lands when a modal opens.
 *
 * React Aria focuses the dialog element itself on mount and contains focus inside
 * it, but it has no equivalent of bravais's ordered preference list, and the two
 * components that rely on that list — ConfirmActionModal (focus the typed
 * confirmation field) and CommandPalette (focus the search input) — express it
 * through a `data-modal-initial-focus="true"` attribute rather than through a prop.
 * This module is that list, ported unchanged so the attribute keeps working.
 */

const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * The focusable descendants of `dialog`, in document order.
 *
 * `[hidden]` and `aria-hidden="true"` are filtered out after the query rather than
 * in the selector because both can sit on an ancestor of a focusable node, which a
 * flat selector cannot express. `[disabled]` is handled in the selector because
 * only the focusable element itself can carry it.
 */
const getFocusableElements = (dialog: HTMLElement): HTMLElement[] => {
    const focusableElements = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

    return Array.from(focusableElements).filter((element) => {
        return !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true';
    });
};

/**
 * Resolves the element to focus when the dialog opens.
 *
 * On a coarse pointer the dialog itself wins, unconditionally and before any
 * preference is consulted. That is not a fallback: focusing a text field on a
 * touch device pops the on-screen keyboard the moment the modal appears, covering
 * the content the user was about to read. The dialog is focusable because React
 * Aria gives it `tabIndex={-1}`, the same reason bravais set it by hand.
 *
 * Otherwise, in order: an explicit `[data-modal-initial-focus="true"]`, then a
 * plain `[autofocus]`, then the first focusable descendant, then the dialog. The
 * two attribute branches skip a `[disabled]` match instead of falling through to
 * the *next* match of the same kind — a disabled preferred target demotes the
 * whole branch, which is what bravais did.
 */
export const getInitialFocusTarget = (dialog: HTMLElement, isCoarsePointer: boolean): HTMLElement => {
    if (isCoarsePointer) {
        return dialog;
    }

    const preferredFocusTarget = dialog.querySelector<HTMLElement>('[data-modal-initial-focus="true"]');
    if (preferredFocusTarget && !preferredFocusTarget.hasAttribute('disabled')) {
        return preferredFocusTarget;
    }

    const autofocusElement = dialog.querySelector<HTMLElement>('[autofocus]');
    if (autofocusElement && !autofocusElement.hasAttribute('disabled')) {
        return autofocusElement;
    }

    return getFocusableElements(dialog)[0] ?? dialog;
};
