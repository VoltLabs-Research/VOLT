import { row, PRESETS, checkbox, colorField, gridPosRows, gridRotRows } from '../../../CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';

import { useMemo } from 'react';
import { IoGridOutline } from 'react-icons/io5';
import { useShallow } from 'zustand/react/shallow';
import type { RenderGroup } from '../../types';

const useGridGroup = (): RenderGroup => {
    const s = useEditorStore(useShallow((state) => state.grid));

    return useMemo(() => {
        const sections = {
            general: {
                key: 'general', title: 'General', enabled: true,
                rows: [
                    row(PRESETS.cellSize, () => s.cellSize, (v: number) => s.setGrid({ cellSize: v })),
                    row(PRESETS.sectionSize, () => s.sectionSize, (v: number) => s.setGrid({ sectionSize: v })),
                    row(PRESETS.thickness('Cell Lines'), () => s.cellThickness, (v: number) => s.setGrid({ cellThickness: v })),
                    row(PRESETS.thickness('Section Lines'), () => s.sectionThickness, (v: number) => s.setGrid({ sectionThickness: v })),
                    row(PRESETS.fadeDistance, () => s.fadeDistance, (v: number) => s.setGrid({ fadeDistance: v })),
                    row(PRESETS.fadeStrength, () => s.fadeStrength, (v: number) => s.setGrid({ fadeStrength: v }))
                ],
                extras: (
                    <div className="volt-container canvas-render-grid">
                        {checkbox('enabled', 'Enabled', s.enabled, (v: boolean) => s.setGrid({ enabled: v }))}
                        {checkbox('infiniteGrid', 'Infinite Grid', s.infiniteGrid, (v: boolean) => s.setGrid({ infiniteGrid: v }))}
                    </div>
                )
            },
            appearance: {
                key: 'appearance', title: 'Colors', enabled: true,
                rows: [],
                extras: (
                    <div className="volt-container canvas-render-grid">
                        {colorField('sectionColor', 'Section Color', s.sectionColor, (v: string) => s.setGrid({ sectionColor: v }))}
                        {colorField('cellColor', 'Cell Color', s.cellColor, (v: string) => s.setGrid({ cellColor: v }))}
                    </div>
                )
            },
            transform: {
                key: 'transform', title: 'Transform', enabled: true,
                rows: [
                    ...gridPosRows(() => s.position, (position: [number, number, number]) => s.setGrid({ position })),
                    ...gridRotRows(() => s.rotation, (rotation: [number, number, number]) => s.setGrid({ rotation }))
                ]
            }
        };

        return {
            id: 'grid', title: 'Grid',
            icon: <IoGridOutline size={12} />,
            subsections: [
                { label: 'Settings', sections: [sections.general] },
                { label: 'Colors', sections: [sections.appearance] },
                { label: 'Transform', sections: [sections.transform] }
            ]
        };
    }, [s]);
};

export default useGridGroup;
