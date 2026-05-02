import { LightingPreset, LightsColorField, resolveLightsColor } from '@/shared/domain/rendering/lights';
import { useThree } from '@react-three/fiber';
import { Color, DirectionalLight, DirectionalLightHelper, HemisphereLight, HemisphereLightHelper, PointLight, PointLightHelper, RectAreaLight, SpotLight, SpotLightHelper } from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { useEffect, useMemo, useRef } from 'react';
import type { LightsState } from '@/shared/domain/rendering/lights';
import type { FC } from 'react';

interface ResolvedLightConfig {
    color: Color;
    position: [number, number, number];
}

interface ResolvedSpotLightConfig extends ResolvedLightConfig {
    target: [number, number, number];
}

interface ResolvedHemisphereLightConfig {
    sky: Color;
    ground: Color;
    position: [number, number, number];
}

interface ResolvedRectAreaLightConfig extends ResolvedLightConfig {
    lookAt: [number, number, number];
}

export { LightingPreset };

interface DynamicLightsProps {
    settings?: LightsState;
    preset?: LightingPreset;
    darkTheme: boolean;
}

interface PresetLightColors {
    ambientIntensity: number;
    keyColor: string;
    fillColor: string;
    hemisphereGroundColor: string;
}

interface PresetShadowConfig {
    mapSize: [number, number];
    bias?: number;
    near: number;
    far: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
}

const TRAJECTORY_PRESET_SHADOW: PresetShadowConfig = {
    mapSize: [1024, 1024],
    near: 1,
    far: 100,
    left: -15,
    right: 15,
    top: 15,
    bottom: -15
};

const DEFECT_PRESET_SHADOW: PresetShadowConfig = {
    mapSize: [256, 256],
    bias: -0.0001,
    near: 1,
    far: 30,
    left: -15,
    right: 15,
    top: 15,
    bottom: -15
};

const getTrajectoryPresetColors = (darkTheme: boolean): PresetLightColors => {
    if (darkTheme) {
        return {
            ambientIntensity: 0.8,
            keyColor: '#f0f0f0',
            fillColor: '#f0f0f0',
            hemisphereGroundColor: '#1D1D20'
        };
    }

    return {
        ambientIntensity: 0.55,
        keyColor: '#1d1d1f',
        fillColor: '#4f4f4f',
        hemisphereGroundColor: '#d1d1d6'
    };
};

const getDefectPresetColors = (darkTheme: boolean): Omit<PresetLightColors, 'hemisphereGroundColor'> => {
    if (darkTheme) {
        return {
            ambientIntensity: 0.15,
            keyColor: '#f0f0f0',
            fillColor: '#8e8e93'
        };
    }

    return {
        ambientIntensity: 0.35,
        keyColor: '#1d1d1f',
        fillColor: '#4f4f4f'
    };
};

const applyPresetShadow = (light: DirectionalLight, shadow: PresetShadowConfig): void => {
    light.shadow.mapSize.set(shadow.mapSize[0], shadow.mapSize[1]);

    if (typeof shadow.bias === 'number') {
        light.shadow.bias = shadow.bias;
    }

    light.shadow.camera.near = shadow.near;
    light.shadow.camera.far = shadow.far;
    light.shadow.camera.left = shadow.left;
    light.shadow.camera.right = shadow.right;
    light.shadow.camera.top = shadow.top;
    light.shadow.camera.bottom = shadow.bottom;
    light.shadow.camera.updateProjectionMatrix();
};

const DynamicLights: FC<DynamicLightsProps> = ({ settings, preset, darkTheme }) => {
    const dirLightRef = useRef<DirectionalLight>(null);
    const dirHelperRef = useRef<DirectionalLightHelper | null>(null);
    const pointLightRef = useRef<PointLight>(null);
    const pHelperRef = useRef<PointLightHelper | null>(null);
    const spotLightRef = useRef<SpotLight>(null);
    const sHelperRef = useRef<SpotLightHelper | null>(null);
    const hemiLightRef = useRef<HemisphereLight>(null);
    const hHelperRef = useRef<HemisphereLightHelper | null>(null);
    const { scene } = useThree();
    const isTrajectoryPreset = preset === LightingPreset.Trajectory;
    const isDefectPreset = preset === LightingPreset.Defect;
    const customSettings = settings;
    const trajectoryColors = getTrajectoryPresetColors(darkTheme);
    const defectColors = getDefectPresetColors(darkTheme);

    useEffect(() => {
        RectAreaLightUniformsLib.init();
    }, []);

    useEffect(() => {
        if (!customSettings || isTrajectoryPreset || isDefectPreset) {
            return;
        }

        if (scene.environmentRotation) {
            scene.environmentRotation.set(customSettings.global.envRotationPitch, customSettings.global.envRotationYaw, 0);
        }
    }, [customSettings, isDefectPreset, isTrajectoryPreset, scene]);

    useEffect(() => {
        const light = dirLightRef.current;
        if (!light) return;
        if (isTrajectoryPreset) {
            applyPresetShadow(light, TRAJECTORY_PRESET_SHADOW);
            return;
        }

        if (isDefectPreset) {
            applyPresetShadow(light, DEFECT_PRESET_SHADOW);
            return;
        }

        if (!customSettings) {
            return;
        }

        light.shadow.bias = customSettings.directional.shadowBias;
        light.shadow.normalBias = customSettings.directional.shadowNormalBias;
        light.shadow.camera.left = customSettings.directional.camLeft;
        light.shadow.camera.right = customSettings.directional.camRight;
        light.shadow.camera.top = customSettings.directional.camTop;
        light.shadow.camera.bottom = customSettings.directional.camBottom;
        light.shadow.camera.near = customSettings.directional.camNear;
        light.shadow.camera.far = customSettings.directional.camFar;
        light.shadow.camera.updateProjectionMatrix();
    }, [
        customSettings,
        isDefectPreset,
        isTrajectoryPreset
    ]);

    useEffect(() => {
        if (!customSettings || isTrajectoryPreset || isDefectPreset) {
            return;
        }

        const light = dirLightRef.current;
        if (!light) return;
        if (customSettings.directional.helper) {
            if (!dirHelperRef.current) {
                dirHelperRef.current = new DirectionalLightHelper(light, 2);
            }
            light.add(dirHelperRef.current);
            dirHelperRef.current.update();
        } else if (dirHelperRef.current) {
            light.remove(dirHelperRef.current);
        }
    }, [customSettings, isDefectPreset, isTrajectoryPreset]);

    useEffect(() => {
        if (!customSettings || isTrajectoryPreset || isDefectPreset) {
            return;
        }

        const light = pointLightRef.current;
        if (!light) return;
        if (customSettings.point.helper) {
            if (!pHelperRef.current) {
                pHelperRef.current = new PointLightHelper(light, 1);
            }
            light.add(pHelperRef.current);
            pHelperRef.current.update();
        } else if (pHelperRef.current) {
            light.remove(pHelperRef.current);
        }
    }, [customSettings, isDefectPreset, isTrajectoryPreset]);

    useEffect(() => {
        if (!customSettings || isTrajectoryPreset || isDefectPreset) {
            return;
        }

        const light = spotLightRef.current;
        if (!light) return;
        if (customSettings.spot.helper) {
            if (!sHelperRef.current) {
                sHelperRef.current = new SpotLightHelper(light);
            }
            light.add(sHelperRef.current);
            sHelperRef.current.update();
        } else if (sHelperRef.current) {
            light.remove(sHelperRef.current);
        }
    }, [customSettings, isDefectPreset, isTrajectoryPreset]);

    useEffect(() => {
        if (!customSettings || isTrajectoryPreset || isDefectPreset) {
            return;
        }

        const light = spotLightRef.current;
        if (!light) return;
        const [x, y, z] = customSettings.spot.target;
        light.target.position.set(x, y, z);
    }, [customSettings, isDefectPreset, isTrajectoryPreset]);

    useEffect(() => {
        if (!customSettings || isTrajectoryPreset || isDefectPreset) {
            return;
        }

        const light = hemiLightRef.current;
        if (!light) return;
        if (customSettings.hemisphere.helper) {
            if (!hHelperRef.current) {
                hHelperRef.current = new HemisphereLightHelper(light, 2);
            }
            light.add(hHelperRef.current);
            hHelperRef.current.update();
        } else if (hHelperRef.current) {
            light.remove(hHelperRef.current);
        }
    }, [customSettings, isDefectPreset, isTrajectoryPreset]);

    const dir = useMemo<ResolvedLightConfig | null>(() => {
        if (!customSettings) {
            return null;
        }

        return {
            color: new Color(resolveLightsColor(
                customSettings.directional.color,
                customSettings.directional.colorFollowsTheme,
                LightsColorField.Directional,
                darkTheme
            )),
            position: customSettings.directional.position
        };
    }, [customSettings, darkTheme]);

    const point = useMemo<ResolvedLightConfig | null>(() => {
        if (!customSettings) {
            return null;
        }

        return {
            color: new Color(resolveLightsColor(
                customSettings.point.color,
                customSettings.point.colorFollowsTheme,
                LightsColorField.Point,
                darkTheme
            )),
            position: customSettings.point.position
        };
    }, [customSettings, darkTheme]);

    const spot = useMemo<ResolvedSpotLightConfig | null>(() => {
        if (!customSettings) {
            return null;
        }

        return {
            color: new Color(resolveLightsColor(
                customSettings.spot.color,
                customSettings.spot.colorFollowsTheme,
                LightsColorField.Spot,
                darkTheme
            )),
            position: customSettings.spot.position,
            target: customSettings.spot.target
        };
    }, [customSettings, darkTheme]);

    const hemi = useMemo<ResolvedHemisphereLightConfig | null>(() => {
        if (!customSettings) {
            return null;
        }

        return {
            sky: new Color(resolveLightsColor(
                customSettings.hemisphere.skyColor,
                customSettings.hemisphere.skyColorFollowsTheme,
                LightsColorField.HemisphereSky,
                darkTheme
            )),
            ground: new Color(resolveLightsColor(
                customSettings.hemisphere.groundColor,
                customSettings.hemisphere.groundColorFollowsTheme,
                LightsColorField.HemisphereGround,
                darkTheme
            )),
            position: customSettings.hemisphere.position
        };
    }, [customSettings, darkTheme]);

    const rect = useMemo<ResolvedRectAreaLightConfig | null>(() => {
        if (!customSettings) {
            return null;
        }

        return {
            color: new Color(resolveLightsColor(
                customSettings.rectArea.color,
                customSettings.rectArea.colorFollowsTheme,
                LightsColorField.RectArea,
                darkTheme
            )),
            position: customSettings.rectArea.position,
            lookAt: customSettings.rectArea.lookAt
        };
    }, [customSettings, darkTheme]);

    if (isTrajectoryPreset) {
        return (
            <>
                <ambientLight intensity={trajectoryColors.ambientIntensity} />
                <directionalLight
                    ref={dirLightRef}
                    castShadow
                    position={[15, 15, 15]}
                    intensity={2.0}
                    color={trajectoryColors.keyColor}
                />
                <directionalLight
                    position={[-10, 10, -10]}
                    intensity={0.8}
                    color={trajectoryColors.fillColor}
                />
                <hemisphereLight
                    groundColor={trajectoryColors.hemisphereGroundColor}
                    intensity={0.5}
                />
            </>
        );
    }

    if (isDefectPreset) {
        return (
            <>
                <ambientLight intensity={defectColors.ambientIntensity} />
                <directionalLight
                    ref={dirLightRef}
                    castShadow
                    position={[10, 15, -5]}
                    intensity={2.0}
                    color={defectColors.keyColor}
                />
                <directionalLight
                    position={[-10, 5, 10]}
                    intensity={0.2}
                    color={defectColors.fillColor}
                />
            </>
        );
    }

    if (!customSettings || !dir || !point || !spot || !hemi || !rect) {
        return null;
    }

    return (
        <>
            {customSettings.directional.enabled && (
                <directionalLight
                    ref={dirLightRef}
                    color={dir.color}
                    intensity={customSettings.directional.intensity}
                    position={dir.position}
                    castShadow={customSettings.directional.castShadow}
                />
            )}
            {customSettings.point.enabled && (
                <pointLight
                    ref={pointLightRef}
                    color={point.color}
                    intensity={customSettings.point.intensity}
                    position={point.position}
                    distance={customSettings.point.distance}
                    decay={customSettings.point.decay}
                    castShadow={customSettings.point.castShadow}
                />
            )}
            {customSettings.spot.enabled && (
                <spotLight
                    ref={spotLightRef}
                    color={spot.color}
                    intensity={customSettings.spot.intensity}
                    position={spot.position}
                    distance={customSettings.spot.distance}
                    angle={customSettings.spot.angle}
                    penumbra={customSettings.spot.penumbra}
                    decay={customSettings.spot.decay}
                    castShadow={customSettings.spot.castShadow}
                />
            )}
            {customSettings.hemisphere.enabled && (
                <hemisphereLight
                    ref={hemiLightRef}
                    args={[hemi.sky, hemi.ground, customSettings.hemisphere.intensity]}
                    position={hemi.position}
                />
            )}
            {customSettings.rectArea.enabled && (
                <rectAreaLight
                    color={rect.color}
                    intensity={customSettings.rectArea.intensity}
                    width={customSettings.rectArea.width}
                    height={customSettings.rectArea.height}
                    position={rect.position}
                    ref={(r: RectAreaLight | null) => {
                        if (r) r.lookAt(...rect.lookAt);
                    }}
                />
            )}
        </>
    );
};

export default DynamicLights;
