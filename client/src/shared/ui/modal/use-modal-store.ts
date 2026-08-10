import { create } from 'zustand';

/**
 * The imperative modal façade.
 *
 * bravais's `openModal`/`closeModal` were not state at all: they looked up
 * `document.getElementById(id)`, checked it was an `HTMLDialogElement` and called
 * `showModal()` / `close()`. Opening therefore happened entirely outside React —
 * driven by the browser's Invoker Commands API (`command='show-modal'`) or by
 * those two functions — and `<Modal>` learned about it through a
 * `MutationObserver` on the dialog's `open` attribute.
 *
 * HeroUI's modal is a React portal driven by `isOpen`/`onOpenChange`, so the DOM
 * can no longer be the source of truth. This store is: an id → open map that
 * `<Modal id>` subscribes to. The three exported functions keep the old imperative
 * shape so the ~70 call sites change by import path only, and — because they read
 * the store through `getState()` rather than a hook — they stay callable from
 * plain modules such as `@/shared/ui/actions/run-action`.
 *
 * The id-keyed model is deliberate rather than one boolean per modal: 37
 * `openModal(` and 30 `closeModal(` call sites pass a bare string id, often one
 * they import from a constant in another module, and several of them fire from
 * code that has no access to the component that renders the modal.
 */
interface ModalStoreState {
    /**
     * Open modal ids. A plain object rather than a `Set` so a selector can read
     * one id (`openModalIds[id] === true`) and get a stable primitive back — a
     * `Set` would force every subscriber to re-render on every unrelated change.
     */
    openModalIds: Readonly<Record<string, boolean>>;
}

interface ModalStoreActions {
    open: (id: string) => void;
    close: (id: string) => void;
}

export const useModalStore = create<ModalStoreState & ModalStoreActions>((set) => ({
    openModalIds: {},

    /*
     * Both actions return the *same* state object when the id is already in the
     * requested position. zustand compares with `Object.is` before notifying, so
     * this turns a redundant `openModal(id)` into a genuine no-op instead of a
     * new object identity that re-renders every subscriber. bravais got this for
     * free from its `!element.open` / `element.open` guards.
     */
    open: (id) => set((state) => {
        if (state.openModalIds[id] === true) {
            return state;
        }

        return { openModalIds: { ...state.openModalIds, [id]: true } };
    }),

    close: (id) => set((state) => {
        if (state.openModalIds[id] !== true) {
            return state;
        }

        const nextOpenModalIds = { ...state.openModalIds };
        delete nextOpenModalIds[id];

        return { openModalIds: nextOpenModalIds };
    })
}));

/** Whether the modal with this id is currently open. */
export const useIsModalOpen = (id: string): boolean => {
    return useModalStore((state) => state.openModalIds[id] === true);
};

/**
 * Opens a modal by id.
 *
 * Unlike bravais's version this does not require the modal to be mounted. bravais
 * silently no-op'd on an unknown id (no element, or an element that was not a
 * `<dialog>`); here the id is simply marked open, and a `<Modal>` that mounts
 * later with that id opens immediately. See the note on `<Modal>` for why that
 * changes the character of a typo'd id.
 */
export const openModal = (id: string): void => {
    useModalStore.getState().open(id);
};

/** Closes a modal by id. Silently does nothing when it is not open. */
export const closeModal = (id: string): void => {
    useModalStore.getState().close(id);
};

/**
 * Closes a modal and runs reset work after the close animation delay.
 *
 * DELIBERATELY FIRE-AND-FORGET. The timeout handle is discarded, exactly as in
 * bravais: `reset` runs after `delay` unconditionally — even if the modal was
 * already closed, even if `closeModal` matched nothing, and even if the component
 * that owns `reset` has since unmounted. All three of its call sites (
 * TeamCreatorModal, JoinTeamModal, SecretKeyCreationModal) were written against
 * that behaviour, and adding a cancel path would change what they do rather than
 * merely tidy this function. The 300ms default is likewise kept as-is: it matches
 * no duration in the system, it is a hand-picked "after the close animation"
 * guess, and no call site overrides it.
 */
export const resetModal = (id: string, reset: () => void, delay = 300): void => {
    closeModal(id);
    window.setTimeout(reset, delay);
};
