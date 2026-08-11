import * as THREE from 'three';
import {
    PointCloudDetailLevel,
    PointCloudStyleMode
} from '@/modules/fractal/contracts/editor/scene-types';
import type { PointCloudSceneSettings } from '@/modules/fractal/contracts/scene-config';

const getDetailRatio = (detailLevel: PointCloudDetailLevel, pointCount: number): number => {
    if (detailLevel === PointCloudDetailLevel.Quality) return 1;
    if (detailLevel === PointCloudDetailLevel.Balanced) return 0.7;
    if (detailLevel === PointCloudDetailLevel.Performance) return 0.45;
    if (pointCount > 2_000_000) return 0.35;
    if (pointCount > 1_000_000) return 0.5;
    if (pointCount > 500_000) return 0.7;
    return 1;
};

const getStyleUniforms = (settings: PointCloudSceneSettings | undefined) => {
    if (!settings?.overridesEnabled) {
        return {
            edgeSoftness: 0,
            lightingMix: 1
        };
    }
    if (settings.style === PointCloudStyleMode.Flat) {
        return {
            edgeSoftness: 0,
            lightingMix: 0
        };
    }
    return {
        edgeSoftness: 0.18,
        lightingMix: 1
    };
};

const syncBlendingMode = (material: THREE.ShaderMaterial): void => {
    const opacity = (material.uniforms.opacity?.value as number | undefined) ?? 1;
    const edgeSoftness = (material.uniforms.edgeSoftness?.value as number | undefined) ?? 0;
    const needsBlending = opacity < 1 || edgeSoftness > 0;

    if (material.transparent === needsBlending) return;

    material.transparent = needsBlending;
    material.needsUpdate = true;
};

const getShaderMaterial = (pointCloud: THREE.Points): THREE.ShaderMaterial | null => (
    pointCloud.material instanceof THREE.ShaderMaterial ? pointCloud.material : null
);

const applyDrawRange = (pointCloud: THREE.Points, settings: PointCloudSceneSettings | undefined): void => {
    const pointCount = pointCloud.geometry.getAttribute('position')?.count ?? 0;
    const detailRatio = settings?.overridesEnabled
        ? getDetailRatio(settings.detailLevel, pointCount)
        : 1;
    pointCloud.geometry.setDrawRange(0, Math.max(1, Math.floor(pointCount * detailRatio)));
};

export const applyPointCloudStyle = (
    pointClouds: ReadonlyArray<THREE.Points>,
    settings: PointCloudSceneSettings | undefined,
    fallbackPointSizeMultiplier: number
): void => {
    const styleUniforms = getStyleUniforms(settings);
    const pointSizeMultiplier = settings?.pointSizeMultiplier ?? fallbackPointSizeMultiplier;

    pointClouds.forEach((pointCloud) => {
        const material = getShaderMaterial(pointCloud);
        if (!material) return;

        const baseScale = pointCloud.userData.basePointScale;
        if (typeof baseScale === 'number' && material.uniforms.pointScale) {
            material.uniforms.pointScale.value = baseScale * pointSizeMultiplier;
        }
        if (material.uniforms.edgeSoftness) {
            material.uniforms.edgeSoftness.value = styleUniforms.edgeSoftness;
        }
        if (material.uniforms.lightingMix) {
            material.uniforms.lightingMix.value = styleUniforms.lightingMix;
        }

        syncBlendingMode(material);
        applyDrawRange(pointCloud, settings);
    });
};

export const applyPointCloudOpacity = (
    pointClouds: ReadonlyArray<THREE.Points>,
    opacity: number,
    settings: PointCloudSceneSettings | undefined
): void => {
    pointClouds.forEach((pointCloud) => {
        const material = getShaderMaterial(pointCloud);
        if (!material) return;

        if (material.uniforms.opacity) {
            material.uniforms.opacity.value = opacity;
        }
        material.depthWrite = opacity >= 1;
        material.alphaTest = opacity < 1 ? Math.max(0.01, 0.5 * opacity) : 0.5;
        material.needsUpdate = true;
        syncBlendingMode(material);

        applyDrawRange(pointCloud, settings);
    });
};

export const applyPointCloudCameraPosition = (
    pointClouds: ReadonlyArray<THREE.Points>,
    cameraPosition: THREE.Vector3
): void => {
    pointClouds.forEach((pointCloud) => {
        const material = getShaderMaterial(pointCloud);
        if (!material?.uniforms.cameraPosition) return;
        (material.uniforms.cameraPosition.value as THREE.Vector3).copy(cameraPosition);
    });
};
