import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

export interface AccessedPage {
    path: string;
    title: string;
    lastAccessed: number;
    snapshot?: string;
}

interface AccessedPagesState {
    pages: AccessedPage[];
    addPage: (path: string, title: string, snapshot?: string) => void;
    removePage: (path: string) => void;
    clearAll: () => void;
}

const MAX_PAGES = 15; // Set a reasonable limit to avoid memory issues with iframes

const idbStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        return (await get(name)) || null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await set(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await del(name);
    },
};

export const useAccessedPagesStore = create<AccessedPagesState>()(
    persist(
        (set) => ({
            pages: [],
            addPage: (path, title, snapshot) => set((state) => {
                const existingIndex = state.pages.findIndex(p => p.path === path);
                let newPages = [...state.pages];

                if (existingIndex !== -1) {
                    // Update existing page with new access time and potentially new snapshot
                    // If no new snapshot is provided, keep the old one
                    const oldSnapshot = newPages[existingIndex].snapshot;
                    newPages.splice(existingIndex, 1);
                    newPages.unshift({ path, title, lastAccessed: Date.now(), snapshot: snapshot || oldSnapshot });
                } else {
                    newPages.unshift({ path, title, lastAccessed: Date.now(), snapshot });
                }

                if (newPages.length > MAX_PAGES) {
                    newPages = newPages.slice(0, MAX_PAGES);
                }

                return { pages: newPages };
            }),
            removePage: (path) => set((state) => ({
                pages: state.pages.filter(p => p.path !== path)
            })),
            clearAll: () => set({ pages: [] }),
        }),
        {
            name: 'volt-accessed-pages-idb',
            storage: createJSONStorage(() => idbStorage),
        }
    )
);
