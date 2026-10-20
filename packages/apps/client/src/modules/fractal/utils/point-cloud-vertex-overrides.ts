import * as THREE from 'three';
import { warnFractal } from '@/modules/fractal/utils/debug-log';

type ColorArray = Float32Array | Uint8Array;

const toChannelValues = (array: ColorArray, color: THREE.Color): [number, number, number] => {
    if (array instanceof Float32Array) {
        return [color.r, color.g, color.b];
    }
    return [Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255)];
};

const restoreHighlightColors = (pointCloud: THREE.Points): void => {
    const previous = pointCloud.userData.preHighlightColors;
    if (!previous) return;
    const attribute = pointCloud.geometry.getAttribute('color');
    if (!(attribute instanceof THREE.BufferAttribute)) return;
    (attribute.array as ColorArray).set(previous);
    delete pointCloud.userData.preHighlightColors;
    attribute.needsUpdate = true;
};

export const applyPointCloudVisibilityMask = (
    pointClouds: ReadonlyArray<THREE.Points>,
    mask: Uint8Array | null,
    permutation: Uint32Array | null
): void => {
    pointClouds.forEach((pointCloud) => {
        const attribute = pointCloud.geometry.getAttribute('aVisible');
        if (!(attribute instanceof THREE.BufferAttribute)) return;
        const target = attribute.array as Float32Array;

        if (mask === null) {
            target.fill(1);
            attribute.needsUpdate = true;
            return;
        }
        if (target.length !== mask.length) {
            warnFractal('engine.visibility-mask-mismatch', {
                maskCount: mask.length,
                attributeCount: target.length,
                vertexCount: pointCloud.geometry.getAttribute('position')?.count ?? 0
            });
            return;
        }

        const permuted = permutation?.length === mask.length ? permutation : null;
        for (let index = 0; index < mask.length; index += 1) {
            target[index] = mask[permuted ? permuted[index] : index] ? 1 : 0;
        }
        attribute.needsUpdate = true;
    });
};

export const applyPointCloudSelectionHighlight = (
    pointClouds: ReadonlyArray<THREE.Points>,
    mask: Uint8Array | null,
    color: string | null,
    permutation: Uint32Array | null
): void => {
    if (!mask || !color) {
        pointClouds.forEach(restoreHighlightColors);
        return;
    }

    const override = new THREE.Color(color);
    pointClouds.forEach((pointCloud) => {
        const attribute = pointCloud.geometry.getAttribute('color');
        if (!(attribute instanceof THREE.BufferAttribute)) return;
        if (mask.length !== attribute.count) {
            warnFractal('engine.selection-highlight-mismatch', {
                maskCount: mask.length,
                attributeCount: attribute.count
            });
            return;
        }

        const array = attribute.array as ColorArray;
        const previous = pointCloud.userData.preHighlightColors;
        if (previous) {
            array.set(previous);
        } else {
            pointCloud.userData.preHighlightColors = array.slice();
        }

        const [red, green, blue] = toChannelValues(array, override);
        const stride = attribute.itemSize;
        const permuted = permutation?.length === attribute.count ? permutation : null;
        for (let index = 0; index < attribute.count; index += 1) {
            if (!mask[permuted ? permuted[index] : index]) continue;
            const offset = index * stride;
            array[offset] = red;
            array[offset + 1] = green;
            array[offset + 2] = blue;
        }
        attribute.needsUpdate = true;
    });
};

export const applyPointCloudColorOverride = (
    pointClouds: ReadonlyArray<THREE.Points>,
    override: THREE.Color | null
): void => {
    pointClouds.forEach((pointCloud) => {
        const attribute = pointCloud.geometry.getAttribute('color');
        if (!attribute) return;
        const array = attribute.array as ColorArray;

        if (!override) {
            const original = pointCloud.userData.originalVertexColors;
            if (!original) return;
            array.set(original);
            delete pointCloud.userData.originalVertexColors;
            attribute.needsUpdate = true;
            return;
        }

        if (!pointCloud.userData.originalVertexColors) {
            pointCloud.userData.originalVertexColors = array.slice();
        }
        const [red, green, blue] = toChannelValues(array, override);
        for (let index = 0; index < attribute.count; index += 1) {
            const offset = index * attribute.itemSize;
            array[offset] = red;
            array[offset + 1] = green;
            array[offset + 2] = blue;
        }
        attribute.needsUpdate = true;
    });
};
