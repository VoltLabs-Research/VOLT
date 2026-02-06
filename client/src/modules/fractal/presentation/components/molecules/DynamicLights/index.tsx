import React, { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Color, DirectionalLightHelper, PointLightHelper, SpotLightHelper, HemisphereLightHelper, RectAreaLight } from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type { LightsState } from '@/modules/fractal/presentation/types/stores/editor/visual-types';

export type LightingPreset = 'trajectory' | 'defect' | 'custom';

interface DynamicLightsProps {
    settings?: LightsState;
    preset?: LightingPreset;
}

const TrajectoryPreset: React.FC = () => (
    <>
        <ambientLight intensity={0.8} />
        <directionalLight
            castShadow
            position={[15, 15, 15]}
            intensity={2.0}
            shadow-mapSize={[1024, 1024]}
            shadow-camera-far={100}
            shadow-camera-near={1}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
        />
        <directionalLight
            position={[-10, 10, -10]}
            intensity={0.8}
            color='#ffffff'
        />
        <hemisphereLight
            groundColor='#362d1d'
            intensity={0.5}
        />
    </>
);

const DefectPreset: React.FC = () => (
    <>
        <ambientLight intensity={0.15} />
        <directionalLight
            castShadow
            position={[10, 15, -5]}
            intensity={2.0}
            shadow-mapSize={[256, 256]}
            shadow-bias={-0.0001}
            shadow-camera-near={1}
            shadow-camera-far={30}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
        />
        <directionalLight
            position={[-10, 5, 10]}
            intensity={0.2}
        />
    </>
);

interface CustomLightsProps {
    settings: LightsState;
}

const CustomLights: React.FC<CustomLightsProps> = ({ settings }) => {
    const st = settings;
    const dirHelperRef = useRef<any>(null);
    const pHelperRef = useRef<any>(null);
    const sHelperRef = useRef<any>(null);
    const hHelperRef = useRef<any>(null);
    const { scene } = useThree();

    useEffect(() => {
        RectAreaLightUniformsLib.init();
    }, []);

    useEffect(() => {
        scene.environment && ((scene.environment as any).rotation.set(st.global.envRotationPitch, st.global.envRotationYaw, 0));
    }, [scene, st.global.envRotationYaw, st.global.envRotationPitch]);

    const dir = useMemo(() => ({
        color: new Color(st.directional.color),
        position: st.directional.position as [number, number, number]
    }), [st.directional.color, st.directional.position]);

    const point = useMemo(() => ({
        color: new Color(st.point.color),
        position: st.point.position as [number, number, number]
    }), [st.point.color, st.point.position]);

    const spot = useMemo(() => ({
        color: new Color(st.spot.color),
        position: st.spot.position as [number, number, number],
        target: st.spot.target as [number, number, number]
    }), [st.spot.color, st.spot.position, st.spot.target]);

    const hemi = useMemo(() => ({
        sky: new Color(st.hemisphere.skyColor),
        ground: new Color(st.hemisphere.groundColor),
        position: st.hemisphere.position as [number, number, number]
    }), [st.hemisphere.skyColor, st.hemisphere.groundColor, st.hemisphere.position]);

    const rect = useMemo(() => ({
        color: new Color(st.rectArea.color),
        position: st.rectArea.position as [number, number, number],
        lookAt: st.rectArea.lookAt as [number, number, number]
    }), [st.rectArea.color, st.rectArea.position, st.rectArea.lookAt]);

    return (
        <>
            {st.directional.enabled && (
                <directionalLight
                    color={dir.color}
                    intensity={st.directional.intensity}
                    position={dir.position}
                    castShadow={st.directional.castShadow}
                    shadow-bias={st.directional.shadowBias as any}
                    shadow-normalBias={st.directional.shadowNormalBias as any}
                    shadow-camera-left={st.directional.camLeft as any}
                    shadow-camera-right={st.directional.camRight as any}
                    shadow-camera-top={st.directional.camTop as any}
                    shadow-camera-bottom={st.directional.camBottom as any}
                    shadow-camera-near={st.directional.camNear as any}
                    shadow-camera-far={st.directional.camFar as any}
                    ref={(r: any) => {
                        if (st.directional.helper && r) {
                            if (!dirHelperRef.current) dirHelperRef.current = new DirectionalLightHelper(r, 2);
                            r.add(dirHelperRef.current);
                            dirHelperRef.current.update();
                        } else if (dirHelperRef.current && r) {
                            r.remove(dirHelperRef.current);
                        }
                    }}
                />
            )}
            {st.point.enabled && (
                <pointLight
                    color={point.color}
                    intensity={st.point.intensity}
                    position={point.position}
                    distance={st.point.distance}
                    decay={st.point.decay}
                    castShadow={st.point.castShadow}
                    ref={(r: any) => {
                        if (st.point.helper && r) {
                            if (!pHelperRef.current) pHelperRef.current = new PointLightHelper(r, 1);
                            r.add(pHelperRef.current);
                            pHelperRef.current.update();
                        } else if (pHelperRef.current && r) {
                            r.remove(pHelperRef.current);
                        }
                    }}
                />
            )}
            {st.spot.enabled && (
                <spotLight
                    color={spot.color}
                    intensity={st.spot.intensity}
                    position={spot.position}
                    distance={st.spot.distance}
                    angle={st.spot.angle}
                    penumbra={st.spot.penumbra}
                    decay={st.spot.decay}
                    castShadow={st.spot.castShadow}
                    target-position={spot.target as any}
                    ref={(r: any) => {
                        if (st.spot.helper && r) {
                            if (!sHelperRef.current) sHelperRef.current = new SpotLightHelper(r);
                            r.add(sHelperRef.current);
                            sHelperRef.current.update();
                        } else if (sHelperRef.current && r) {
                            r.remove(sHelperRef.current);
                        }
                    }}
                />
            )}
            {st.hemisphere.enabled && (
                // @ts-expect-error
                <hemisphereLight
                    skyColor={hemi.sky}
                    groundColor={hemi.ground}
                    intensity={st.hemisphere.intensity}
                    position={hemi.position}
                    ref={(r: any) => {
                        if (st.hemisphere.helper && r) {
                            if (!hHelperRef.current) hHelperRef.current = new HemisphereLightHelper(r, 2);
                            r.add(hHelperRef.current);
                            hHelperRef.current.update();
                        } else if (hHelperRef.current && r) {
                            r.remove(hHelperRef.current);
                        }
                    }}
                />
            )}
            {st.rectArea.enabled && (
                // @ts-expect-error
                <rectAreaLight
                    color={rect.color}
                    intensity={st.rectArea.intensity}
                    width={st.rectArea.width}
                    height={st.rectArea.height}
                    position={rect.position}
                    ref={(r: RectAreaLight | null) => {
                        if (r) r.lookAt(...rect.lookAt);
                    }}
                />
            )}
        </>
    );
};

const DynamicLights: React.FC<DynamicLightsProps> = ({ settings, preset }) => {
    if (preset === 'trajectory') {
        return <TrajectoryPreset />;
    }
    if (preset === 'defect') {
        return <DefectPreset />;
    }
    if (!settings) {
        return null;
    }
    return <CustomLights settings={settings} />;
};

export default DynamicLights;
