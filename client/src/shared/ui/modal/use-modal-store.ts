import { create } from 'zustand';

interface ModalStoreState {
    openModalIds: Readonly<Record<string, boolean>>;
}

interface ModalStoreActions {
    open: (id: string) => void;
    close: (id: string) => void;
}

export const useModalStore = create<ModalStoreState & ModalStoreActions>((set) => ({
    openModalIds: {},

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

export const useIsModalOpen = (id: string): boolean => {
    return useModalStore((state) => state.openModalIds[id] === true);
};

export const openModal = (id: string): void => {
    useModalStore.getState().open(id);
};

export const closeModal = (id: string): void => {
    useModalStore.getState().close(id);
};

export const resetModal = (id: string, reset: () => void, delay = 300): void => {
    closeModal(id);
    window.setTimeout(reset, delay);
};
