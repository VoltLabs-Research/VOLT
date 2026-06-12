import { useHiddenModulesStore } from '@/modules/system/stores/use-hidden-modules-store';

interface UseHiddenModulesReturn {
    /** Module keys the user has hidden from their own navigation. */
    hidden: string[];
    /** Toggle a module's hidden state (no-op for protected/non-hideable keys). */
    toggle: (moduleKey: string) => void;
    /** Replace the whole hidden set. */
    setHidden: (moduleKeys: string[]) => void;
    /** Whether a given module is currently hidden for this user. */
    isHidden: (moduleKey: string) => boolean;
}

/**
 * Per-user module-hiding preference (localStorage-backed). Mirrors the naming of
 * `use-module-enabled.ts` (the deployment-level switch); the two compose to
 * decide a module's visibility. See `use-hidden-modules-store.ts`.
 */
export const useHiddenModules = (): UseHiddenModulesReturn => {
    const hidden = useHiddenModulesStore((state) => state.hidden);
    const toggle = useHiddenModulesStore((state) => state.toggle);
    const setHidden = useHiddenModulesStore((state) => state.setHidden);

    return {
        hidden,
        toggle,
        setHidden,
        isHidden: (moduleKey: string) => hidden.includes(moduleKey)
    };
};
