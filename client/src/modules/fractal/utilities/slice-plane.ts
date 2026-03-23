import { Plane, Quaternion, Vector3 } from 'three';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { SlicePlaneConfig } from '@/modules/fractal/api/entities/scene';

const DEFAULT_PLANE_GEOMETRY_NORMAL = new Vector3(0, 0, 1);

export const DEFAULT_SLICE_PLANE_CONFIG: SlicePlaneConfig = {
    enabled: false,
    distance: 0,
    normal: {
        x: 1,
        y: 0,
        z: 0
    },
    reverseOrientation: false,
    visualizePlane: false
};

export const DEFAULT_SLICE_PLANE_BOUNDS: ModelWorldBounds = {
    min: {
        x: -4,
        y: -4,
        z: -4
    },
    max: {
        x: 4,
        y: 4,
        z: 4
    }
};

export interface SlicePlaneDefinition {
    plane: Plane;
    point: Vector3;
    normal: Vector3;
};

const getSlicePlaneConfiguredNormal = (config: SlicePlaneConfig): Vector3 => {
    return new Vector3(config.normal.x, config.normal.y, config.normal.z);
};

const getSlicePlaneUnitNormal = (config: SlicePlaneConfig): Vector3 => {
    const configuredNormal = getSlicePlaneConfiguredNormal(config);

    if (configuredNormal.lengthSq() === 0) {
        return new Vector3(
            DEFAULT_SLICE_PLANE_CONFIG.normal.x,
            DEFAULT_SLICE_PLANE_CONFIG.normal.y,
            DEFAULT_SLICE_PLANE_CONFIG.normal.z
        );
    }

    return configuredNormal.normalize();
};

export const resolveSlicePlaneDefinition = (config: SlicePlaneConfig): SlicePlaneDefinition | null => {
    if (!config.enabled) {
        return null;
    }

    const baseNormal = getSlicePlaneUnitNormal(config);

    const point = baseNormal.clone().multiplyScalar(config.distance);
    const normal = config.reverseOrientation
        ? baseNormal.clone().negate()
        : baseNormal;

    return {
        plane: new Plane().setFromNormalAndCoplanarPoint(normal.clone(), point),
        point,
        normal
    };
};

export const getSlicePlaneVisualizationSize = (bounds?: ModelWorldBounds | null): number => {
    const safeBounds = bounds || DEFAULT_SLICE_PLANE_BOUNDS;
    const sizeX = safeBounds.max.x - safeBounds.min.x;
    const sizeY = safeBounds.max.y - safeBounds.min.y;
    const sizeZ = safeBounds.max.z - safeBounds.min.z;

    return Math.max(sizeX, sizeY, sizeZ) * 1.2;
};

export const getSlicePlaneVisualizationQuaternion = (normal: Vector3): Quaternion => {
    return new Quaternion().setFromUnitVectors(DEFAULT_PLANE_GEOMETRY_NORMAL, normal.clone().normalize());
};

export const getSlicePlaneCenterDistance = (
    config: SlicePlaneConfig,
    bounds?: ModelWorldBounds | null
): number => {
    const safeBounds = bounds || DEFAULT_SLICE_PLANE_BOUNDS;
    const normal = getSlicePlaneUnitNormal(config);
    const center = new Vector3(
        (safeBounds.min.x + safeBounds.max.x) / 2,
        (safeBounds.min.y + safeBounds.max.y) / 2,
        (safeBounds.min.z + safeBounds.max.z) / 2
    );

    return center.dot(normal);
};

export const isSlicePlaneConfigPristine = (config: SlicePlaneConfig): boolean => {
    return config.enabled === DEFAULT_SLICE_PLANE_CONFIG.enabled
        && config.distance === DEFAULT_SLICE_PLANE_CONFIG.distance
        && config.normal.x === DEFAULT_SLICE_PLANE_CONFIG.normal.x
        && config.normal.y === DEFAULT_SLICE_PLANE_CONFIG.normal.y
        && config.normal.z === DEFAULT_SLICE_PLANE_CONFIG.normal.z
        && config.reverseOrientation === DEFAULT_SLICE_PLANE_CONFIG.reverseOrientation
        && config.visualizePlane === DEFAULT_SLICE_PLANE_CONFIG.visualizePlane;
};
