import * as THREE from 'three';
import type { MeshGeometryInfo } from '../../application/use-cases/ValidateModelContentUseCase';

/**
 * Adapter for extracting geometry information from Three.js objects.
 * Converts Three.js specifics to domain-compatible data.
 */
export class ThreeJsGeometryExtractor {
    /**
     * Extracts geometry information from a Three.js object tree.
     * Used for model content validation.
     */
    extractGeometryInfo(object: THREE.Object3D): MeshGeometryInfo[] {
        const geometries: MeshGeometryInfo[] = [];

        object.traverse((child) => {
            if (child instanceof THREE.Points) {
                const geom = child.geometry;
                const pos = geom?.getAttribute('position');

                if (pos) {
                    geometries.push({
                        type: 'points',
                        name: child.name || child.uuid,
                        vertexCount: pos.count
                    });
                }
            } else if (child instanceof THREE.Mesh) {
                const geom = child.geometry;
                const pos = geom?.getAttribute('position');

                if (pos) {
                    geometries.push({
                        type: 'mesh',
                        name: child.name || child.uuid,
                        vertexCount: pos.count,
                        indexCount: geom.index?.count
                    });
                }
            }
        });

        return geometries;
    }

    /**
     * Finds the first mesh in an object tree.
     */
    findFirstMesh(object: THREE.Object3D): THREE.Mesh | null {
        let mesh: THREE.Mesh | null = null;

        object.traverse((child) => {
            if (!mesh && child instanceof THREE.Mesh) {
                mesh = child;
            }
        });

        return mesh;
    }

    /**
     * Finds the first point cloud in an object tree.
     */
    findFirstPointCloud(object: THREE.Object3D): THREE.Points | null {
        let points: THREE.Points | null = null;

        object.traverse((child) => {
            if (!points && child instanceof THREE.Points) {
                points = child;
            }
        });

        return points;
    }

    /**
     * Checks if object is a point cloud.
     */
    isPointCloud(object: THREE.Object3D): boolean {
        return this.findFirstPointCloud(object) !== null;
    }

    /**
     * Computes point spacing for point clouds.
     * Used for dynamic point size calculation.
     */
    computePointSpacing(points: THREE.Points): number {
        const geometry = points.geometry;
        const position = geometry.getAttribute('position');

        if (!position || position.count === 0) return 1;

        geometry.computeBoundingBox();
        const box = geometry.boundingBox;

        if (!box) return 1;

        const size = new THREE.Vector3();
        box.getSize(size);

        const volume = size.x * size.y * size.z;
        const numPoints = position.count;

        // Approximate spacing as cube root of volume per point
        return Math.pow(volume / numPoints, 1 / 3);
    }
}
