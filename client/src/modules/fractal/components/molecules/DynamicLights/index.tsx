import { LightingPreset } from '@/shared/domain/rendering/lights';
import { useThree } from '@react-three/fiber';
import { Color, DirectionalLight, DirectionalLightHelper, HemisphereLight, HemisphereLightHelper, PointLight, PointLightHelper, RectAreaLight, SpotLight, SpotLightHelper } from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { useEffect, useMemo, useRef } from 'react';
import type { LightsState } from '@/shared/domain/rendering/lights';
import type { FC } from 'react';

export { LightingPreset };

interface DynamicLightsProps {
    settings?: LightsState;
    preset?: LightingPreset;
};

interface CustomLightsProps {
    settings: LightsState;
};

const TrajectoryPreset: FC = () => {
    const directionalLightRef = useRef<DirectionalLight>(null);

    useEffect(() => {
        const light = directionalLightRef.current;
        if (!light) return;
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.camera.far = 100;
        light.shadow.camera.near = 1;
        light.shadow.camera.left = -15;
        light.shadow.camera.right = 15;
        light.shadow.camera.top = 15;
        light.shadow.camera.bottom = -15;
        light.shadow.camera.updateProjectionMatrix();
    }, []);

    return (
        <>
            <ambientLight intensity={0.8} />
            <directionalLight
                ref={directionalLightRef}
                castShadow
                position={[15, 15, 15]}
                intensity={2.0}
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
};

const DefectPreset: FC = () => {
    const directionalLightRef = useRef<DirectionalLight>(null);

    useEffect(() => {
        const light = directionalLightRef.current;
        if (!light) return;
        light.shadow.mapSize.set(256, 256);
        light.shadow.bias = -0.0001;
        light.shadow.camera.near = 1;
        light.shadow.camera.far = 30;
        light.shadow.camera.left = -15;
        light.shadow.camera.right = 15;
        light.shadow.camera.top = 15;
        light.shadow.camera.bottom = -15;
        light.shadow.camera.updateProjectionMatrix();
    }, []);

    return (
        <>
            <ambientLight intensity={0.15} />
            <directionalLight
                ref={directionalLightRef}
                castShadow
                position={[10, 15, -5]}
                intensity={2.0}
            />
            <directionalLight
                position={[-10, 5, 10]}
                intensity={0.2}
            />
        </>
    );
};

const CustomLights: FC<CustomLightsProps> = ({ settings }) => {
    const st = settings;
    const dirLightRef = useRef<DirectionalLight>(null);
    const dirHelperRef = useRef<DirectionalLightHelper | null>(null);
    const pointLightRef = useRef<PointLight>(null);
    const pHelperRef = useRef<PointLightHelper | null>(null);
    const spotLightRef = useRef<SpotLight>(null);
    const sHelperRef = useRef<SpotLightHelper | null>(null);
    const hemiLightRef = useRef<HemisphereLight>(null);
    const hHelperRef = useRef<HemisphereLightHelper | null>(null);
    const { scene } = useThree();

    useEffect(() => {
        RectAreaLightUniformsLib.init();
    }, []);

    useEffect(() => {
        if (scene.environmentRotation) {
            scene.environmentRotation.set(st.global.envRotationPitch, st.global.envRotationYaw, 0);
        }
    }, [scene, st.global.envRotationYaw, st.global.envRotationPitch]);

    useEffect(() => {
        const light = dirLightRef.current;
        if (!light) return;
        light.shadow.bias = st.directional.shadowBias;
        light.shadow.normalBias = st.directional.shadowNormalBias;
        light.shadow.camera.left = st.directional.camLeft;
        light.shadow.camera.right = st.directional.camRight;
        light.shadow.camera.top = st.directional.camTop;
        light.shadow.camera.bottom = st.directional.camBottom;
        light.shadow.camera.near = st.directional.camNear;
        light.shadow.camera.far = st.directional.camFar;
        light.shadow.camera.updateProjectionMatrix();
    }, [
        st.directional.shadowBias,
        st.directional.shadowNormalBias,
        st.directional.camLeft,
        st.directional.camRight,
        st.directional.camTop,
        st.directional.camBottom,
        st.directional.camNear,
        st.directional.camFar
    ]);

    useEffect(() => {
        const light = dirLightRef.current;
        if (!light) return;
        if (st.directional.helper) {
            if (!dirHelperRef.current) {
                dirHelperRef.current = new DirectionalLightHelper(light, 2);
            }
            light.add(dirHelperRef.current);
            dirHelperRef.current.update();
        } else if (dirHelperRef.current) {
            light.remove(dirHelperRef.current);
        }
    }, [st.directional.helper]);

    useEffect(() => {
        const light = pointLightRef.current;
        if (!light) return;
        if (st.point.helper) {
            if (!pHelperRef.current) {
                pHelperRef.current = new PointLightHelper(light, 1);
            }
            light.add(pHelperRef.current);
            pHelperRef.current.update();
        } else if (pHelperRef.current) {
            light.remove(pHelperRef.current);
        }
    }, [st.point.helper]);

    useEffect(() => {
        const light = spotLightRef.current;
        if (!light) return;
        if (st.spot.helper) {
            if (!sHelperRef.current) {
                sHelperRef.current = new SpotLightHelper(light);
            }
            light.add(sHelperRef.current);
            sHelperRef.current.update();
        } else if (sHelperRef.current) {
            light.remove(sHelperRef.current);
        }
    }, [st.spot.helper]);

    useEffect(() => {
        const light = spotLightRef.current;
        if (!light) return;
        const [x, y, z] = st.spot.target;
        light.target.position.set(x, y, z);
    }, [st.spot.target]);

    useEffect(() => {
        const light = hemiLightRef.current;
        if (!light) return;
        if (st.hemisphere.helper) {
            if (!hHelperRef.current) {
                hHelperRef.current = new HemisphereLightHelper(light, 2);
            }
            light.add(hHelperRef.current);
            hHelperRef.current.update();
        } else if (hHelperRef.current) {
            light.remove(hHelperRef.current);
        }
    }, [st.hemisphere.helper]);

    const dir = useMemo(() => ({
        color: new Color(st.directional.color),
        position: st.directional.position
    }), [st.directional.color, st.directional.position]);

    const point = useMemo(() => ({
        color: new Color(st.point.color),
        position: st.point.position
    }), [st.point.color, st.point.position]);

    const spot = useMemo(() => ({
        color: new Color(st.spot.color),
        position: st.spot.position,
        target: st.spot.target
    }), [st.spot.color, st.spot.position, st.spot.target]);

    const hemi = useMemo(() => ({
        sky: new Color(st.hemisphere.skyColor),
        ground: new Color(st.hemisphere.groundColor),
        position: st.hemisphere.position
    }), [st.hemisphere.skyColor, st.hemisphere.groundColor, st.hemisphere.position]);

    const rect = useMemo(() => ({
        color: new Color(st.rectArea.color),
        position: st.rectArea.position,
        lookAt: st.rectArea.lookAt
    }), [st.rectArea.color, st.rectArea.position, st.rectArea.lookAt]);

    return (
        <>
            {st.directional.enabled && (
                <directionalLight
                    ref={dirLightRef}
                    color={dir.color}
                    intensity={st.directional.intensity}
                    position={dir.position}
                    castShadow={st.directional.castShadow}
                />
            )}
            {st.point.enabled && (
                <pointLight
                    ref={pointLightRef}
                    color={point.color}
                    intensity={st.point.intensity}
                    position={point.position}
                    distance={st.point.distance}
                    decay={st.point.decay}
                    castShadow={st.point.castShadow}
                />
            )}
            {st.spot.enabled && (
                <spotLight
                    ref={spotLightRef}
                    color={spot.color}
                    intensity={st.spot.intensity}
                    position={spot.position}
                    distance={st.spot.distance}
                    angle={st.spot.angle}
                    penumbra={st.spot.penumbra}
                    decay={st.spot.decay}
                    castShadow={st.spot.castShadow}
                />
            )}
            {st.hemisphere.enabled && (
                <hemisphereLight
                    ref={hemiLightRef}
                    args={[hemi.sky, hemi.ground, st.hemisphere.intensity]}
                    position={hemi.position}
                />
            )}
            {st.rectArea.enabled && (
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

const DynamicLights: FC<DynamicLightsProps> = ({ settings, preset }) => {
    if (preset === LightingPreset.Trajectory) {
        return <TrajectoryPreset />;
    }
    if (preset === LightingPreset.Defect) {
        return <DefectPreset />;
    }
    if (!settings) {
        return null;
    }
    return <CustomLights settings={settings} />;
};

export default DynamicLights;
