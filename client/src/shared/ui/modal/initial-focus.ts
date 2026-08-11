

const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

const getFocusableElements = (dialog: HTMLElement): HTMLElement[] => {
    const focusableElements = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

    return Array.from(focusableElements).filter((element) => {
        return !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true';
    });
};

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
