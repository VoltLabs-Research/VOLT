import { create } from 'zustand';

interface GlobalAttributesStore {
    /** Set by AI tool to expand the panel and select an attribute on next render. */
    pendingOpenAttribute: string | null;
    openChart: (params: { attribute: string }) => void;
    consumePendingOpen: () => string | null;
}

export const useGlobalAttributesStore = create<GlobalAttributesStore>((set, get) => ({
    pendingOpenAttribute: null,

    openChart: ({ attribute }) => set({ pendingOpenAttribute: attribute }),

    consumePendingOpen: () => {
        const attr = get().pendingOpenAttribute;
        if (attr !== null) set({ pendingOpenAttribute: null });
        return attr;
    }
}));
