import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { IoGridOutline } from 'react-icons/io5';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import Container from '@/shared/presentation/components/Container';
import { row, PRESETS, checkbox, colorField, gridPosRows, gridRotRows } from '../../../../molecules/CanvasRenderConfigHelpers';
import type { RenderGroup } from '../../types';

const useGridGroup = (): RenderGroup => {
    const s = useEditorStore(useShallow((state) => state.grid));

    return useMemo(() => {
        const sections = {
            general: {
                key: 'general', title: 'General', enabled: true,
                rows: [
                    row(PRESETS.cellSize, () => s.cellSize, (v: number) => s.setCellSize(v)),
                    row(PRESETS.sectionSize, () => s.sectionSize, (v: number) => s.setSectionSize(v)),
                    row(PRESETS.thickness('Cell Lines'), () => s.cellThickness, (v: number) => s.setCellThickness(v)),
                    row(PRESETS.thickness('Section Lines'), () => s.sectionThickness, (v: number) => s.setSectionThickness(v)),
                    row(PRESETS.fadeDistance, () => s.fadeDistance, (v: number) => s.setFadeDistance(v)),
                    row(PRESETS.fadeStrength, () => s.fadeStrength, (v: number) => s.setFadeStrength(v))
                ],
                extras: (
                    <Container className="canvas-render-grid">
                        {checkbox('enabled', 'Enabled', s.enabled, s.setEnabled)}
                        {checkbox('infiniteGrid', 'Infinite Grid', s.infiniteGrid, s.setInfiniteGrid)}
                    </Container>
                )
            },
            appearance: {
                key: 'appearance', title: 'Colors', enabled: true,
                rows: [],
                extras: (
                    <Container className="canvas-render-grid">
                        {colorField('sectionColor', 'Section Color', s.sectionColor, (v: string) => s.setSectionColor(v))}
                        {colorField('cellColor', 'Cell Color', s.cellColor, (v: string) => s.setCellColor(v))}
                    </Container>
                )
            },
            transform: {
                key: 'transform', title: 'Transform', enabled: true,
                rows: [
                    ...gridPosRows(() => s.position, s.setPosition),
                    ...gridRotRows(() => s.rotation, s.setRotation)
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
