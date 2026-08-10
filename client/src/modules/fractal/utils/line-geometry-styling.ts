import * as THREE from 'three';
import { warnFractal } from '@/modules/fractal/utils/debug-log';
import type { LineSceneSettings } from '@/modules/fractal/contracts/scene-config';

interface LineGeometryUserData {
    basePositionArray?: Float32Array;
    lineWidthOffset?: number;
    baseColorArray?: Float32Array | Uint8Array;
    syntheticColorAttribute?: boolean;
}

const meshesWithUniqueGeometry = (meshes: ReadonlyArray<THREE.Mesh>): THREE.Mesh[] => {
    const seen = new Set<THREE.BufferGeometry>();
    return meshes.filter((mesh) => {
        if (seen.has(mesh.geometry)) return false;
        seen.add(mesh.geometry);
        return true;
    });
};

const offsetGeometryAlongNormals = (geometry: THREE.BufferGeometry, lineWidthOffset: number): void => {
    const positionAttribute = geometry.getAttribute('position');
    const normalAttribute = geometry.getAttribute('normal');

    if (!(positionAttribute instanceof THREE.BufferAttribute) || !(normalAttribute instanceof THREE.BufferAttribute)) {
        warnFractal('engine.line-width-missing-attributes', {
            hasPositionAttribute: positionAttribute instanceof THREE.BufferAttribute,
            hasNormalAttribute: normalAttribute instanceof THREE.BufferAttribute,
            attributeKeys: Object.keys(geometry.attributes)
        });
        return;
    }

    if (positionAttribute.itemSize < 3 || normalAttribute.itemSize < 3) {
        warnFractal('engine.line-width-invalid-item-size', {
            positionItemSize: positionAttribute.itemSize,
            normalItemSize: normalAttribute.itemSize
        });
        return;
    }

    const userData = geometry.userData as LineGeometryUserData;
    if (!userData.basePositionArray || userData.basePositionArray.length !== positionAttribute.array.length) {
        userData.basePositionArray = Float32Array.from(positionAttribute.array as ArrayLike<number>);
    }
    if (userData.lineWidthOffset === lineWidthOffset) return;

    const basePositions = userData.basePositionArray;
    const positions = positionAttribute.array as Float32Array;
    const normals = normalAttribute.array as ArrayLike<number>;
    for (let index = 0; index < positions.length; index += 1) {
        positions[index] = basePositions[index] + (normals[index] * lineWidthOffset);
    }
    positionAttribute.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    userData.lineWidthOffset = lineWidthOffset;
};

export const applyLineWidth = (
    meshes: ReadonlyArray<THREE.Mesh>,
    settings: LineSceneSettings | undefined
): void => {
    const lineWidthOffset = settings && settings.baseLineWidth > 0 && settings.lineWidth > 0
        ? (settings.lineWidth - settings.baseLineWidth) * 0.5
        : 0;
    meshesWithUniqueGeometry(meshes).forEach((mesh) => {
        offsetGeometryAlongNormals(mesh.geometry, lineWidthOffset);
    });
};
