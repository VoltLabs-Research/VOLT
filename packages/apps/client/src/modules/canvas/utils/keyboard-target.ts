// Whether a key press is typing into a text field. A field can keep focus while its keys reach
// another element: react-aria's Autocomplete re-dispatches them to its menu or list, so the event's
// target alone would let the canvas shortcuts and the type-to-search take keys meant for the field.

const isEditableElement = (element: EventTarget | null): boolean => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.isContentEditable) return true;
    return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT';
};

export const isTypingInField = (event: KeyboardEvent): boolean =>
    isEditableElement(event.target) || isEditableElement(document.activeElement);
