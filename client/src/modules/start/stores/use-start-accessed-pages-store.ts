import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import startAccessedPagesStorage from '../services/start-accessed-pages-storage';

export interface AccessedPage {
    path: string;
    title: string;
    lastAccessed: number;
    snapshot?: string;
};

interface StartAccessedPagesState {
    pages: AccessedPage[];
    addPage: (path: string, title: string, snapshot?: string) => void;
    removePage: (path: string) => void;
    clearAll: () => void;
};

const MAX_PAGES = 15;

export const useStartAccessedPagesStore = create<StartAccessedPagesState>()(
    persist(
        (set) => ({
            pages: [],
            addPage: (path, title, snapshot) => set((state) => {
                const existingIndex = state.pages.findIndex((page) => page.path === path);
                let nextPages = [...state.pages];

                if (existingIndex !== -1) {
                    const existingSnapshot = nextPages[existingIndex].snapshot;
                    nextPages.splice(existingIndex, 1);
                    nextPages.unshift({
                        path,
                        title,
                        lastAccessed: Date.now(),
                        snapshot: snapshot || existingSnapshot
                    });
                } else {
                    nextPages.unshift({ path, title, lastAccessed: Date.now(), snapshot });
                }

                if (nextPages.length > MAX_PAGES) {
                    nextPages = nextPages.slice(0, MAX_PAGES);
                }

                return { pages: nextPages };
            }),
            removePage: (path) => set((state) => ({
                pages: state.pages.filter((page) => page.path !== path)
            })),
            clearAll: () => set({ pages: [] })
        }),
        {
            name: 'volt-accessed-pages-idb',
            storage: createJSONStorage(() => startAccessedPagesStorage)
        }
    )
);
