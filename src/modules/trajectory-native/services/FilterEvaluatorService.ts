import { ObjectBucketName } from '@/shared/contracts';
import { DAEMON_PATHS } from '@/core/paths';
import { MinioService } from '@/modules/platform/services';
import {
    NativeModuleLoader,
    type NativeColorModelRequest,
    type NativeFilterPreviewRequest,
    type NativeFilterPreviewResponse,
    type NativeParticleFilterModelRequest
} from './NativeModuleLoader';
import type { TrajectoryParserService } from './TrajectoryParserService';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

enum GradientType {
    Viridis = 0,
    Plasma = 1,
    BlueRed = 2,
    Grayscale = 3
};

const HIGHLIGHT_COLOR = [1.0, 0.2, 0.6];
const DEFAULT_COLOR = [0.8, 0.8, 0.8];
const STREAM_UPLOAD_THRESHOLD = 10 * 1024 * 1024;

const uploadBuffer = async (
    minioService: MinioService,
    objectKey: string,
    buffer: Buffer
): Promise<void> => {
    if (buffer.length < STREAM_UPLOAD_THRESHOLD) {
        await minioService.putObject({
            bucket: ObjectBucketName.Models,
            objectKey,
            body: buffer,
            metadata: {
                'Content-Type': 'model/gltf-binary'
            }
        });
        return;
    }

    const tmpPath = path.join(
        DAEMON_PATHS.analysisOutput,
        `volt-filter-export-${Date.now()}-${Math.random().toString(36).slice(2)}.glb`
    );

    try {
        await fs.writeFile(tmpPath, buffer);
        await minioService.putObjectStream({
            bucket: ObjectBucketName.Models,
            objectKey,
            stream: createReadStream(tmpPath),
            size: buffer.length,
            metadata: {
                'Content-Type': 'model/gltf-binary'
            }
        });
    } finally {
        await fs.unlink(tmpPath).catch(() => {});
    }
};

const resolveGradientType = (gradientName: string): GradientType => {
    if (gradientName === 'Plasma') {
        return GradientType.Plasma;
    }

    if (gradientName === 'BlueRed') {
        return GradientType.BlueRed;
    }

    if (gradientName === 'GrayScale') {
        return GradientType.Grayscale;
    }

    return GradientType.Viridis;
};

const evaluateFilter = (values: Float32Array, operator: string, compareValue: number): { mask: Uint8Array; matchCount: number; } => {
    const mask = new Uint8Array(values.length);
    let matchCount = 0;

    for (let index = 0; index < values.length; index++) {
        const value = values[index];

        if (!Number.isFinite(value)) {
            continue;
        }

        let matches = false;

        if (operator === '==') {
            matches = value === compareValue;
        } else if (operator === '!=') {
            matches = value !== compareValue;
        } else if (operator === '>') {
            matches = value > compareValue;
        } else if (operator === '>=') {
            matches = value >= compareValue;
        } else if (operator === '<') {
            matches = value < compareValue;
        } else if (operator === '<=') {
            matches = value <= compareValue;
        }

        if (matches) {
            mask[index] = 1;
            matchCount++;
        }
    }

    return {
        mask,
        matchCount
    };
};

const filterByMask = (positions: Float32Array, types: Uint16Array, mask: Uint8Array): {
    positions: Float32Array;
    types: Uint16Array;
    count: number;
} => {
    let count = 0;
    for (let index = 0; index < mask.length; index++) {
        if (mask[index]) {
            count++;
        }
    }

    const filteredPositions = new Float32Array(count * 3);
    const filteredTypes = new Uint16Array(count);
    let cursor = 0;

    for (let index = 0; index < mask.length; index++) {
        if (!mask[index]) {
            continue;
        }

        const sourceIndex = index * 3;
        const targetIndex = cursor * 3;
        filteredPositions[targetIndex] = positions[sourceIndex];
        filteredPositions[targetIndex + 1] = positions[sourceIndex + 1];
        filteredPositions[targetIndex + 2] = positions[sourceIndex + 2];
        filteredTypes[cursor] = types[index];
        cursor++;
    }

    return {
        positions: filteredPositions,
        types: filteredTypes,
        count
    };
};

/**
 * Raised when a `delete` particle-filter action removes all atoms from the
 * trajectory, leaving an empty particle set that cannot produce a valid GLB.
 *
 * Callers should treat this as a domain/validation error (4xx) rather than
 * an infrastructure failure.
 */
export class EmptyFilterResultError extends Error {
    readonly code = 'EMPTY_FILTER_RESULT';

    constructor(totalAtoms: number) {
        super(
            `Particle filter deleted all ${totalAtoms} atom(s); the resulting model would be empty. ` +
            'Adjust the filter mask so that at least one atom is retained.'
        );
        this.name = 'EmptyFilterResultError';
    }
};

export interface FilterEvaluatorService {
    previewFilter(input: NativeFilterPreviewRequest): Promise<NativeFilterPreviewResponse>;
    exportColoredModel(input: NativeColorModelRequest): Promise<{ objectKey: string; }>;
    exportParticleFilterModel(input: NativeParticleFilterModelRequest): Promise<{ objectKey: string; atomsResult: number; }>;
};

export const createFilterEvaluatorService = (
    minioService: MinioService,
    nativeModuleLoader: NativeModuleLoader,
    trajectoryParserService: TrajectoryParserService
): FilterEvaluatorService => ({
    async previewFilter(input) {
        return trajectoryParserService.withDumpFile(input, async (dumpPath) => {
            let values: Float32Array;

            if (input.externalValuesBase64) {
                const parsed = trajectoryParserService.parseTrajectory(dumpPath, {
                    includeIds: true,
                    properties: []
                });
                const externalValues = trajectoryParserService.decodeFloat32Array(input.externalValuesBase64);
                values = trajectoryParserService.remapExternalValues(parsed, externalValues);
            } else {
                const parsed = trajectoryParserService.parseTrajectory(dumpPath, {
                    includeIds: input.property.toLowerCase() === 'id',
                    properties: ['type', 'x', 'y', 'z', 'id'].includes(input.property.toLowerCase())
                        ? []
                        : [input.property]
                });
                values = trajectoryParserService.getPropertyValues(parsed, input.property);
            }

            const filterResult = evaluateFilter(values, input.operator, input.value);
            return {
                maskBase64: Buffer.from(filterResult.mask).toString('base64'),
                matchCount: filterResult.matchCount,
                totalAtoms: filterResult.mask.length
            };
        });
    },

    async exportColoredModel(input) {
        await trajectoryParserService.withDumpFile({ trajectoryId: input.trajectoryId, timestep: input.timestep }, async (dumpPath) => {
            let buffer: Buffer;
            {
                const externalValues = input.externalValuesBase64
                    ? trajectoryParserService.decodeFloat32Array(input.externalValuesBase64)
                    : undefined;
                const parsed = trajectoryParserService.parseTrajectory(dumpPath, externalValues
                    ? {
                        includeIds: true,
                        properties: []
                    }
                    : {
                        properties: [input.property]
                    });

                const values = externalValues
                    ? trajectoryParserService.remapExternalValues(parsed, externalValues)
                    : trajectoryParserService.getPropertyValues(parsed, input.property);
                if (values.length === 0) {
                    throw new Error(`Property '${input.property}' not found in trajectory dump`);
                }

                const colors = nativeModuleLoader.getExporterModule().applyPropertyColors(
                    values,
                    input.startValue,
                    input.endValue,
                    resolveGradientType(input.gradient)
                );
                buffer = nativeModuleLoader.getExporterModule().generatePointCloudGLB(
                    parsed.positions,
                    colors,
                    parsed.min,
                    parsed.max
                );
            }
            // parsed, values, colors now out of scope — eligible for GC

            await uploadBuffer(minioService, input.objectKey, buffer);
        });

        return {
            objectKey: input.objectKey
        };
    },

    async exportParticleFilterModel(input) {
        return trajectoryParserService.withDumpFile({ trajectoryId: input.trajectoryId, timestep: input.timestep }, async (dumpPath) => {
            let buffer: Buffer;
            let atomsResult = 0;

            {
                const parsed = trajectoryParserService.parseTrajectory(dumpPath);
                const mask = trajectoryParserService.decodeUint8Array(input.maskBase64);

                if (input.action === 'delete') {
                    const inverseMask = new Uint8Array(mask.length);
                    for (let index = 0; index < mask.length; index++) {
                        inverseMask[index] = mask[index] ? 0 : 1;
                    }

                    const filtered = filterByMask(parsed.positions, parsed.types, inverseMask);
                    if (filtered.count === 0) {
                        throw new EmptyFilterResultError(mask.length);
                    }

                    buffer = nativeModuleLoader.getExporterModule().generateGLB(
                        filtered.positions,
                        filtered.types,
                        parsed.min,
                        parsed.max
                    );
                    atomsResult = filtered.count;
                } else {
                    const atomCount = parsed.positions.length / 3;
                    const colors = new Float32Array(atomCount * 3);

                    for (let index = 0; index < atomCount; index++) {
                        const color = mask[index] === 1 ? HIGHLIGHT_COLOR : DEFAULT_COLOR;
                        colors[index * 3] = color[0];
                        colors[index * 3 + 1] = color[1];
                        colors[index * 3 + 2] = color[2];
                        if (mask[index] === 1) {
                            atomsResult++;
                        }
                    }

                    buffer = nativeModuleLoader.getExporterModule().generatePointCloudGLB(
                        parsed.positions,
                        colors,
                        parsed.min,
                        parsed.max
                    );
                }
            }
            // parsed, mask, colors, filtered now out of scope — eligible for GC

            await uploadBuffer(minioService, input.objectKey, buffer);

            return {
                objectKey: input.objectKey,
                atomsResult
            };
        });
    }
});
