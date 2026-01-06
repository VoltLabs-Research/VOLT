import { Mesh, DefectMeshExportOptions, ProcessedMesh } from '@/types/utilities/export/mesh';
import exporter from '@/utilities/export/exporter';
import storage from '@/services/storage';
import { SYS_BUCKETS } from '@/config/minio';

class MeshExporter {
    public async toGLBBuffer(mesh: Mesh, options: DefectMeshExportOptions = {}): Promise<Buffer> {
        const opts: Required<DefectMeshExportOptions> = {
            generateNormals: options.generateNormals ?? true,
            enableDoubleSided: options.enableDoubleSided ?? true,
            smoothIterations: options.smoothIterations ?? 0,
            material: {
                baseColor: options.material?.baseColor ?? [0, 0.8, 1, 1],
                metallic: options.material?.metallic ?? 0.1,
                roughness: options.material?.roughness ?? 0.5,
                emissive: options.material?.emissive ?? [0, 0, 0],
            },
            metadata: {
                includeOriginalStats: options.metadata?.includeOriginalStats ?? true,
                customProperties: options.metadata?.customProperties ?? {},
            }
        };

        const processed = await this.processMeshGeometry(mesh, opts);
        const useU16 = processed.vertexCount > 0 && processed.vertexCount <= 65535;
        const indices = useU16 ? new Uint16Array(processed.indices) : processed.indices;

        return exporter.generateMeshGLB(
            processed.positions,
            processed.normals,
            indices,
            false,
            null,
            {
                minX: processed.bounds.min[0],
                minY: processed.bounds.min[1],
                minZ: processed.bounds.min[2],
                maxX: processed.bounds.max[0],
                maxY: processed.bounds.max[1],
                maxZ: processed.bounds.max[2]
            },
            {
                baseColor: opts.material.baseColor,
                metallic: opts.material.metallic,
                roughness: opts.material.roughness,
                emissive: opts.material.emissive,
                doubleSided: opts.enableDoubleSided
            }
        );
    }

    public async toGLBMinIO(mesh: Mesh, objectName: string, options: DefectMeshExportOptions = {}): Promise<void> {
        const buffer = await this.toGLBBuffer(mesh, options);
        await storage.put(SYS_BUCKETS.MODELS, objectName, buffer, { 'Content-Type': 'model/gltf-binary' });
    }

    private async processMeshGeometry(mesh: Mesh, opts: Required<DefectMeshExportOptions>): Promise<ProcessedMesh> {
        const { points, facets } = mesh.data;
        const vertexCount = points.length;
        const triangleCount = facets.length;

        const positions = new Float32Array(vertexCount * 3);
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (let i = 0; i < vertexCount; i++) {
            const pos = points[i].position;
            const x = Number(pos[0]), y = Number(pos[1]), z = Number(pos[2]);
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }

        const indices = new Uint32Array(triangleCount * 3);
        let k = 0;
        for (let i = 0; i < triangleCount; i++) {
            const v = (facets[i] as any).vertices;
            indices[k++] = Number(v[0]);
            indices[k++] = Number(v[1]);
            indices[k++] = Number(v[2]);
        }

        // Native Taubin smoothing
        if (opts.smoothIterations > 0) {
            exporter.taubinSmooth(positions, indices, opts.smoothIterations);
        }

        // Compute normals
        const normals = new Float32Array(vertexCount * 3);

        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i], i1 = indices[i + 1], i2 = indices[i + 2];
            const p0 = i0 * 3, p1 = i1 * 3, p2 = i2 * 3;

            const e1x = positions[p1] - positions[p0];
            const e1y = positions[p1 + 1] - positions[p0 + 1];
            const e1z = positions[p1 + 2] - positions[p0 + 2];
            const e2x = positions[p2] - positions[p0];
            const e2y = positions[p2 + 1] - positions[p0 + 1];
            const e2z = positions[p2 + 2] - positions[p0 + 2];

            const nx = e1y * e2z - e1z * e2y;
            const ny = e1z * e2x - e1x * e2z;
            const nz = e1x * e2y - e1y * e2x;

            normals[p0] += nx; normals[p0 + 1] += ny; normals[p0 + 2] += nz;
            normals[p1] += nx; normals[p1 + 1] += ny; normals[p1 + 2] += nz;
            normals[p2] += nx; normals[p2 + 1] += ny; normals[p2 + 2] += nz;
        }

        for (let i = 0; i < normals.length; i += 3) {
            const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
            if (len > 1e-6) {
                normals[i] /= len;
                normals[i + 1] /= len;
                normals[i + 2] /= len;
            } else {
                normals[i + 2] = 1;
            }
        }

        return {
            positions,
            normals,
            indices,
            vertexCount,
            triangleCount,
            bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
        };
    }
}

export default MeshExporter;
