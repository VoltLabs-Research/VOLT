import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MdLightbulb } from 'react-icons/md';
import SettingsPanel from '@/modules/canvas/presentation/components/molecules/SettingsPanel';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import { row, PRESETS, positionRows, vec3Rows, colorExtras } from '@/modules/canvas/presentation/components/molecules/controls/config-helpers';

const LightsControls = () => {
    const st = useEditorStore(useShallow((s) => s.lights));
    const { setGlobal, setDirectional, setPoint, setSpot, setHemisphere, setRectArea } = st;

    const setVec3 = (setter: (p: any) => void, current: number[], axis: number, v: number) => {
        const next = [...current];
        next[axis] = v;
        setter({ position: next });
    };

    const sections = {
        global: {
            key: 'global',
            title: 'Global IBL',
            enabled: true,
            rows: [
                row(PRESETS.intensity(), () => st.global.envIntensity, (v) => setGlobal({ envIntensity: v })),
                row({ label: 'Yaw(rad)', min: -Math.PI, max: Math.PI, step: 0.01 }, () => st.global.envRotationYaw, (v) => setGlobal({ envRotationYaw: v })),
                row({ label: 'Pitch(rad)', min: -Math.PI / 2, max: Math.PI / 2, step: 0.01 }, () => st.global.envRotationPitch, (v) => setGlobal({ envRotationPitch: v })),
                row({ label: 'Blur', min: 0, max: 1, step: 0.01 }, () => st.global.envBlur, (v) => setGlobal({ envBlur: v }))
            ]
        },
        directional: {
            key: 'dir',
            title: 'Directional',
            enabled: st.directional.enabled,
            onToggle: (enabled: boolean) => setDirectional({ enabled }),
            rows: [
                row(PRESETS.intensity(20), () => st.directional.intensity, (v) => setDirectional({ intensity: v })),
                ...positionRows(() => st.directional.position, (i, v) => setVec3(setDirectional, st.directional.position, i, v)),
                row({ label: 'Shadow Bias', min: -0.01, max: 0.01, step: 0.0001, decimals: 4 }, () => st.directional.shadowBias, (v) => setDirectional({ shadowBias: v })),
                row({ label: 'Normal Bias', min: 0, max: 1, step: 0.001, decimals: 3 }, () => st.directional.shadowNormalBias, (v) => setDirectional({ shadowNormalBias: v })),
                row({ label: 'Cam Near', min: 0.01, max: 1000, step: 0.01 }, () => st.directional.camNear, (v) => setDirectional({ camNear: v })),
                row({ label: 'Cam Far', min: 0.1, max: 5000, step: 0.1, decimals: 1 }, () => st.directional.camFar, (v) => setDirectional({ camFar: v })),
                row({ label: 'Cam Left', min: -1000, max: 0, step: 0.1, decimals: 1 }, () => st.directional.camLeft, (v) => setDirectional({ camLeft: v })),
                row({ label: 'Cam Right', min: 0, max: 1000, step: 0.1, decimals: 1 }, () => st.directional.camRight, (v) => setDirectional({ camRight: v })),
                row({ label: 'Cam Top', min: 0, max: 1000, step: 0.1, decimals: 1 }, () => st.directional.camTop, (v) => setDirectional({ camTop: v })),
                row({ label: 'Cam Bottom', min: -1000, max: 0, step: 0.1, decimals: 1 }, () => st.directional.camBottom, (v) => setDirectional({ camBottom: v }))
            ],
            extras: colorExtras(
                { key: 'dirColor', label: 'Color', value: st.directional.color, onChange: (v) => setDirectional({ color: v }) },
                [
                    { key: 'dirCast', label: 'Cast Shadow', value: st.directional.castShadow, onChange: (v) => setDirectional({ castShadow: v }) },
                    { key: 'dirHelper', label: 'Helper', value: st.directional.helper, onChange: (v) => setDirectional({ helper: v }) }
                ]
            )
        },
        point: {
            key: 'point',
            title: 'Point',
            enabled: st.point.enabled,
            onToggle: (enabled: boolean) => setPoint({ enabled }),
            rows: [
                row(PRESETS.intensity(200), () => st.point.intensity, (v) => setPoint({ intensity: v })),
                row(PRESETS.distance, () => st.point.distance, (v) => setPoint({ distance: v })),
                row(PRESETS.decay, () => st.point.decay, (v) => setPoint({ decay: v })),
                ...positionRows(() => st.point.position, (i, v) => setVec3(setPoint, st.point.position, i, v))
            ],
            extras: colorExtras(
                { key: 'pColor', label: 'Color', value: st.point.color, onChange: (v) => setPoint({ color: v }) },
                [
                    { key: 'pCast', label: 'Cast Shadow', value: st.point.castShadow, onChange: (v) => setPoint({ castShadow: v }) },
                    { key: 'pHelper', label: 'Helper', value: st.point.helper, onChange: (v) => setPoint({ helper: v }) }
                ]
            )
        },
        spot: {
            key: 'spot',
            title: 'Spot',
            enabled: st.spot.enabled,
            onToggle: (enabled: boolean) => setSpot({ enabled }),
            rows: [
                row(PRESETS.intensity(200), () => st.spot.intensity, (v) => setSpot({ intensity: v })),
                row(PRESETS.angle, () => st.spot.angle, (v) => setSpot({ angle: v })),
                row(PRESETS.penumbra, () => st.spot.penumbra, (v) => setSpot({ penumbra: v })),
                row(PRESETS.distance, () => st.spot.distance, (v) => setSpot({ distance: v })),
                row(PRESETS.decay, () => st.spot.decay, (v) => setSpot({ decay: v })),
                ...positionRows(() => st.spot.position, (i, v) => setVec3(setSpot, st.spot.position, i, v)),
                ...vec3Rows('Target', () => st.spot.target, (i, v) => {
                    const next = [...st.spot.target] as [number, number, number];
                    next[i] = v;
                    setSpot({ target: next });
                })
            ],
            extras: colorExtras(
                { key: 'sColor', label: 'Color', value: st.spot.color, onChange: (v) => setSpot({ color: v }) },
                [
                    { key: 'sCast', label: 'Cast Shadow', value: st.spot.castShadow, onChange: (v) => setSpot({ castShadow: v }) },
                    { key: 'sHelper', label: 'Helper', value: st.spot.helper, onChange: (v) => setSpot({ helper: v }) }
                ]
            )
        },
        hemisphere: {
            key: 'hemi',
            title: 'Hemisphere',
            enabled: st.hemisphere.enabled,
            onToggle: (enabled: boolean) => setHemisphere({ enabled }),
            rows: [
                row(PRESETS.intensity(), () => st.hemisphere.intensity, (v) => setHemisphere({ intensity: v })),
                ...positionRows(() => st.hemisphere.position, (i, v) => setVec3(setHemisphere, st.hemisphere.position, i, v))
            ],
            extras: colorExtras(
                { key: 'hSky', label: 'Sky', value: st.hemisphere.skyColor, onChange: (v: string) => setHemisphere({ skyColor: v }) },
                [
                    { key: 'hGround', label: 'Ground', value: st.hemisphere.groundColor, onChange: (v: boolean) => setHemisphere({ groundColor: v as unknown as string }) },
                    { key: 'hHelper', label: 'Helper', value: st.hemisphere.helper, onChange: (v: boolean) => setHemisphere({ helper: v }) }
                ]
            )
        },
        rectArea: {
            key: 'rect',
            title: 'Rect Area',
            enabled: st.rectArea.enabled,
            onToggle: (enabled: boolean) => setRectArea({ enabled }),
            rows: [
                row(PRESETS.intensity(500), () => st.rectArea.intensity, (v) => setRectArea({ intensity: v })),
                row(PRESETS.width, () => st.rectArea.width, (v) => setRectArea({ width: v })),
                row(PRESETS.height, () => st.rectArea.height, (v) => setRectArea({ height: v })),
                ...positionRows(() => st.rectArea.position, (i, v) => setVec3(setRectArea, st.rectArea.position, i, v)),
                ...vec3Rows('Look', () => st.rectArea.lookAt, (i, v) => {
                    const next = [...st.rectArea.lookAt] as [number, number, number];
                    next[i] = v;
                    setRectArea({ lookAt: next });
                })
            ],
            extras: colorExtras(
                { key: 'rColor', label: 'Color', value: st.rectArea.color, onChange: (v) => setRectArea({ color: v }) },
                [{ key: 'rHelper', label: 'Helper', value: st.rectArea.helper, onChange: (v) => setRectArea({ helper: v }) }]
            )
        }
    };

    return (
        <SettingsPanel
            title='Lights'
            icon={<MdLightbulb size={16} />}
            subsections={[
                { label: 'Global IBL (Image Based Lighting)', sections: [sections.global] },
                { label: 'Directional Light (Sun-like)', sections: [sections.directional] },
                { label: 'Point Light (Omnidirectional)', sections: [sections.point] },
                { label: 'Spot Light (Cone-shaped)', sections: [sections.spot] },
                { label: 'Hemisphere Light (Sky + Ground)', sections: [sections.hemisphere] },
                { label: 'Rect Area Light (Rectangular)', sections: [sections.rectArea] }
            ]}
        />
    );
};

export default memo(LightsControls);
