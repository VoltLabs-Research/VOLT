import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { IoGridOutline } from 'react-icons/io5';
import { MdSettings, MdStraighten, MdOpacity, MdColorLens, MdTransform } from 'react-icons/md';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import Container from '@/shared/presentation/components/Container';
import { row, PRESETS, checkboxWithDesc, colorField, gridPosRows, gridRotRows } from '../../../../molecules/CanvasRenderConfigHelpers';
import type { RenderGroup } from '../../types';

const useGridGroup = (): RenderGroup => {
    const s = useEditorStore(useShallow((state) => state.grid));

    return useMemo(() => {
        const sections = {
            general: {
                key: 'general', title: 'General Settings', enabled: true,
                rows: [],
                extras: (
                    <Container className="canvas-render-grid canvas-render-grid--md">
                        {checkboxWithDesc('enabled', 'Enabled', 'Show/hide the canvas grid', s.enabled, s.setEnabled)}
                        {checkboxWithDesc('infiniteGrid', 'Infinite Grid', 'Extend grid infinitely in all directions', s.infiniteGrid, s.setInfiniteGrid)}
                    </Container>
                )
            },
            size: {
                key: 'size', title: 'Size & Spacing', enabled: true,
                rows: [
                    row(PRESETS.cellSize, () => s.cellSize, (v: number) => s.setCellSize(v)),
                    row(PRESETS.sectionSize, () => s.sectionSize, (v: number) => s.setSectionSize(v))
                ],
                extras: null
            },
            thickness: {
                key: 'thickness', title: 'Line Thickness', enabled: true,
                rows: [
                    row(PRESETS.thickness('Cell Thickness'), () => s.cellThickness, (v: number) => s.setCellThickness(v)),
                    row(PRESETS.thickness('Section Thickness'), () => s.sectionThickness, (v: number) => s.setSectionThickness(v))
                ],
                extras: null
            },
            fade: {
                key: 'fade', title: 'Fade Settings', enabled: true,
                rows: [
                    row(PRESETS.fadeDistance, () => s.fadeDistance, (v: number) => s.setFadeDistance(v)),
                    row(PRESETS.fadeStrength, () => s.fadeStrength, (v: number) => s.setFadeStrength(v))
                ],
                extras: null
            },
            color: {
                key: 'color', title: 'Colors', enabled: true,
                rows: [],
                extras: (
                    <Container className="canvas-render-grid canvas-render-grid--md">
                        {colorField('sectionColor', 'Section Color', s.sectionColor, (v: string) => s.setSectionColor(v), 'Color of major grid lines(sections)')}
                        {colorField('cellColor', 'Cell Color', s.cellColor, (v: string) => s.setCellColor(v), 'Color of minor grid lines(cells)')}
                    </Container>
                )
            },
            transform: {
                key: 'transform', title: 'Transform', enabled: true,
                rows: [
                    ...gridPosRows(() => s.position, s.setPosition),
                    ...gridRotRows(() => s.rotation, s.setRotation)
                ],
                extras: null
            }
        };

        return {
            id: 'grid', title: 'Grid',
            icon: <IoGridOutline size={12} />,
            subsections: [
                { label: 'General Settings', icon: <MdSettings size={14} />, sections: [sections.general] },
                { label: 'Size & Spacing', icon: <IoGridOutline size={14} />, sections: [sections.size] },
                { label: 'Line Thickness', icon: <MdStraighten size={14} />, sections: [sections.thickness] },
                { label: 'Fade Settings', icon: <MdOpacity size={14} />, sections: [sections.fade] },
                { label: 'Colors', icon: <MdColorLens size={14} />, sections: [sections.color] },
                { label: 'Transform', icon: <MdTransform size={14} />, sections: [sections.transform] }
            ]
        };
    }, [s]);
};

export default useGridGroup;
