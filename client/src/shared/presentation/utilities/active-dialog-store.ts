type ActiveDialogListener = (dialog: HTMLDialogElement | null) => void;

/**
 * Module-level store that tracks which native `<dialog>` is currently open
 * (i.e., promoted to the browser's top layer via `.showModal()`).
 *
 * When a modal opens, it registers itself here so that top-layer-aware
 * consumers - like the AppToaster - can portal their content into the same
 * top-layer element and remain visible above the modal backdrop.
 */
let activeDialog: HTMLDialogElement | null = null;
const listeners = new Set<ActiveDialogListener>();

export const setActiveDialog = (dialog: HTMLDialogElement | null): void => {
    activeDialog = dialog;
    listeners.forEach((fn) => fn(dialog));
};

export const getActiveDialog = (): HTMLDialogElement | null => activeDialog;

/**
 * Subscribes to changes of the active dialog.
 *
 * @param listener - Called immediately with the current value and again on
 *   every subsequent change.
 * @returns An unsubscribe function.
 */
export const subscribeToActiveDialog = (listener: ActiveDialogListener): () => void => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
