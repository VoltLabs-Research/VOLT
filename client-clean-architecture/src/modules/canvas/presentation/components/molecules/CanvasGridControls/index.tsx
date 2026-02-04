import React, { memo } from 'react';
import SettingsPanel from '@/modules/canvas/presentation/components/molecules/SettingsPanel';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import { MdSettings, MdStraighten, MdOpacity, MdColorLens, MdTransform } from 'react-icons/md';
import { IoGridOutline } from 'react-icons/io5';
import { row, PRESETS, gridPosRows, gridRotRows, checkboxWithDesc, colorField } from '../controls/config-helpers';

const CanvasGridControls: React.FC = () => {
    const s = useEditorStore(useShallow((s) => s.grid));

    const sections = {
        general: {
            key: 'general',
            title: 'General Settings',
            enabled: true,
            rows: [],
            extras: (
                <div style={{ display: 'grid', gap: 12 }}>
                    {checkboxWithDesc('enabled', 'Enabled', 'Show/hide the canvas grid', s.enabled, s.setEnabled)}
                    {checkboxWithDesc('infiniteGrid', 'Infinite Grid', 'Extend grid infinitely in all directions', s.infiniteGrid, s.setInfiniteGrid)}
                </div>
            )
        },
        size: {
            key: 'size',
            title: 'Size & Spacing',
            enabled: true,
            rows: [
                row(PRESETS.cellSize, () => s.cellSize, s.setCellSize),
                row(PRESETS.sectionSize, () => s.sectionSize, s.setSectionSize)
            ],
            extras: null
        },
        thickness: {
            key: 'thickness',
            title: 'Line Thickness',
            enabled: true,
            rows: [
                row(PRESETS.thickness('Cell Thickness'), () => s.cellThickness, s.setCellThickness),
                row(PRESETS.thickness('Section Thickness'), () => s.sectionThickness, s.setSectionThickness)
            ],
            extras: null
        },
        fade: {
            key: 'fade',
            title: 'Fade Settings',
            enabled: true,
            rows: [
                row(PRESETS.fadeDistance, () => s.fadeDistance, s.setFadeDistance),
                row(PRESETS.fadeStrength, () => s.fadeStrength, s.setFadeStrength)
            ],
            extras: null
        },
        color: {
            key: 'color',
            title: 'Colors',
            enabled: true,
            rows: [],
            extras: (
                <div style={{ display: 'grid', gap: 12 }}>
                    {colorField('sectionColor', 'Section Color', s.sectionColor, s.setSectionColor, 'Color of major grid lines(sections)')}
                    {colorField('cellColor', 'Cell Color', s.cellColor, s.setCellColor, 'Color of minor grid lines(cells)')}
                </div>
            )
        },
        transform: {
            key: 'transform',
            title: 'Transform',
            enabled: true,
            rows: [
                ...gridPosRows(() => s.position, s.setPosition),
                ...gridRotRows(() => s.rotation, s.setRotation)
            ],
            extras: null
        }
    };

    return (
        <SettingsPanel
            title='Canvas Grid'
            icon={<IoGridOutline size={16} />}
            subsections={[
                { label: 'General Settings', icon: <MdSettings size={14} />, sections: [sections.general] },
                { label: 'Size & Spacing', icon: <IoGridOutline size={14} />, sections: [sections.size] },
                { label: 'Line Thickness', icon: <MdStraighten size={14} />, sections: [sections.thickness] },
                { label: 'Fade Settings', icon: <MdOpacity size={14} />, sections: [sections.fade] },
                { label: 'Colors', icon: <MdColorLens size={14} />, sections: [sections.color] },
                { label: 'Transform', icon: <MdTransform size={14} />, sections: [sections.transform] }
            ]}
        />
    );
};

export default memo(CanvasGridControls);
