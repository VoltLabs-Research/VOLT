import nativeExporter from '@modules/trajectory/infrastructure/native/NativeExporter';
import computeBoundsFromPoints from '@modules/trajectory/infrastructure/utilities/compute-bounds-from-points';
import { SYS_BUCKETS } from '@core/config/minio';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { injectable, inject } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IDislocationExporter, DislocationExportOptions, ProcessedDislocationGeometry } from '@modules/trajectory/domain/port/exporters/DislocationExporter';
import calculateDislocationType from '@modules/trajectory/infrastructure/utilities/calculate-dislocation-type';

@injectable()
export default class DislocationExporter implements IDislocationExporter {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService
    ) { }

    private readonly TYPE_COLORS: Record<string, [number, number, number, number]> = {
        'Other': [0.95, 0.1, 0.1, 1.0],
        '1/2<111>': [0.1, 0.9, 0.1, 1.0],
        '<100>': [1, 0.45, 0.74, 1.0],
        '<110>': [0.1, 0.7, 0.95, 1.0],
        '<111>': [0.95, 0.9, 0.1, 1.0],
        '1/6<112>': [0.9, 0.5, 0.1, 1.0],
    };

    private createLineGeometry(
        points: [number, number, number][],
        lineWidth: number,
        tubularSegments: number = 8
    ): { positions: number[]; normals: number[]; indices: number[] } {
        if (points.length < 2) return { positions: [], normals: [], indices: [] };

        const positions: number[] = [];
        const normals: number[] = [];
        const indices: number[] = [];

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            const dir = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
            const length = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2);

            dir[0] /= length; dir[1] /= length; dir[2] /= length;

            let up = Math.abs(dir[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
            const right = [
                dir[1] * up[2] - dir[2] * up[1],
                dir[2] * up[0] - dir[0] * up[2],
                dir[0] * up[1] - dir[1] * up[0]
            ];
            const rightLen = Math.sqrt(right[0] ** 2 + right[1] ** 2 + right[2] ** 2);
            right[0] /= rightLen; right[1] /= rightLen; right[2] /= rightLen;

            up = [
                dir[1] * right[2] - dir[2] * right[1],
                dir[2] * right[0] - dir[0] * right[2],
                dir[0] * right[1] - dir[1] * right[0]
            ];

            const baseVertexIndex = positions.length / 3;
            const radius = lineWidth * 0.5;

            for (let j = 0; j <= tubularSegments; j++) {
                const angle = (j / tubularSegments) * Math.PI * 2;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                const offset = [
                    (right[0] * cos + up[0] * sin) * radius,
                    (right[1] * cos + up[1] * sin) * radius,
                    (right[2] * cos + up[2] * sin) * radius
                ];

                positions.push(p1[0] + offset[0], p1[1] + offset[1], p1[2] + offset[2]);
                positions.push(p2[0] + offset[0], p2[1] + offset[1], p2[2] + offset[2]);

                const normalLen = Math.sqrt(offset[0] ** 2 + offset[1] ** 2 + offset[2] ** 2);
                if (normalLen > 1e-6) {
                    normals.push(offset[0] / normalLen, offset[1] / normalLen, offset[2] / normalLen);
                    normals.push(offset[0] / normalLen, offset[1] / normalLen, offset[2] / normalLen);
                } else {
                    normals.push(0, 1, 0, 0, 1, 0);
                }
            }

            for (let j = 0; j < tubularSegments; j++) {
                const v1 = baseVertexIndex + j * 2;
                const v2 = baseVertexIndex + j * 2 + 1;
                const v3 = baseVertexIndex + (j + 1) * 2;
                const v4 = baseVertexIndex + (j + 1) * 2 + 1;
                indices.push(v1, v2, v3, v3, v2, v4);
            }
        }

        return { positions, normals, indices };
    }

    private processGeometry(data: any, opts: Required<DislocationExportOptions>): ProcessedDislocationGeometry {
        let allPositions: number[] = [];
        let allNormals: number[] = [];
        let allIndices: number[] = [];
        let allColors: number[] = [];
        const typeColors = { ...this.TYPE_COLORS, ...opts.typeColors };
        let currentVertexOffset = 0;

        for (const segment of data.data) {
            if (!segment.points || segment.points.length < opts.minSegmentPoints) continue;

            const type = calculateDislocationType(segment);
            segment.type = type;

            const geometry = this.createLineGeometry(segment.points, opts.lineWidth, opts.tubularSegments);
            if (geometry.positions.length === 0) continue;

            allPositions.push(...geometry.positions);
            allNormals.push(...geometry.normals);

            if (opts.colorByType) {
                const color = typeColors[type] || typeColors['Other'];
                const vertexCount = geometry.positions.length / 3;
                for (let i = 0; i < vertexCount; i++) allColors.push(...color);
            }

            for (const index of geometry.indices) allIndices.push(index + currentVertexOffset);
            currentVertexOffset += geometry.positions.length / 3;
        }

        const positions = new Float32Array(allPositions);
        const normals = new Float32Array(allNormals);
        const indices = new Uint32Array(allIndices);
        const colors = opts.colorByType ? new Float32Array(allColors) : undefined;

        const allPoints: [number, number, number][] = [];
        for (let i = 0; i < positions.length; i += 3) {
            allPoints.push([positions[i], positions[i + 1], positions[i + 2]]);
        }

        return {
            positions,
            normals,
            indices,
            colors,
            vertexCount: positions.length / 3,
            triangleCount: indices.length / 3,
            bounds: computeBoundsFromPoints(allPoints)
        };
    }

    public async toStorage(
        data: any,
        objectName: string,
        options: DislocationExportOptions = {}
    ): Promise<void> {
        const opts: Required<DislocationExportOptions> = {
            lineWidth: options.lineWidth ?? 0.08,
            tubularSegments: options.tubularSegments ?? 12,
            minSegmentPoints: options.minSegmentPoints ?? 2,
            material: {
                baseColor: options.material?.baseColor ?? [1, 1, 1, 1],
                metallic: options.material?.metallic ?? 0.1,
                roughness: options.material?.roughness ?? 0.3,
                emissive: options.material?.emissive ?? [0, 0, 0],
            },
            colorByType: options.colorByType ?? true,
            typeColors: options.typeColors ?? {},
            metadata: {
                includeOriginalStats: options.metadata?.includeOriginalStats ?? true,
                customProperties: options.metadata?.customProperties ?? {},
            }
        };

        const geom = this.processGeometry(data, opts);
        const useU16 = geom.vertexCount > 0 && geom.vertexCount <= 65535;
        const idx = useU16 ? new Uint16Array(geom.indices) : geom.indices;

        const buffer = nativeExporter.generateMeshGLB(
            geom.positions,
            geom.normals,
            idx,
            Boolean(geom.colors),
            geom.colors || null,
            {
                minX: geom.bounds.min[0],
                minY: geom.bounds.min[1],
                minZ: geom.bounds.min[2],
                maxX: geom.bounds.max[0],
                maxY: geom.bounds.max[1],
                maxZ: geom.bounds.max[2]
            },
            {
                // @ts-ignore
                baseColor: opts.material.baseColor,
                metallic: opts.material.metallic,
                roughness: opts.material.roughness,
                emissive: opts.material.emissive,
                doubleSided: true
            }
        );

        await this.storageService.upload(
            SYS_BUCKETS.MODELS,
            objectName,
            buffer,
            { 'Content-Type': 'model/gltf-binary' }
        )
    }
};