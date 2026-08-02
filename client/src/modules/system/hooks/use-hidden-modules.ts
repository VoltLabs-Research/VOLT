import { useHiddenModulesStore } from '@/modules/system/store/use-hidden-modules-store';

export const useHiddenModules = () => ({
    hidden: useHiddenModulesStore((state) => state.hidden),
    toggle: useHiddenModulesStore((state) => state.toggle)
});
