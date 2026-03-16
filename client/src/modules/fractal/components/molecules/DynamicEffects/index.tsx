import { resolveSSAOSettings } from '@/shared/domain/rendering/effects';
import {
    Bloom,
    ChromaticAberration,
    DepthOfField,
    EffectComposer,
    Noise,
    SSAO,
    Sepia,
    Vignette
} from '@react-three/postprocessing';
import { useMemo } from 'react';
import { Vector2 } from 'three';

import type { EffectsConfigState } from '@/modules/fractal/stores/contracts/editor/visual-types';

interface DynamicEffectsProps {
    settings: EffectsConfigState;
    isDefectScene?: boolean;
    darkTheme: boolean;
};

const DynamicEffects = ({ settings, isDefectScene, darkTheme }: DynamicEffectsProps) => {
    const {
        bloom,
        chromaticAberration,
        vignette,
        depthOfField,
        sepia,
        noise
    } = settings;

    const ssao = useMemo(() => {
        return resolveSSAOSettings(settings.ssao, { isDefectScene });
    }, [isDefectScene, settings.ssao]);

    const hasAnyEffect = Boolean(
        ssao ||
        bloom.enabled ||
        chromaticAberration.enabled ||
        (darkTheme && vignette.enabled) ||
        depthOfField.enabled ||
        sepia.enabled ||
        noise.enabled
    );
    const caOffsetVec = useMemo(() => new Vector2(
        chromaticAberration.offset[0],
        chromaticAberration.offset[1]
    ), [chromaticAberration.offset[0], chromaticAberration.offset[1]]);

    return (
        <>
            {hasAnyEffect && (
                <EffectComposer
                    key={`effects-${hasAnyEffect}-${Boolean(ssao)}`}
                    enableNormalPass={Boolean(ssao)}
                    multisampling={0}
                    renderPriority={1}
                >
                    {ssao && (
                        <SSAO
                            key={`ssao-${ssao.intensity}-${ssao.radius}-${ssao.samples}`}
                            blendFunction={ssao.blendFunction}
                            samples={ssao.samples}
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
                            radialModulation={false}
                            modulationOffset={0}
                        />
                    )}
                    {darkTheme && vignette.enabled && (
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
