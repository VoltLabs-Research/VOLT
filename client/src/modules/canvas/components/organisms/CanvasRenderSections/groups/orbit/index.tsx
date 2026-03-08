import { row, PRESETS, checkboxGrid, targetRows } from '../../../../molecules/CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';

import { useMemo } from 'react';
import { MdRotateLeft } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';

import type { RenderGroup } from '../../types';

const useOrbitGroup = (): RenderGroup => {
    const s = useEditorStore(useShallow((state) => state.orbitControls));

    return useMemo(() => {
        const sections = {
            general: {
                key: 'general', title: 'Controls', enabled: true,
                rows: [],
                extras: (
                    <Container className="canvas-render-grid">
                        {checkboxGrid([
                            { key: 'enabled', label: 'Enabled', value: s.enabled, onChange: (v: boolean) => s.set({ enabled: v }) },
                            { key: 'autoRotate', label: 'Auto Rotate', value: s.autoRotate, onChange: (v: boolean) => s.set({ autoRotate: v }) },
                            { key: 'enableDamping', label: 'Damping', value: s.enableDamping, onChange: (v: boolean) => s.set({ enableDamping: v }) },
                            { key: 'enableZoom', label: 'Zoom', value: s.enableZoom, onChange: (v: boolean) => s.set({ enableZoom: v }) },
                            { key: 'enableRotate', label: 'Rotate', value: s.enableRotate, onChange: (v: boolean) => s.set({ enableRotate: v }) },
                            { key: 'enablePan', label: 'Pan', value: s.enablePan, onChange: (v: boolean) => s.set({ enablePan: v }) }
                        ])}
                        <Button variant="ghost" intent="canvas" shape="rounded" size="sm" className="font-size-05" onClick={() => s.reset()} style={{ justifySelf: 'start' }}>
                            Reset Orbit
                        </Button>
                    </Container>
                )
            },
            speeds: {
                key: 'speeds', title: 'Speeds', enabled: true,
                rows: [
                    row(PRESETS.speed('Rotate Speed'), () => s.rotateSpeed, (v: number) => s.set({ rotateSpeed: v })),
                    row(PRESETS.speed('Zoom Speed'), () => s.zoomSpeed, (v: number) => s.set({ zoomSpeed: v })),
                    row(PRESETS.speed('Pan Speed'), () => s.panSpeed, (v: number) => s.set({ panSpeed: v })),
                    row(PRESETS.speed('Auto Rotate Speed', 20), () => s.autoRotateSpeed, (v: number) => s.set({ autoRotateSpeed: v })),
                    row(PRESETS.factor('Damping Factor'), () => s.dampingFactor, (v: number) => s.set({ dampingFactor: v }))
                ]
            },
            limits: {
                key: 'limits', title: 'Limits', enabled: true,
                rows: [
                    row({ label: 'Min Distance', min: 0.001, max: Math.max(10, s.maxDistance), step: 0.001, decimals: 3 }, () => s.minDistance, (v: number) => s.set({ minDistance: v })),
                    row({ label: 'Max Distance', min: Math.max(0.001, s.minDistance + 0.001), max: 100000, step: 0.1, decimals: 1 }, () => s.maxDistance, (v: number) => s.set({ maxDistance: v }))
                ]
            },
            target: {
                key: 'target', title: 'Target', enabled: true,
                rows: targetRows(() => s.target, s.setTarget)
            }
        };

        return {
            id: 'orbit', title: 'Orbit Controls',
            icon: <MdRotateLeft size={12} />,
            subsections: [
                { label: 'Controls', sections: [sections.general] },
                { label: 'Speeds', sections: [sections.speeds] },
                { label: 'Distance Limits', sections: [sections.limits] },
                { label: 'Target', sections: [sections.target] }
            ]
        };
    }, [s]);
};

export default useOrbitGroup;
