import {
    EffectComposer,
    SSAO,
    Bloom,
    ChromaticAberration,
    Vignette,
    DepthOfField,
    Noise,
    Sepia
} from '@react-three/postprocessing';
import { useMemo } from 'react';
import { Vector2 } from 'three';
import useEffectsConfigStore from '@/stores/editor/effects-config';

const DynamicEffects = () => {
    const {
        ssao,
        bloom,
        chromaticAberration,
        vignette,
        depthOfField,
        sepia,
        noise
    } = useEffectsConfigStore();

    const hasAnyEffect = ssao.enabled || bloom.enabled || chromaticAberration.enabled || vignette.enabled ||
                    depthOfField.enabled || sepia.enabled || noise.enabled;

    const caOffsetVec = useMemo(() => new Vector2(
        chromaticAberration.offset[0],
        chromaticAberration.offset[1]
    ), [chromaticAberration.offset[0], chromaticAberration.offset[1]]);

    return(
        <>
            {hasAnyEffect && (
                <EffectComposer
                    key={`effects-${hasAnyEffect}`}
                    enableNormalPass={ssao.enabled}
                    multisampling={0}
                    renderPriority={1}
                >
                     {ssao.enabled && (
                        <SSAO
                            key={`ssao-${ssao.intensity}-${ssao.radius}`}
                            blendFunction={ssao.blendFunction}
                            intensity={ssao.intensity}
                            radius={ssao.radius}
                            luminanceInfluence={ssao.luminanceInfluence}
                            worldDistanceThreshold={ssao.worldDistanceThreshold}
                            worldDistanceFalloff={ssao.worldDistanceFalloff}
                            worldProximityThreshold={ssao.worldProximityThreshold}
                            worldProximityFalloff={ssao.worldProximityFalloff}
                        />
                    )}
                    {bloom.enabled && (
                        <Bloom
                            key={`bloom-${bloom.intensity}-${bloom.luminanceThreshold}`}
                            blendFunction={bloom.blendFunction}
                            intensity={bloom.intensity}
                            luminanceThreshold={bloom.luminanceThreshold}
                            luminanceSmoothing={bloom.luminanceSmoothing}
                            kernelSize={bloom.kernelSize}
                        />
                    )}
                    {chromaticAberration.enabled && (
                        <ChromaticAberration
                            key={`chromatic-${chromaticAberration.offset.join(',')}`}
                            blendFunction={chromaticAberration.blendFunction}
                            offset={caOffsetVec}
                        />
                    )}
                    {vignette.enabled && (
                        <Vignette
                            key={`vignette-${vignette.offset}-${vignette.darkness}`}
                            blendFunction={vignette.blendFunction}
                            eskil={vignette.eskil}
                            offset={vignette.offset}
                            darkness={vignette.darkness}
                        />
                    )}
                    {depthOfField.enabled && (
                        <DepthOfField
                            key={`dof-${depthOfField.focusDistance}-${depthOfField.focalLength}`}
                            blendFunction={depthOfField.blendFunction}
                            focusDistance={depthOfField.focusDistance}
                            focalLength={depthOfField.focalLength}
                            bokehScale={depthOfField.bokehScale}
                            height={depthOfField.height}
                        />
                    )}
                    {sepia.enabled && (
                        <Sepia
                            key={`sepia-${sepia.intensity}`}
                            blendFunction={sepia.blendFunction}
                            intensity={sepia.intensity}
                        />
                    )}
                    {noise.enabled && (
                        <Noise
                            key={`noise-${noise.premultiply}`}
                            blendFunction={noise.blendFunction}
                            premultiply={noise.premultiply}
                        />
                    )}
                </EffectComposer>
            )}
        </>
    );
};

export default DynamicEffects;
