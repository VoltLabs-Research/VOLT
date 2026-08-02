import * as THREE from 'three';
import { warnFractal } from '@/modules/fractal/utils/debug-log';
import { forEachMaterial } from '@/modules/fractal/utils/renderable-materials';
import type { LineEntityHighlight, LineEntityRange, LineSceneSettings } from '@/modules/fractal/contracts/scene-config';

const LINE_HIGHLIGHT_DIM_FACTOR = 0.15;

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

const setMeshVertexColors = (mesh: THREE.Mesh, enabled: boolean): void => {
    forEachMaterial(mesh, (material) => {
        material.vertexColors = enabled;
        material.needsUpdate = true;
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

const dimGeometryOutsideRange = (mesh: THREE.Mesh, range: LineEntityRange | null): void => {
    const geometry = mesh.geometry;
    const index = geometry.getIndex();
    if (!index) return;
    const userData = geometry.userData as LineGeometryUserData;

    if (!range) {
        if (!userData.baseColorArray) return;
        if (userData.syntheticColorAttribute) {
            geometry.deleteAttribute('color');
            setMeshVertexColors(mesh, false);
        } else {
            const attribute = geometry.getAttribute('color') as THREE.BufferAttribute;
            (attribute.array as Float32Array).set(userData.baseColorArray as Float32Array);
            attribute.needsUpdate = true;
        }
        delete userData.baseColorArray;
        delete userData.syntheticColorAttribute;
        return;
    }

    let colorAttribute = geometry.getAttribute('color');
    if (!(colorAttribute instanceof THREE.BufferAttribute)) {
        const vertexCount = geometry.getAttribute('position').count;
        colorAttribute = new THREE.BufferAttribute(new Float32Array(vertexCount * 3).fill(1), 3);
        geometry.setAttribute('color', colorAttribute);
        userData.syntheticColorAttribute = true;
        setMeshVertexColors(mesh, true);
    }

    const colors = colorAttribute.array as Float32Array | Uint8Array;
    if (!userData.baseColorArray) {
        userData.baseColorArray = colors.slice() as Float32Array | Uint8Array;
    }

    const base = userData.baseColorArray;
    const itemSize = colorAttribute.itemSize;
    for (let vertex = 0; vertex < colorAttribute.count; vertex += 1) {
        const offset = vertex * itemSize;
        colors[offset] = base[offset] * LINE_HIGHLIGHT_DIM_FACTOR;
        colors[offset + 1] = base[offset + 1] * LINE_HIGHLIGHT_DIM_FACTOR;
        colors[offset + 2] = base[offset + 2] * LINE_HIGHLIGHT_DIM_FACTOR;
    }

    const indices = index.array;
    const start = range.triangleStart * 3;
    const end = Math.min(start + (range.triangleCount * 3), indices.length);
    for (let entry = start; entry < end; entry += 1) {
        const offset = indices[entry] * itemSize;
        colors[offset] = base[offset];
        colors[offset + 1] = base[offset + 1];
        colors[offset + 2] = base[offset + 2];
    }

    colorAttribute.needsUpdate = true;
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

export const applyLineEntityHighlight = (
    meshes: ReadonlyArray<THREE.Mesh>,
    highlight: LineEntityHighlight | undefined
): void => {
    const entityId = highlight?.entityId;
    const entityRanges = highlight?.entityRanges;
    const range = entityRanges?.find((candidate) => candidate.id === entityId) ?? null;
    meshesWithUniqueGeometry(meshes).forEach((mesh) => {
        dimGeometryOutsideRange(mesh, range);
    });
};
