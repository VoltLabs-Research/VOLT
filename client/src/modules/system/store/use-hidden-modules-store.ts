import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isHideableModule } from '@/modules/system/constants/hideable-modules';

interface HiddenModulesStore {
    hidden: string[];
    toggle: (moduleKey: string) => void;
}

const HIDDEN_MODULES_STORAGE_KEY = 'volt:hidden-modules';

export const useHiddenModulesStore = create<HiddenModulesStore>()(
    persist(
        (set, get) => ({
            hidden: [],
            toggle: (moduleKey: string) => {
                if (!isHideableModule(moduleKey)) {
                    return;
                }

                const current = get().hidden;

                set({
                    hidden: current.includes(moduleKey)
                        ? current.filter((key) => key !== moduleKey)
                        : [...current, moduleKey]
                });
            }
        }),
        {
            name: HIDDEN_MODULES_STORAGE_KEY,
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Persisted keys can be stale or protected since they were written.
                    state.hidden = Array.from(new Set(state.hidden)).filter(isHideableModule);
                }
            }
        }
    )
);
