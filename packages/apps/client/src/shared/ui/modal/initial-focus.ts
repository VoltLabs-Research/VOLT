

import { FOCUSABLE_BASE_SELECTOR } from '@/shared/ui/utils/focusable';

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

    const focusableElements = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_BASE_SELECTOR);

    return Array.from(focusableElements)
        .filter((element) => {
            return !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true';
        })[0] ?? dialog;
};
