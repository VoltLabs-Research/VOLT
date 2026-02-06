import { useEffect, useRef } from 'react';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';

const useCanvasShortcuts = () => {
    const { updateSearchParams } = useSearchParamsState();
    const { toggleSelection } = useSelectionParams({ paramName: 'modifiers' });

    const updateSearchParamsRef = useRef(updateSearchParams);
    const toggleModifierRef = useRef(toggleSelection);

    useEffect(() => {
        updateSearchParamsRef.current = updateSearchParams;
        toggleModifierRef.current = toggleSelection;
    }, [updateSearchParams, toggleSelection]);

    useEffect(() => {
        const handleToggleWidgets = () => {
            const current = new URLSearchParams(window.location.search).get('widgets') !== 'false';
            updateSearchParamsRef.current({ widgets: current ? 'false' : null }, { replace: true });
        };

        const handleToggleGrid = () => {
            const current = new URLSearchParams(window.location.search).get('grid') !== 'false';
            updateSearchParamsRef.current({ grid: current ? 'false' : null }, { replace: true });
        };

        const handleToggleModifier = (e: CustomEvent<{ modifier: string }>) => {
            toggleModifierRef.current(e.detail.modifier);
        };

        window.addEventListener('Volt:toggle-widgets', handleToggleWidgets);
        window.addEventListener('Volt:toggle-grid', handleToggleGrid);
        window.addEventListener('Volt:toggle-modifier', handleToggleModifier as EventListener);

        return () => {
            window.removeEventListener('Volt:toggle-widgets', handleToggleWidgets);
            window.removeEventListener('Volt:toggle-grid', handleToggleGrid);
            window.removeEventListener('Volt:toggle-modifier', handleToggleModifier as EventListener);
        };
    }, []);
};

export default useCanvasShortcuts;
