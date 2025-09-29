// src/components/molecules/controls/LightsControls.tsx
import React from 'react';
import FormSchema from '@/components/atoms/form/FormSchema';
import FormField from '@/components/molecules/FormField';
import CollapsibleSection from '@/components/atoms/CollapsibleSection';
import useLightsStore from '@/stores/editor/lights-config';
import { MdLightbulb } from 'react-icons/md';

const LightsControls: React.FC = () => {
    const st = useLightsStore();
    const setGlobal = useLightsStore(v => v.setGlobal);
    const setDirectional = useLightsStore(v => v.setDirectional);
    const setPoint = useLightsStore(v => v.setPoint);
    const setSpot = useLightsStore(v => v.setSpot);
    const setHemisphere = useLightsStore(v => v.setHemisphere);
    const setRectArea = useLightsStore(v => v.setRectArea);

    const global = {
        key: 'global',
        title: 'Global IBL',
        enabled: true,
        onToggle: () => {},
        rows: [
            { label: 'Intensity', min: 0, max: 10, step: 0.01, get: () => st.global.envIntensity, set: (v: number) => setGlobal({ envIntensity: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Yaw (rad)', min: -Math.PI, max: Math.PI, step: 0.01, get: () => st.global.envRotationYaw, set: (v: number) => setGlobal({ envRotationYaw: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Pitch (rad)', min: -Math.PI / 2, max: Math.PI / 2, step: 0.01, get: () => st.global.envRotationPitch, set: (v: number) => setGlobal({ envRotationPitch: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Blur', min: 0, max: 1, step: 0.01, get: () => st.global.envBlur, set: (v: number) => setGlobal({ envBlur: v }), format: (v: number) => v.toFixed(2) }
        ]
    };

    const dir = {
        key: 'dir',
        title: 'Directional',
        enabled: st.directional.enabled,
        onToggle: (en: boolean) => setDirectional({ enabled: en }),
        rows: [
            { label: 'Intensity', min: 0, max: 20, step: 0.01, get: () => st.directional.intensity, set: (v: number) => setDirectional({ intensity: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Pos X', min: -1000, max: 1000, step: 0.1, get: () => st.directional.position[0], set: (v: number) => setDirectional({ position: [v, st.directional.position[1], st.directional.position[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Pos Y', min: -1000, max: 1000, step: 0.1, get: () => st.directional.position[1], set: (v: number) => setDirectional({ position: [st.directional.position[0], v, st.directional.position[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Pos Z', min: -1000, max: 1000, step: 0.1, get: () => st.directional.position[2], set: (v: number) => setDirectional({ position: [st.directional.position[0], st.directional.position[1], v] }), format: (v: number) => v.toFixed(1) },
            { label: 'Shadow Bias', min: -0.01, max: 0.01, step: 0.0001, get: () => st.directional.shadowBias, set: (v: number) => setDirectional({ shadowBias: v }), format: (v: number) => v.toFixed(4) },
            { label: 'Normal Bias', min: 0, max: 1, step: 0.001, get: () => st.directional.shadowNormalBias, set: (v: number) => setDirectional({ shadowNormalBias: v }), format: (v: number) => v.toFixed(3) },
            { label: 'Cam Near', min: 0.01, max: 1000, step: 0.01, get: () => st.directional.camNear, set: (v: number) => setDirectional({ camNear: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Cam Far', min: 0.1, max: 5000, step: 0.1, get: () => st.directional.camFar, set: (v: number) => setDirectional({ camFar: v }), format: (v: number) => v.toFixed(1) },
            { label: 'Cam Left', min: -1000, max: 0, step: 0.1, get: () => st.directional.camLeft, set: (v: number) => setDirectional({ camLeft: v }), format: (v: number) => v.toFixed(1) },
            { label: 'Cam Right', min: 0, max: 1000, step: 0.1, get: () => st.directional.camRight, set: (v: number) => setDirectional({ camRight: v }), format: (v: number) => v.toFixed(1) },
            { label: 'Cam Top', min: 0, max: 1000, step: 0.1, get: () => st.directional.camTop, set: (v: number) => setDirectional({ camTop: v }), format: (v: number) => v.toFixed(1) },
            { label: 'Cam Bottom', min: -1000, max: 0, step: 0.1, get: () => st.directional.camBottom, set: (v: number) => setDirectional({ camBottom: v }), format: (v: number) => v.toFixed(1) }
        ],
        extras: (
            <div style={{ display: 'grid', gap: 8 }}>
                <FormField fieldKey="dirColor" label="Color" fieldType="color" fieldValue={st.directional.color} onFieldChange={(_, v) => setDirectional({ color: String(v) })} />
                <FormField fieldKey="dirCast" label="Cast Shadow" fieldType="checkbox" fieldValue={st.directional.castShadow} onFieldChange={(_, v) => setDirectional({ castShadow: !!v })} />
                <FormField fieldKey="dirHelper" label="Helper" fieldType="checkbox" fieldValue={st.directional.helper} onFieldChange={(_, v) => setDirectional({ helper: !!v })} />
            </div>
        )
    };

    const point = {
        key: 'point',
        title: 'Point',
        enabled: st.point.enabled,
        onToggle: (en: boolean) => setPoint({ enabled: en }),
        rows: [
            { label: 'Intensity', min: 0, max: 200, step: 0.01, get: () => st.point.intensity, set: (v: number) => setPoint({ intensity: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Distance', min: 0, max: 1000, step: 0.1, get: () => st.point.distance, set: (v: number) => setPoint({ distance: v }), format: (v: number) => v.toFixed(1) },
            { label: 'Decay', min: 0, max: 5, step: 0.01, get: () => st.point.decay, set: (v: number) => setPoint({ decay: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Pos X', min: -1000, max: 1000, step: 0.1, get: () => st.point.position[0], set: (v: number) => setPoint({ position: [v, st.point.position[1], st.point.position[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Pos Y', min: -1000, max: 1000, step: 0.1, get: () => st.point.position[1], set: (v: number) => setPoint({ position: [st.point.position[0], v, st.point.position[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Pos Z', min: -1000, max: 1000, step: 0.1, get: () => st.point.position[2], set: (v: number) => setPoint({ position: [st.point.position[0], st.point.position[1], v] }), format: (v: number) => v.toFixed(1) }
        ],
        extras: (
            <div style={{ display: 'grid', gap: 8 }}>
                <FormField fieldKey="pColor" label="Color" fieldType="color" fieldValue={st.point.color} onFieldChange={(_, v) => setPoint({ color: String(v) })} />
                <FormField fieldKey="pCast" label="Cast Shadow" fieldType="checkbox" fieldValue={st.point.castShadow} onFieldChange={(_, v) => setPoint({ castShadow: !!v })} />
                <FormField fieldKey="pHelper" label="Helper" fieldType="checkbox" fieldValue={st.point.helper} onFieldChange={(_, v) => setPoint({ helper: !!v })} />
            </div>
        )
    };

    const spot = {
        key: 'spot',
        title: 'Spot',
        enabled: st.spot.enabled,
        onToggle: (en: boolean) => setSpot({ enabled: en }),
        rows: [
            { label: 'Intensity', min: 0, max: 200, step: 0.01, get: () => st.spot.intensity, set: (v: number) => setSpot({ intensity: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Angle', min: 0.01, max: Math.PI / 2, step: 0.01, get: () => st.spot.angle, set: (v: number) => setSpot({ angle: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Penumbra', min: 0, max: 1, step: 0.01, get: () => st.spot.penumbra, set: (v: number) => setSpot({ penumbra: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Distance', min: 0, max: 1000, step: 0.1, get: () => st.spot.distance, set: (v: number) => setSpot({ distance: v }), format: (v: number) => v.toFixed(1) },
            { label: 'Decay', min: 0, max: 5, step: 0.01, get: () => st.spot.decay, set: (v: number) => setSpot({ decay: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Pos X', min: -1000, max: 1000, step: 0.1, get: () => st.spot.position[0], set: (v: number) => setSpot({ position: [v, st.spot.position[1], st.spot.position[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Pos Y', min: -1000, max: 1000, step: 0.1, get: () => st.spot.position[1], set: (v: number) => setSpot({ position: [st.spot.position[0], v, st.spot.position[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Pos Z', min: -1000, max: 1000, step: 0.1, get: () => st.spot.position[2], set: (v: number) => setSpot({ position: [st.spot.position[0], st.spot.position[1], v] }), format: (v: number) => v.toFixed(1) },
            { label: 'Target X', min: -1000, max: 1000, step: 0.1, get: () => st.spot.target[0], set: (v: number) => setSpot({ target: [v, st.spot.target[1], st.spot.target[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Target Y', min: -1000, max: 1000, step: 0.1, get: () => st.spot.target[1], set: (v: number) => setSpot({ target: [st.spot.target[0], v, st.spot.target[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Target Z', min: -1000, max: 1000, step: 0.1, get: () => st.spot.target[2], set: (v: number) => setSpot({ target: [st.spot.target[0], st.spot.target[1], v] }), format: (v: number) => v.toFixed(1) }
        ],
        extras: (
            <div style={{ display: 'grid', gap: 8 }}>
                <FormField fieldKey="sColor" label="Color" fieldType="color" fieldValue={st.spot.color} onFieldChange={(_, v) => setSpot({ color: String(v) })} />
                <FormField fieldKey="sCast" label="Cast Shadow" fieldType="checkbox" fieldValue={st.spot.castShadow} onFieldChange={(_, v) => setSpot({ castShadow: !!v })} />
                <FormField fieldKey="sHelper" label="Helper" fieldType="checkbox" fieldValue={st.spot.helper} onFieldChange={(_, v) => setSpot({ helper: !!v })} />
            </div>
        )
    };

    const hemi = {
        key: 'hemi',
        title: 'Hemisphere',
        enabled: st.hemisphere.enabled,
        onToggle: (en: boolean) => setHemisphere({ enabled: en }),
        rows: [
            { label: 'Intensity', min: 0, max: 10, step: 0.01, get: () => st.hemisphere.intensity, set: (v: number) => setHemisphere({ intensity: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Pos X', min: -1000, max: 1000, step: 0.1, get: () => st.hemisphere.position[0], set: (v: number) => setHemisphere({ position: [v, st.hemisphere.position[1], st.hemisphere.position[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Pos Y', min: -1000, max: 1000, step: 0.1, get: () => st.hemisphere.position[1], set: (v: number) => setHemisphere({ position: [st.hemisphere.position[0], v, st.hemisphere.position[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Pos Z', min: -1000, max: 1000, step: 0.1, get: () => st.hemisphere.position[2], set: (v: number) => setHemisphere({ position: [st.hemisphere.position[0], st.hemisphere.position[1], v] }), format: (v: number) => v.toFixed(1) }
        ],
        extras: (
            <div style={{ display: 'grid', gap: 8 }}>
                <FormField fieldKey="hSky" label="Sky" fieldType="color" fieldValue={st.hemisphere.skyColor} onFieldChange={(_, v) => setHemisphere({ skyColor: String(v) })} />
                <FormField fieldKey="hGround" label="Ground" fieldType="color" fieldValue={st.hemisphere.groundColor} onFieldChange={(_, v) => setHemisphere({ groundColor: String(v) })} />
                <FormField fieldKey="hHelper" label="Helper" fieldType="checkbox" fieldValue={st.hemisphere.helper} onFieldChange={(_, v) => setHemisphere({ helper: !!v })} />
            </div>
        )
    };

    const rect = {
        key: 'rect',
        title: 'Rect Area',
        enabled: st.rectArea.enabled,
        onToggle: (en: boolean) => setRectArea({ enabled: en }),
        rows: [
            { label: 'Intensity', min: 0, max: 500, step: 0.01, get: () => st.rectArea.intensity, set: (v: number) => setRectArea({ intensity: v }), format: (v: number) => v.toFixed(2) },
            { label: 'Width', min: 0.1, max: 100, step: 0.1, get: () => st.rectArea.width, set: (v: number) => setRectArea({ width: v }), format: (v: number) => v.toFixed(1) },
            { label: 'Height', min: 0.1, max: 100, step: 0.1, get: () => st.rectArea.height, set: (v: number) => setRectArea({ height: v }), format: (v: number) => v.toFixed(1) },
            { label: 'Pos X', min: -1000, max: 1000, step: 0.1, get: () => st.rectArea.position[0], set: (v: number) => setRectArea({ position: [v, st.rectArea.position[1], st.rectArea.position[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Pos Y', min: -1000, max: 1000, step: 0.1, get: () => st.rectArea.position[1], set: (v: number) => setRectArea({ position: [st.rectArea.position[0], v, st.rectArea.position[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Pos Z', min: -1000, max: 1000, step: 0.1, get: () => st.rectArea.position[2], set: (v: number) => setRectArea({ position: [st.rectArea.position[0], st.rectArea.position[1], v] }), format: (v: number) => v.toFixed(1) },
            { label: 'Look X', min: -1000, max: 1000, step: 0.1, get: () => st.rectArea.lookAt[0], set: (v: number) => setRectArea({ lookAt: [v, st.rectArea.lookAt[1], st.rectArea.lookAt[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Look Y', min: -1000, max: 1000, step: 0.1, get: () => st.rectArea.lookAt[1], set: (v: number) => setRectArea({ lookAt: [st.rectArea.lookAt[0], v, st.rectArea.lookAt[2]] }), format: (v: number) => v.toFixed(1) },
            { label: 'Look Z', min: -1000, max: 1000, step: 0.1, get: () => st.rectArea.lookAt[2], set: (v: number) => setRectArea({ lookAt: [st.rectArea.lookAt[0], st.rectArea.lookAt[1], v] }), format: (v: number) => v.toFixed(1) }
        ],
        extras: (
            <div style={{ display: 'grid', gap: 8 }}>
                <FormField fieldKey="rColor" label="Color" fieldType="color" fieldValue={st.rectArea.color} onFieldChange={(_, v) => setRectArea({ color: String(v) })} />
                <FormField fieldKey="rHelper" label="Helper" fieldType="checkbox" fieldValue={st.rectArea.helper} onFieldChange={(_, v) => setRectArea({ helper: !!v })} />
            </div>
        )
    };

    return (
        <CollapsibleSection 
            title="Lights" 
            icon={<MdLightbulb size={16} />}
        >
            <div style={{ display: 'grid', gap: 12 }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Global IBL (Image Based Lighting)</div>
                    <FormSchema sections={[global]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Directional Light (Sun-like)</div>
                    <FormSchema sections={[dir]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Point Light (Omnidirectional)</div>
                    <FormSchema sections={[point]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Spot Light (Cone-shaped)</div>
                    <FormSchema sections={[spot]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Hemisphere Light (Sky + Ground)</div>
                    <FormSchema sections={[hemi]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Rect Area Light (Rectangular)</div>
                    <FormSchema sections={[rect]} />
                </div>
            </div>
        </CollapsibleSection>
    );
};

export default LightsControls;
