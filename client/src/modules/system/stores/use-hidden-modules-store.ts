import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isHideableModule } from '@/modules/system/constants/hideable-modules';

/**
 * Per-user, per-browser preference for which optional feature modules the user
 * has hidden from their own navigation. This is purely a client-side UI
 * preference (like the theme) — it never touches the server's deployment-level
 * `enabledModules`. The effective visibility of a module is:
 *   server-enabled AND not user-hidden AND user-permitted (RBAC).
 *
 * Persisted to localStorage (key `volt:hidden-modules`) via zustand's `persist`
 * middleware. A zustand store (rather than the plain localStorage pattern used
 * for theme) is used because the toggle in Settings and the consumers
 * (RouteRenderer, the sidebars) live in different parts of the tree and must
 * react live to a change — persist keeps it in localStorage while giving
 * cross-tree reactivity.
 *
 * Defense in depth: the persisted list is always sanitized through
 * `isHideableModule` on hydration and on every write, so a tampered localStorage
 * value can never hide a protected/core route.
 */
interface HiddenModulesStore {
    hidden: string[];
    toggle: (moduleKey: string) => void;
    setHidden: (moduleKeys: string[]) => void;
}

const HIDDEN_MODULES_STORAGE_KEY = 'volt:hidden-modules';

const sanitize = (moduleKeys: string[]): string[] => {
    // Dedupe + drop anything not actually hideable (protected/unknown keys).
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
            // Re-sanitize whatever was persisted (older/tampered values) once
            // the store rehydrates from localStorage.
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.hidden = sanitize(state.hidden);
                }
            }
        }
    )
);
