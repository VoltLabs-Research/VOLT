import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MdRotateLeft } from 'react-icons/md';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { row, PRESETS, checkbox, checkboxGrid, targetRows } from '../../../../molecules/CanvasRenderConfigHelpers';
import type { RenderGroup } from '../../types';

const useOrbitGroup = (): RenderGroup => {
    const s = useEditorStore(useShallow((state) => state.orbitControls));

    return useMemo(() => {
        const sections = {
            general: {
                key: 'general', title: 'OrbitControls', enabled: true,
                rows: [],
                extras: (
                    <Container className="canvas-render-grid">
                        {checkboxGrid([
                            { key: 'enabled', label: 'Enabled', value: s.enabled, onChange: (v: boolean) => s.set({ enabled: v }) },
                            { key: 'autoRotate', label: 'Auto Rotate', value: s.autoRotate, onChange: (v: boolean) => s.set({ autoRotate: v }) },
                            { key: 'enableDamping', label: 'Enable Damping', value: s.enableDamping, onChange: (v: boolean) => s.set({ enableDamping: v }) },
                            { key: 'enableZoom', label: 'Enable Zoom', value: s.enableZoom, onChange: (v: boolean) => s.set({ enableZoom: v }) },
                            { key: 'enableRotate', label: 'Enable Rotate', value: s.enableRotate, onChange: (v: boolean) => s.set({ enableRotate: v }) },
                            { key: 'enablePan', label: 'Enable Pan', value: s.enablePan, onChange: (v: boolean) => s.set({ enablePan: v }) }
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
                ],
                extras: checkbox('screenSpacePanning', 'Screen Space Panning', s.screenSpacePanning, (v: boolean) => s.set({ screenSpacePanning: v }))
            },
            limits: {
                key: 'limits', title: 'Limits', enabled: true,
                rows: [
                    row({ label: 'Min Distance', min: 0.001, max: Math.max(10, s.maxDistance), step: 0.001, decimals: 3 }, () => s.minDistance, (v: number) => s.set({ minDistance: v })),
                    row({ label: 'Max Distance', min: Math.max(0.001, s.minDistance + 0.001), max: 100000, step: 0.1, decimals: 1 }, () => s.maxDistance, (v: number) => s.set({ maxDistance: v })),
                    row({ label: 'Min Polar(rad)', min: 0, max: Math.PI, step: 0.001, decimals: 3 }, () => s.minPolarAngle, (v: number) => s.set({ minPolarAngle: v })),
                    row({ label: 'Max Polar(rad)', min: 0, max: Math.PI, step: 0.001, decimals: 3 }, () => s.maxPolarAngle, (v: number) => s.set({ maxPolarAngle: v })),
                    row({ label: 'Min Azimuth(rad)', min: -Math.PI * 1000, max: Math.PI * 1000, step: 0.001, decimals: 3 }, () => s.minAzimuthAngle, (v: number) => s.set({ minAzimuthAngle: v })),
                    row({ label: 'Max Azimuth(rad)', min: -Math.PI * 1000, max: Math.PI * 1000, step: 0.001, decimals: 3 }, () => s.maxAzimuthAngle, (v: number) => s.set({ maxAzimuthAngle: v }))
                ],
                extras: null
            },
            target: {
                key: 'target', title: 'Target(Z-up)', enabled: true,
                rows: targetRows(() => s.target, s.setTarget),
                extras: null
            }
        };

        return {
            id: 'orbit', title: 'Orbit Controls',
            icon: <MdRotateLeft size={12} />,
            subsections: [
                { label: 'General Settings', sections: [sections.general] },
                { label: 'Movement Speeds', sections: [sections.speeds] },
                { label: 'Distance & Angle Limits', sections: [sections.limits] },
                { label: 'Target Position', sections: [sections.target] }
            ]
        };
    }, [s]);
};

export default useOrbitGroup;
