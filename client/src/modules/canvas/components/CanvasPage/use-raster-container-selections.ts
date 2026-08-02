import { createInitialRasterContainerSelections } from '@/modules/raster/contracts/container-selection';
import { useCallback, useState } from 'react';

import type { RasterContainerId, RasterContainerSelection } from '@/modules/raster/contracts/container-selection';

/** Tracks what each raster container renders and which one the right panel edits. */
const useRasterContainerSelections = () => {
    const [selections, setSelections] = useState<RasterContainerSelection[]>(createInitialRasterContainerSelections);
    const [activeContainerId, setActiveContainerId] = useState<RasterContainerId>('container-1');

    const updateSelection = useCallback((containerId: RasterContainerId, updates: Partial<RasterContainerSelection>) => {
        setSelections((currentSelections) => currentSelections.map((selection) => {
            if (selection.id !== containerId) {
                return selection;
            }

            return {
                ...selection,
                ...updates
            };
        }));
    }, []);

    return {
        selections,
        activeContainerId,
        setActiveContainerId,
        updateSelection
    };
};

export default useRasterContainerSelections;
