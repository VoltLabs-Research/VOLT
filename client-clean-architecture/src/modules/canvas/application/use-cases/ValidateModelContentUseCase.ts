/**
 * Result of model content validation.
 */
export interface ModelValidationResult {
    /** Whether the model has renderable content */
    hasRenderableContent: boolean;
    /** Number of renderable meshes found */
    meshCount: number;
    /** Number of renderable point clouds found */
    pointCloudCount: number;
    /** Total vertex count */
    totalVertices: number;
}

/**
 * Mesh geometry info for validation.
 */
export interface MeshGeometryInfo {
    type: 'mesh' | 'points';
    name: string;
    vertexCount: number;
    indexCount?: number;
}

/**
 * Use case for validating if a loaded model has renderable content.
 * Separated from Three.js specifics - receives pre-extracted geometry info.
 */
export class ValidateModelContentUseCase {
    /**
     * Validates model geometry information.
     * Pure logic - receives extracted geometry data, not Three.js objects.
     *
     * @param geometries - Array of geometry information extracted from the model
     * @returns Validation result
     */
    execute(geometries: MeshGeometryInfo[]): ModelValidationResult {
        let meshCount = 0;
        let pointCloudCount = 0;
        let totalVertices = 0;

        for (const geom of geometries) {
            if (geom.type === 'points') {
                if (geom.vertexCount > 0) {
                    pointCloudCount++;
                    totalVertices += geom.vertexCount;
                }
            } else if (geom.type === 'mesh') {
                // Mesh needs at least 3 vertices for a triangle
                if (geom.vertexCount < 3) continue;

                // If indexed, needs at least 3 indices
                if (geom.indexCount !== undefined && geom.indexCount < 3) continue;

                meshCount++;
                totalVertices += geom.vertexCount;
            }
        }

        return {
            hasRenderableContent: meshCount > 0 || pointCloudCount > 0,
            meshCount,
            pointCloudCount,
            totalVertices
        };
    }

    /**
     * Quick check if any geometry is renderable.
     */
    hasAnyRenderableContent(geometries: MeshGeometryInfo[]): boolean {
        return geometries.some(geom => {
            if (geom.type === 'points') {
                return geom.vertexCount > 0;
            }
            if (geom.type === 'mesh') {
                if (geom.vertexCount < 3) return false;
                if (geom.indexCount !== undefined && geom.indexCount < 3) return false;
                return true;
            }
            return false;
        });
    }
}
