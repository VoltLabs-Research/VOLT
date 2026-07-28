import { useHiddenModulesStore } from '@/modules/system/store/use-hidden-modules-store';

interface UseHiddenModulesReturn {
    
    hidden: string[];
    
    toggle: (moduleKey: string) => void;
    
    isHidden: (moduleKey: string) => boolean;
}

export const useHiddenModules = (): UseHiddenModulesReturn => {
    const hidden = useHiddenModulesStore((state) => state.hidden);
    const toggle = useHiddenModulesStore((state) => state.toggle);

    return {
        hidden,
        toggle,
        isHidden: (moduleKey: string) => hidden.includes(moduleKey)
    };
};
