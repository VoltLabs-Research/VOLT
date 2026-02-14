import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MdLightbulb } from 'react-icons/md';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import type { DirLight, PointLight, SpotLight, HemiLight, RectAreaLightCfg } from '@/modules/fractal/presentation/types/stores/editor/visual-types';
import { row, PRESETS, positionRows, vec3Rows, colorExtras } from '../../../../molecules/CanvasRenderConfigHelpers';
import type { RenderGroup } from '../../types';

type Vec3 = [number, number, number];

const setVec3 = <T extends { position: Vec3 }>(
    setter: (patch: Partial<T>) => void,
    current: Vec3,
    axis: number,
    value: number
) => {
    const next: Vec3 = [...current] as Vec3;
    next[axis] = value;
    setter({ position: next } as Partial<T>);
};

const useLightsGroup = (): RenderGroup => {
    const st = useEditorStore(useShallow((s) => s.lights));
    const { setGlobal, setDirectional, setPoint, setSpot, setHemisphere, setRectArea } = st;

    return useMemo(() => {
        const sections = {
            global: {
                key: 'global', title: 'Global IBL', enabled: true,
                rows: [
                    row(PRESETS.intensity(), () => st.global.envIntensity, (v: number) => setGlobal({ envIntensity: v })),
                    row({ label: 'Blur', min: 0, max: 1, step: 0.01, decimals: 2 }, () => st.global.envBlur, (v: number) => setGlobal({ envBlur: v }))
                ]
            },
            directional: {
                key: 'dir', title: 'Directional', enabled: st.directional.enabled,
                onToggle: (enabled: boolean) => setDirectional({ enabled }),
                rows: [
                    row(PRESETS.intensity(20), () => st.directional.intensity, (v: number) => setDirectional({ intensity: v })),
                    ...positionRows(() => st.directional.position, (i: number, v: number) => setVec3<DirLight>(setDirectional, st.directional.position, i, v))
                ],
                extras: colorExtras(
                    { key: 'dirColor', label: 'Color', value: st.directional.color, onChange: (v: string) => setDirectional({ color: v }) },
                    [
                        { key: 'dirCast', label: 'Cast Shadow', value: st.directional.castShadow, onChange: (v: boolean) => setDirectional({ castShadow: v }) },
                        { key: 'dirHelper', label: 'Helper', value: st.directional.helper, onChange: (v: boolean) => setDirectional({ helper: v }) }
                    ]
                )
            },
            point: {
                key: 'point', title: 'Point', enabled: st.point.enabled,
                onToggle: (enabled: boolean) => setPoint({ enabled }),
                rows: [
                    row(PRESETS.intensity(200), () => st.point.intensity, (v: number) => setPoint({ intensity: v })),
                    row(PRESETS.distance, () => st.point.distance, (v: number) => setPoint({ distance: v })),
                    row(PRESETS.decay, () => st.point.decay, (v: number) => setPoint({ decay: v })),
                    ...positionRows(() => st.point.position, (i: number, v: number) => setVec3<PointLight>(setPoint, st.point.position, i, v))
                ],
                extras: colorExtras(
                    { key: 'pColor', label: 'Color', value: st.point.color, onChange: (v: string) => setPoint({ color: v }) },
                    [
                        { key: 'pCast', label: 'Cast Shadow', value: st.point.castShadow, onChange: (v: boolean) => setPoint({ castShadow: v }) },
                        { key: 'pHelper', label: 'Helper', value: st.point.helper, onChange: (v: boolean) => setPoint({ helper: v }) }
                    ]
                )
            },
            spot: {
                key: 'spot', title: 'Spot', enabled: st.spot.enabled,
                onToggle: (enabled: boolean) => setSpot({ enabled }),
                rows: [
                    row(PRESETS.intensity(200), () => st.spot.intensity, (v: number) => setSpot({ intensity: v })),
                    row(PRESETS.angle, () => st.spot.angle, (v: number) => setSpot({ angle: v })),
                    row(PRESETS.penumbra, () => st.spot.penumbra, (v: number) => setSpot({ penumbra: v })),
                    row(PRESETS.distance, () => st.spot.distance, (v: number) => setSpot({ distance: v })),
                    ...positionRows(() => st.spot.position, (i: number, v: number) => setVec3<SpotLight>(setSpot, st.spot.position, i, v)),
                    ...vec3Rows('Target', () => st.spot.target, (i: number, v: number) => {
                        const next = [...st.spot.target] as Vec3;
                        next[i] = v;
                        setSpot({ target: next });
                    })
                ],
                extras: colorExtras(
                    { key: 'sColor', label: 'Color', value: st.spot.color, onChange: (v: string) => setSpot({ color: v }) },
                    [
                        { key: 'sCast', label: 'Cast Shadow', value: st.spot.castShadow, onChange: (v: boolean) => setSpot({ castShadow: v }) },
                        { key: 'sHelper', label: 'Helper', value: st.spot.helper, onChange: (v: boolean) => setSpot({ helper: v }) }
                    ]
                )
            },
            hemisphere: {
                key: 'hemi', title: 'Hemisphere', enabled: st.hemisphere.enabled,
                onToggle: (enabled: boolean) => setHemisphere({ enabled }),
                rows: [
                    row(PRESETS.intensity(), () => st.hemisphere.intensity, (v: number) => setHemisphere({ intensity: v })),
                    ...positionRows(() => st.hemisphere.position, (i: number, v: number) => setVec3<HemiLight>(setHemisphere, st.hemisphere.position, i, v))
                ],
                extras: (
                    <div className="canvas-render-grid">
                        {colorExtras(
                            { key: 'hSky', label: 'Sky Color', value: st.hemisphere.skyColor, onChange: (v: string) => setHemisphere({ skyColor: v }) },
                            []
                        )}
                        {colorExtras(
                            { key: 'hGroundColor', label: 'Ground Color', value: st.hemisphere.groundColor, onChange: (v: string) => setHemisphere({ groundColor: v }) },
                            []
                        )}
                    </div>
                )
            },
            rectArea: {
                key: 'rect', title: 'Rect Area', enabled: st.rectArea.enabled,
                onToggle: (enabled: boolean) => setRectArea({ enabled }),
                rows: [
                    row(PRESETS.intensity(500), () => st.rectArea.intensity, (v: number) => setRectArea({ intensity: v })),
                    row(PRESETS.width, () => st.rectArea.width, (v: number) => setRectArea({ width: v })),
                    row(PRESETS.height, () => st.rectArea.height, (v: number) => setRectArea({ height: v })),
                    ...positionRows(() => st.rectArea.position, (i: number, v: number) => setVec3<RectAreaLightCfg>(setRectArea, st.rectArea.position, i, v)),
                    ...vec3Rows('Look', () => st.rectArea.lookAt, (i: number, v: number) => {
                        const next = [...st.rectArea.lookAt] as Vec3;
                        next[i] = v;
                        setRectArea({ lookAt: next });
                    })
                ],
                extras: colorExtras(
                    { key: 'rColor', label: 'Color', value: st.rectArea.color, onChange: (v: string) => setRectArea({ color: v }) },
                    [{ key: 'rHelper', label: 'Helper', value: st.rectArea.helper, onChange: (v: boolean) => setRectArea({ helper: v }) }]
                )
            }
        };

        return {
            id: 'lights', title: 'Lights',
            icon: <MdLightbulb size={12} />,
            subsections: [
                { label: 'Global IBL', sections: [sections.global] },
                { label: 'Directional Light', sections: [sections.directional] },
                { label: 'Point Light', sections: [sections.point] },
                { label: 'Spot Light', sections: [sections.spot] },
                { label: 'Hemisphere Light', sections: [sections.hemisphere] },
                { label: 'Rect Area Light', sections: [sections.rectArea] }
            ]
        };
    }, [st.global, st.directional, st.point, st.spot, st.hemisphere, st.rectArea]);
};

export default useLightsGroup;
