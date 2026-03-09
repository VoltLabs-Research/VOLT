import { ObjectBucketName } from '../contracts/http';
import { LocalMinioService } from './LocalMinioService';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';

interface NativeDumpResult {
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties?: Record<string, Float32Array>;
    metadata: {
        timestep: number;
        natoms: number;
        headers: string[];
    };
    min: [number, number, number];
    max: [number, number, number];
};

interface NativeDataResult {
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    metadata: {
        timestep: number;
        natoms: number;
        headers: string[];
    };
    min: [number, number, number];
    max: [number, number, number];
};

interface ParseOptions {
    includeIds?: boolean;
    properties?: string[];
};

interface ParsedTrajectory {
    metadata: {
        timestep: number;
        natoms: number;
        headers: string[];
        simulationCell: {
            boundingBox: {
                width: number;
                height: number;
                length: number;
            };
            geometry: {
                cell_vectors: number[][];
                cell_origin: number[];
                periodic_boundary_conditions: {
                    x: boolean;
                    y: boolean;
                    z: boolean;
                };
            };
        };
    };
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties?: Record<string, Float32Array>;
    min: [number, number, number];
    max: [number, number, number];
};

interface NativeDumpParserModule {
    parseDump(filePath: string, options: ParseOptions): NativeDumpResult | undefined;
};

interface NativeDataParserModule {
    parseData(filePath: string, options: { includeIds?: boolean; }): NativeDataResult | undefined;
};

interface NativeStatsModule {
    getStatsForProperty(filePath: string, propIdx: number): {
        min: number;
        max: number;
    };
    getUniqueValuesForProperty(filePath: string, propIdx: number, maxValues?: number): number[];
};

interface NativeExporterModule {
    generateGLBToFile(
        positions: Float32Array,
        types: Uint16Array,
        min: [number, number, number],
        max: [number, number, number],
        outputPath: string
    ): boolean;
    applyPropertyColors(
        values: Float32Array,
        minValue: number,
        maxValue: number,
        gradientType: number
    ): Float32Array;
    generatePointCloudGLB(
        positions: Float32Array,
        colors: Float32Array,
        min: [number, number, number],
        max: [number, number, number]
    ): Buffer;
    generateGLB(
        positions: Float32Array,
        types: Uint16Array,
        min: [number, number, number],
        max: [number, number, number]
    ): Buffer;
};

interface NativeRasterizerModule {
    rasterize(
        glbPath: string,
        pngPath: string,
        width: number,
        height: number,
        azimuth: number,
        elevation: number,
        options: {
            fov: number;
            distScale: number;
            zUp: boolean;
        }
    ): boolean;
};

interface NativeTrajectoryRequest {
    trajectoryId: string;
    timestep: number;
    objectKey?: string;
};

interface NativePropertyStatsRequest extends NativeTrajectoryRequest {
    property: string;
};

interface NativeUniqueValuesRequest extends NativePropertyStatsRequest {
    maxValues?: number;
};

interface NativeAtomsPageRequest extends NativeTrajectoryRequest {
    page: number;
    limit: number;
};

interface NativeColorModelRequest extends NativePropertyStatsRequest {
    objectKey: string;
    startValue: number;
    endValue: number;
    gradient: string;
    externalValuesBase64?: string;
};

interface NativeFilterPreviewRequest extends NativeTrajectoryRequest {
    property: string;
    operator: string;
    value: number;
    externalValuesBase64?: string;
};

interface NativeParticleFilterModelRequest extends NativeTrajectoryRequest {
    objectKey: string;
    action: 'delete' | 'highlight';
    maskBase64: string;
};

interface NativeAtomsPageResponse {
    atoms: Array<{
        id: number;
        type: number;
        x: number;
        y: number;
        z: number;
    }>;
    totalAtoms: number;
};

interface NativeFilterPreviewResponse {
    maskBase64: string;
    matchCount: number;
    totalAtoms: number;
};

enum GradientType {
    Viridis = 0,
    Plasma = 1,
    BlueRed = 2,
    Grayscale = 3
};

const HIGHLIGHT_COLOR = [1.0, 0.2, 0.6];
const DEFAULT_COLOR = [0.8, 0.8, 0.8];

export class NativeProcessingService {
    private readonly runtimeDir: string;
    private dumpParserModule: NativeDumpParserModule | null = null;
    private dataParserModule: NativeDataParserModule | null = null;
    private statsModule: NativeStatsModule | null = null;
    private exporterModule: NativeExporterModule | null = null;
    private rasterizerModule: NativeRasterizerModule | null = null;

    constructor(
        private readonly minioService: LocalMinioService
    ) {
        this.runtimeDir = path.join(process.cwd(), '.runtime', 'native-processing');
    }

    async preprocessTrajectory(input: NativeTrajectoryRequest): Promise<void> {
        await this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath);
            const tempGlbPath = this.createTempPath('.glb');
            const tempPngPath = this.createTempPath('.png');
            const modelObjectKey = this.getModelObjectKey(input.trajectoryId, input.timestep);
            const previewObjectKey = this.getPreviewObjectKey(input.trajectoryId, input.timestep);

            try {
                const exported = this.getExporterModule().generateGLBToFile(
                    parsed.positions,
                    parsed.types,
                    parsed.min,
                    parsed.max,
                    tempGlbPath
                );
                if (!exported) {
                    throw new Error('Failed to export trajectory GLB');
                }

                const glbBuffer = await fs.readFile(tempGlbPath);
                await this.minioService.putObject({
                    bucket: ObjectBucketName.Models,
                    objectKey: modelObjectKey,
                    body: glbBuffer,
                    metadata: {
                        'Content-Type': 'model/gltf-binary'
                    }
                });

                const rasterized = this.getRasterizerModule().rasterize(
                    tempGlbPath,
                    tempPngPath,
                    1600,
                    900,
                    45,
                    25,
                    {
                        fov: 45,
                        distScale: 1,
                        zUp: true
                    }
                );
                if (!rasterized) {
                    throw new Error('Failed to rasterize trajectory preview');
                }

                const pngBuffer = await fs.readFile(tempPngPath);
                await this.minioService.putObject({
                    bucket: ObjectBucketName.Rasterizer,
                    objectKey: previewObjectKey,
                    body: pngBuffer,
                    metadata: {
                        'Content-Type': 'image/png',
                        'Cache-Control': 'public, max-age=86400'
                    }
                });
            } finally {
                await Promise.all([
                    fs.unlink(tempGlbPath).catch(() => {}),
                    fs.unlink(tempPngPath).catch(() => {})
                ]);
            }
        });
    }

    async getTrajectoryMetadata(input: NativeTrajectoryRequest): Promise<ParsedTrajectory['metadata']> {
        return this.withDumpFile(input, async (dumpPath) => {
            return this.parseTrajectory(dumpPath, {
                properties: []
            }).metadata;
        });
    }

    async getPropertyStats(input: NativePropertyStatsRequest): Promise<{ min: number; max: number; }> {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                properties: []
            });
            const propertyIndex = parsed.metadata.headers.indexOf(input.property.toLowerCase());
            if (propertyIndex === -1) {
                throw new Error(`Property '${input.property}' not found in trajectory dump`);
            }

            return this.getStatsModule().getStatsForProperty(dumpPath, propertyIndex);
        });
    }

    async getUniqueValues(input: NativeUniqueValuesRequest): Promise<number[]> {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                properties: []
            });
            const propertyIndex = parsed.metadata.headers.indexOf(input.property.toLowerCase());
            if (propertyIndex === -1) {
                return [];
            }

            return this.getStatsModule().getUniqueValuesForProperty(dumpPath, propertyIndex, input.maxValues);
        });
    }

    async getAtomsPage(input: NativeAtomsPageRequest): Promise<NativeAtomsPageResponse> {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                includeIds: true,
                properties: []
            });
            const totalAtoms = parsed.ids?.length || parsed.positions.length / 3;
            const page = Math.max(1, input.page);
            const limit = Math.max(1, input.limit);
            const startIndex = (page - 1) * limit;
            const endIndex = Math.min(totalAtoms, startIndex + limit);
            const atoms: NativeAtomsPageResponse['atoms'] = [];

            for (let index = startIndex; index < endIndex; index++) {
                atoms.push({
                    id: Number(parsed.ids ? parsed.ids[index] : index + 1),
                    type: Number(parsed.types[index]),
                    x: Number(parsed.positions[index * 3]),
                    y: Number(parsed.positions[index * 3 + 1]),
                    z: Number(parsed.positions[index * 3 + 2])
                });
            }

            return {
                atoms,
                totalAtoms
            };
        });
    }

    async previewFilter(input: NativeFilterPreviewRequest): Promise<NativeFilterPreviewResponse> {
        return this.withDumpFile(input, async (dumpPath) => {
            let values: Float32Array;

            if (input.externalValuesBase64) {
                const parsed = this.parseTrajectory(dumpPath, {
                    includeIds: true,
                    properties: []
                });
                const externalValues = this.decodeFloat32Array(input.externalValuesBase64);
                values = new Float32Array(parsed.ids?.length || 0);

                if (parsed.ids) {
                    for (let index = 0; index < parsed.ids.length; index++) {
                        values[index] = externalValues[parsed.ids[index]] || 0;
                    }
                }
            } else {
                const parsed = this.parseTrajectory(dumpPath, {
                    includeIds: input.property.toLowerCase() === 'id',
                    properties: ['type', 'x', 'y', 'z', 'id'].includes(input.property.toLowerCase())
                        ? []
                        : [input.property]
                });
                values = this.getPropertyValues(parsed, input.property);
            }

            const filterResult = this.evaluateFilter(values, input.operator, input.value);
            return {
                maskBase64: Buffer.from(filterResult.mask).toString('base64'),
                matchCount: filterResult.matchCount,
                totalAtoms: filterResult.mask.length
            };
        });
    }

    async exportColoredModel(input: NativeColorModelRequest): Promise<{ objectKey: string; }> {
        await this.withDumpFile(input, async (dumpPath) => {
            const externalValues = input.externalValuesBase64
                ? this.decodeFloat32Array(input.externalValuesBase64)
                : undefined;
            const parsed = this.parseTrajectory(dumpPath, externalValues
                ? {
                    includeIds: true,
                    properties: []
                }
                : {
                    properties: [input.property]
                });

            const values = externalValues
                ? this.remapExternalValues(parsed, externalValues)
                : this.getPropertyValues(parsed, input.property);
            if (values.length === 0) {
                throw new Error(`Property '${input.property}' not found in trajectory dump`);
            }

            const colors = this.getExporterModule().applyPropertyColors(
                values,
                input.startValue,
                input.endValue,
                this.resolveGradientType(input.gradient)
            );
            const buffer = this.getExporterModule().generatePointCloudGLB(
                parsed.positions,
                colors,
                parsed.min,
                parsed.max
            );

            await this.minioService.putObject({
                bucket: ObjectBucketName.Models,
                objectKey: input.objectKey,
                body: buffer,
                metadata: {
                    'Content-Type': 'model/gltf-binary'
                }
            });
        });

        return {
            objectKey: input.objectKey
        };
    }

    async exportParticleFilterModel(input: NativeParticleFilterModelRequest): Promise<{ objectKey: string; atomsResult: number; }> {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath);
            const mask = this.decodeUint8Array(input.maskBase64);
            let buffer: Buffer;
            let atomsResult = 0;

            if (input.action === 'delete') {
                const inverseMask = new Uint8Array(mask.length);
                for (let index = 0; index < mask.length; index++) {
                    inverseMask[index] = mask[index] ? 0 : 1;
                }

                const filtered = this.filterByMask(parsed.positions, parsed.types, inverseMask);
                buffer = this.getExporterModule().generateGLB(
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

                buffer = this.getExporterModule().generatePointCloudGLB(
                    parsed.positions,
                    colors,
                    parsed.min,
                    parsed.max
                );
            }

            await this.minioService.putObject({
                bucket: ObjectBucketName.Models,
                objectKey: input.objectKey,
                body: buffer,
                metadata: {
                    'Content-Type': 'model/gltf-binary'
                }
            });

            return {
                objectKey: input.objectKey,
                atomsResult
            };
        });
    }

    private async withDumpFile<T>(input: NativeTrajectoryRequest, action: (dumpPath: string) => Promise<T>): Promise<T> {
        await fs.mkdir(this.runtimeDir, {
            recursive: true
        });

        const tempDumpPath = this.createTempPath('.dump');
        const objectKey = input.objectKey || this.getDumpObjectKey(input.trajectoryId, input.timestep);

        try {
            const stream = await this.minioService.getObjectStream(ObjectBucketName.Dumps, objectKey);
            await pipeline(stream, zlib.createGunzip(), createWriteStream(tempDumpPath));
            return action(tempDumpPath);
        } finally {
            await fs.unlink(tempDumpPath).catch(() => {});
        }
    }

    private createTempPath(extension: string): string {
        return path.join(this.runtimeDir, `${randomUUID()}${extension}`);
    }

    private parseTrajectory(filePath: string, options: ParseOptions = {}): ParsedTrajectory {
        const dumpResult = this.getDumpParserModule().parseDump(filePath, {
            includeIds: options.includeIds,
            properties: options.properties
        });
        if (dumpResult) {
            return this.toParsedDumpResult(dumpResult);
        }

        const dataResult = this.getDataParserModule().parseData(filePath, {
            includeIds: options.includeIds
        });
        if (dataResult) {
            return this.toParsedDataResult(dataResult);
        }

        throw new Error('Unsupported trajectory format');
    }

    private toParsedDumpResult(result: NativeDumpResult): ParsedTrajectory {
        const width = result.max[0] - result.min[0];
        const height = result.max[1] - result.min[1];
        const length = result.max[2] - result.min[2];

        return {
            metadata: {
                ...result.metadata,
                simulationCell: {
                    boundingBox: {
                        width,
                        height,
                        length
                    },
                    geometry: {
                        cell_vectors: [[width, 0, 0], [0, height, 0], [0, 0, length]],
                        cell_origin: result.min,
                        periodic_boundary_conditions: {
                            x: true,
                            y: true,
                            z: true
                        }
                    }
                }
            },
            positions: result.positions,
            types: result.types,
            ids: result.ids,
            properties: result.properties,
            min: result.min,
            max: result.max
        };
    }

    private toParsedDataResult(result: NativeDataResult): ParsedTrajectory {
        const width = result.max[0] - result.min[0];
        const height = result.max[1] - result.min[1];
        const length = result.max[2] - result.min[2];

        return {
            metadata: {
                ...result.metadata,
                simulationCell: {
                    boundingBox: {
                        width,
                        height,
                        length
                    },
                    geometry: {
                        cell_vectors: [[width, 0, 0], [0, height, 0], [0, 0, length]],
                        cell_origin: result.min,
                        periodic_boundary_conditions: {
                            x: true,
                            y: true,
                            z: true
                        }
                    }
                }
            },
            positions: result.positions,
            types: result.types,
            ids: result.ids,
            min: result.min,
            max: result.max
        };
    }

    private getPropertyValues(parsed: ParsedTrajectory, property: string): Float32Array {
        const lowerProperty = property.toLowerCase();

        if (lowerProperty === 'type') {
            return new Float32Array(parsed.types);
        }

        if (lowerProperty === 'x') {
            return this.extractAxisValues(parsed.positions, 0);
        }

        if (lowerProperty === 'y') {
            return this.extractAxisValues(parsed.positions, 1);
        }

        if (lowerProperty === 'z') {
            return this.extractAxisValues(parsed.positions, 2);
        }

        if (lowerProperty === 'id' && parsed.ids) {
            const values = new Float32Array(parsed.ids.length);
            for (let index = 0; index < parsed.ids.length; index++) {
                values[index] = parsed.ids[index];
            }
            return values;
        }

        return parsed.properties?.[property] || parsed.properties?.[lowerProperty] || new Float32Array(0);
    }

    private extractAxisValues(positions: Float32Array, axis: number): Float32Array {
        const values = new Float32Array(positions.length / 3);
        for (let index = 0; index < values.length; index++) {
            values[index] = positions[index * 3 + axis];
        }
        return values;
    }

    private remapExternalValues(parsed: ParsedTrajectory, externalValues: Float32Array): Float32Array {
        if (!parsed.ids) {
            throw new Error('Trajectory atom ids are required for external values');
        }

        const values = new Float32Array(parsed.ids.length);
        for (let index = 0; index < parsed.ids.length; index++) {
            values[index] = externalValues[parsed.ids[index]] || 0;
        }
        return values;
    }

    private evaluateFilter(values: Float32Array, operator: string, compareValue: number): { mask: Uint8Array; matchCount: number; } {
        const mask = new Uint8Array(values.length);
        let matchCount = 0;

        for (let index = 0; index < values.length; index++) {
            const value = values[index];
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
    }

    private filterByMask(positions: Float32Array, types: Uint16Array, mask: Uint8Array): {
        positions: Float32Array;
        types: Uint16Array;
        count: number;
    } {
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
    }

    private decodeFloat32Array(value: string): Float32Array {
        const buffer = Buffer.from(value, 'base64');
        return new Float32Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / Float32Array.BYTES_PER_ELEMENT));
    }

    private decodeUint8Array(value: string): Uint8Array {
        return new Uint8Array(Buffer.from(value, 'base64'));
    }

    private resolveGradientType(gradientName: string): GradientType {
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
    }

    private getDumpObjectKey(trajectoryId: string, timestep: number): string {
        return `trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`;
    }

    private getModelObjectKey(trajectoryId: string, timestep: number): string {
        return `trajectory-${trajectoryId}/timestep-${timestep}.glb`;
    }

    private getPreviewObjectKey(trajectoryId: string, timestep: number): string {
        return `trajectory-${trajectoryId}/previews/timestep-${timestep}.png`;
    }

    private getNativeModulePath(fileName: string): string {
        return path.resolve(process.cwd(), 'native', 'build', 'Release', fileName);
    }

    private getDumpParserModule(): NativeDumpParserModule {
        if (!this.dumpParserModule) {
            this.dumpParserModule = require(this.getNativeModulePath('dump_parser.node')) as NativeDumpParserModule;
        }

        return this.dumpParserModule;
    }

    private getDataParserModule(): NativeDataParserModule {
        if (!this.dataParserModule) {
            this.dataParserModule = require(this.getNativeModulePath('data_parser.node')) as NativeDataParserModule;
        }

        return this.dataParserModule;
    }

    private getStatsModule(): NativeStatsModule {
        if (!this.statsModule) {
            this.statsModule = require(this.getNativeModulePath('stats_parser.node')) as NativeStatsModule;
        }

        return this.statsModule;
    }

    private getExporterModule(): NativeExporterModule {
        if (!this.exporterModule) {
            this.exporterModule = require(this.getNativeModulePath('glb_exporter.node')) as NativeExporterModule;
        }

        return this.exporterModule;
    }

    private getRasterizerModule(): NativeRasterizerModule {
        if (!this.rasterizerModule) {
            this.rasterizerModule = require(this.getNativeModulePath('rasterizer.node')) as NativeRasterizerModule;
        }

        return this.rasterizerModule;
    }
};
