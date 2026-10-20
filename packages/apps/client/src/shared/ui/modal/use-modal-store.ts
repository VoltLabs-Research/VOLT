import { create } from 'zustand';

interface ModalStoreState {
    openModalIds: Readonly<Record<string, boolean>>;
    modalPayloads: Readonly<Record<string, unknown>>;
}

interface ModalStoreActions {
    open: (id: string, payload?: unknown) => void;
    close: (id: string) => void;
}

const useModalStore = create<ModalStoreState & ModalStoreActions>((set) => ({
    openModalIds: {},
    modalPayloads: {},

    open: (id, payload) => set((state) => {
        if (state.openModalIds[id] === true && payload === undefined) {
            return state;
        }

        return {
            openModalIds: { ...state.openModalIds, [id]: true },
            modalPayloads: payload === undefined
                ? state.modalPayloads
                : { ...state.modalPayloads, [id]: payload }
        };
    }),

    close: (id) => set((state) => {
        if (state.openModalIds[id] !== true && !(id in state.modalPayloads)) {
            return state;
        }

        const nextOpenModalIds = { ...state.openModalIds };
        const nextModalPayloads = { ...state.modalPayloads };

        delete nextOpenModalIds[id];
        delete nextModalPayloads[id];

        return {
            openModalIds: nextOpenModalIds,
            modalPayloads: nextModalPayloads
        };
    })
}));

export const useIsModalOpen = (id: string): boolean => {
    return useModalStore((state) => state.openModalIds[id] === true);
};

export const useModalPayload = <T,>(id: string): T | null => {
    return useModalStore((state) => (state.modalPayloads[id] as T | undefined) ?? null);
};

export const openModal = <T,>(id: string, payload?: T): void => {
    useModalStore.getState().open(id, payload);
};

export const closeModal = (id: string): void => {
    useModalStore.getState().close(id);
};

export const resetModal = (id: string, reset: () => void, delay = 300): void => {
    closeModal(id);
    window.setTimeout(reset, delay);
};
