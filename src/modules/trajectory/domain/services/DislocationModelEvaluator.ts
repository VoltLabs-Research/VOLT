import path from 'node:path';
import spatialAssembler from '@voltstack/spatial-assembler';
import ApplicationError from '@/app/coordination/ApplicationError';
import { ObjectBucketName } from '@/contracts';
import { DAEMON_PATHS } from '@/core/paths';
import { Service } from '@/core/decorators/service';
import {
    createScopedClusterObjectStore,
    type ClusterObjectStore
} from '@/core/storage/application/ClusterObjectStore';
import { uploadBufferToObjectStore } from '@/core/storage/infrastructure/object-store/upload-buffer-to-object-store';
import {
    buildDislocationSceneSourceKey,
    decodeDislocationSceneSource
} from '@/modules/plugin/application/exports/dislocation-scene-source';
import {
    buildDislocationGlb,
    generateEmptyDislocationGLB,
    processDislocations,
    resolveDislocationFamily,
    DEFAULT_DISLOCATION_OPTIONS,
    DISLOCATION_TYPE_COLORS
} from '@/modules/plugin/application/exports/dislocation-exporter';
import { resolveGradientCode } from '@/modules/trajectory/domain/services/FilterEvaluator';

import type { DislocationSceneSource } from '@/modules/plugin/application/exports/dislocation-scene-source';
import type {
    DislocationExportOptions,
    DislocationSegment
} from '@/modules/plugin/application/exports/export-node-processor-types';

export type DislocationColorMode = 'family' | 'uniform' | 'property';
export type DislocationColorProperty = 'length' | 'magnitude';

export interface DislocationStyleInput {
    lineWidth?: number;
    tubularSegments?: number;
    minLength?: number;
    colorMode?: DislocationColorMode;
    uniformColor?: [number, number, number, number];
    familyColors?: Record<string, [number, number, number, number]>;
    familyVisibility?: Record<string, boolean>;
    property?: DislocationColorProperty;
    gradient?: string;
    startValue?: number;
    endValue?: number;
}

export interface ExportDislocationModelInput {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    ownerClusterId: string;
    objectKey: string;
    style?: DislocationStyleInput;
}

export interface DislocationFamilySummary {
    count: number;
    totalLength: number;
}

export interface ExportDislocationModelResult {
    objectKey: string;
    segmentsRendered: number;
    segmentsTotal: number;
    familyCounts: Record<string, DislocationFamilySummary>;
}

const segmentLength = (segment: DislocationSegment): number => {
    if (typeof segment.length === 'number') {
        return segment.length;
    }

    let total = 0;
    for (let index = 1; index < segment.points.length; index += 1) {
        const [x1, y1, z1] = segment.points[index - 1];
        const [x2, y2, z2] = segment.points[index];
        total += Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    }
    return total;
};

const segmentMagnitude = (segment: DislocationSegment): number => {
    if (typeof segment.magnitude === 'number') {
        return segment.magnitude;
    }

    const vector = segment.burgers_vector_local ?? segment.burgers_vector;
    return vector ? Math.hypot(vector[0], vector[1], vector[2]) : 0;
};

@Service('dislocationModelEvaluator')
export class DislocationModelEvaluator {
    constructor(private readonly objectStore: ClusterObjectStore) {}

    async exportDislocationModel(input: ExportDislocationModelInput): Promise<ExportDislocationModelResult> {
        const source = await this.downloadSceneSource(input);
        const segments = source.data.segments ?? [];
        const style = input.style ?? {};

        const families = segments.map(resolveDislocationFamily);
        const familyCounts: Record<string, DislocationFamilySummary> = {};
        for (let index = 0; index < segments.length; index += 1) {
            const family = families[index];
            const summary = familyCounts[family] ?? { count: 0, totalLength: 0 };
            summary.count += 1;
            summary.totalLength += segmentLength(segments[index]);
            familyCounts[family] = summary;
        }

        const baseOptions = source.options ?? {};
        const resolvedOptions: Required<DislocationExportOptions> = {
            ...DEFAULT_DISLOCATION_OPTIONS,
            ...baseOptions,
            lineWidth: style.lineWidth ?? baseOptions.lineWidth ?? DEFAULT_DISLOCATION_OPTIONS.lineWidth,
            tubularSegments: style.tubularSegments ?? baseOptions.tubularSegments ?? DEFAULT_DISLOCATION_OPTIONS.tubularSegments,
            colorByType: true,
            material: { ...DEFAULT_DISLOCATION_OPTIONS.material, ...baseOptions.material }
        };

        const getSegmentColor = this.buildSegmentColorResolver(segments, style);
        const minLength = style.minLength ?? 0;
        const familyVisibility = style.familyVisibility;

        let segmentsRendered = 0;
        const geometry = await processDislocations(source.data, resolvedOptions, {
            includeSegment: (segment, family) => {
                if (familyVisibility && familyVisibility[family] === false) {
                    return false;
                }
                if (minLength > 0 && segmentLength(segment) < minLength) {
                    return false;
                }
                segmentsRendered += 1;
                return true;
            },
            getSegmentColor
        });

        const buffer = geometry
            ? buildDislocationGlb(geometry, resolvedOptions.material)
            : generateEmptyDislocationGLB(resolvedOptions.material);

        await this.uploadGlb(buffer, input.objectKey, input.ownerClusterId);

        return {
            objectKey: input.objectKey,
            segmentsRendered,
            segmentsTotal: segments.length,
            familyCounts
        };
    }

    private buildSegmentColorResolver(
        segments: DislocationSegment[],
        style: DislocationStyleInput
    ): (segment: DislocationSegment, family: string) => [number, number, number, number] {
        const colorMode = style.colorMode ?? 'family';

        if (colorMode === 'uniform') {
            const color = style.uniformColor ?? [1, 0.5, 0, 1];
            return () => color;
        }

        if (colorMode === 'property') {
            const property = style.property ?? 'length';
            const values = new Float32Array(segments.length);
            for (let index = 0; index < segments.length; index += 1) {
                values[index] = property === 'magnitude'
                    ? segmentMagnitude(segments[index])
                    : segmentLength(segments[index]);
            }

            let min = Infinity;
            let max = -Infinity;
            for (const value of values) {
                if (value < min) min = value;
                if (value > max) max = value;
            }
            if (!Number.isFinite(min)) min = 0;
            if (!Number.isFinite(max)) max = 0;

            const startValue = style.startValue ?? min;
            const endValue = style.endValue ?? max;
            const colors: Float32Array = spatialAssembler.applyPropertyColors(
                values,
                startValue,
                endValue,
                resolveGradientCode(style.gradient ?? 'Viridis')
            );

            const colorBySegment = new Map<DislocationSegment, [number, number, number, number]>();
            for (let index = 0; index < segments.length; index += 1) {
                colorBySegment.set(segments[index], [
                    colors[index * 3],
                    colors[index * 3 + 1],
                    colors[index * 3 + 2],
                    1
                ]);
            }

            return (segment) => colorBySegment.get(segment) ?? [0.9, 0.2, 0.2, 1];
        }

        const familyColors = { ...DISLOCATION_TYPE_COLORS, ...style.familyColors };
        return (_segment, family) => familyColors[family] ?? familyColors.Other;
    }

    private async downloadSceneSource(input: ExportDislocationModelInput): Promise<DislocationSceneSource> {
        const objectKey = buildDislocationSceneSourceKey(
            input.trajectoryId,
            input.analysisId,
            input.timestep,
            input.exposureId
        );

        let buffer: Buffer;
        try {
            const { stream } = await this.objectStore.getStream(
                input.ownerClusterId,
                ObjectBucketName.Models,
                objectKey
            );
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            buffer = Buffer.concat(chunks);
        } catch {
            throw ApplicationError.unprocessableEntity(
                'DISLOCATION_SCENE_SOURCE_NOT_FOUND',
                `No dislocation scene source found for analysis "${input.analysisId}", exposure "${input.exposureId}" ` +
                `at timestep ${input.timestep}. Re-run the analysis with an updated daemon to enable restyling.`
            );
        }

        return decodeDislocationSceneSource(buffer);
    }

    private uploadGlb(buffer: Buffer, objectKey: string, ownerClusterId: string): Promise<void> {
        const isZstdCompressed = objectKey.endsWith('.zst');
        return uploadBufferToObjectStore({
            objectStore: createScopedClusterObjectStore(this.objectStore, ownerClusterId),
            bucket: ObjectBucketName.Models,
            objectKey,
            buffer,
            contentType: 'model/gltf-binary',
            contentEncoding: isZstdCompressed ? 'zstd' : undefined,
            compressionCodec: isZstdCompressed ? 'zstd' : undefined,
            tempDirectory: path.join(DAEMON_PATHS.analysisOutput, 'dislocation-style'),
            tempFilePrefix: 'volt-dislocation-style',
            tempFileSuffix: '.glb'
        });
    }
}
