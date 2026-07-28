import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isHideableModule } from '@/modules/system/constants/hideable-modules';

interface HiddenModulesStore {
    hidden: string[];
    toggle: (moduleKey: string) => void;
    setHidden: (moduleKeys: string[]) => void;
}

const HIDDEN_MODULES_STORAGE_KEY = 'volt:hidden-modules';

const sanitize = (moduleKeys: string[]): string[] => {
    return Array.from(new Set(moduleKeys)).filter(isHideableModule);
};

export const useHiddenModulesStore = create<HiddenModulesStore>()(
    persist(
        (set, get) => ({
            hidden: [],
            toggle: (moduleKey: string) => {
                if (!isHideableModule(moduleKey)) {
                    return;
                }

                const current = get().hidden;
                const next = current.includes(moduleKey)
                    ? current.filter((key) => key !== moduleKey)
                    : [...current, moduleKey];

                set({ hidden: sanitize(next) });
            },
            setHidden: (moduleKeys: string[]) => {
                set({ hidden: sanitize(moduleKeys) });
            }
        }),
        {
            name: HIDDEN_MODULES_STORAGE_KEY,
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.hidden = sanitize(state.hidden);
                }
            }
        }
    )
);
