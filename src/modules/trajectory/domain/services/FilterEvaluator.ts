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
import type {
    DumpFileInput,
    ParsedTrajectory,
    TrajectoryParser
} from '@/modules/trajectory/application/parsing/TrajectoryParser';
import type { TrajectoryPluginParser } from '@/modules/trajectory/application/parsing/TrajectoryPluginParser';

export type ComparisonOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';

export interface PreviewFilterInput {
    trajectoryId: string;
    timestep: number;
    ownerClusterId: string;
    objectKey?: string;
    property: string;
    operator: ComparisonOperator;
    value: number;
    analysisId?: string;
    exposureId?: string;
    externalValuesBase64?: string;
}

export interface PreviewFilterResult {
    maskBase64: string;
    matchCount: number;
    totalAtoms: number;
}

export interface ExportColoredModelInput {
    trajectoryId: string;
    timestep: number;
    ownerClusterId: string;
    objectKey: string;
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
    analysisId?: string;
    exposureId?: string;
    externalValuesBase64?: string;
}

export interface ExportColoredModelResult {
    objectKey: string;
}

export interface ExportParticleFilterModelInput {
    trajectoryId: string;
    timestep: number;
    ownerClusterId: string;
    objectKey: string;
    action: 'delete' | 'highlight';
    maskBase64: string;
}

export interface ExportParticleFilterModelResult {
    objectKey: string;
    atomsResult: number;
}

interface PerAtomValueSource {
    trajectoryId: string;
    timestep: number;
    ownerClusterId: string;
    property: string;
    analysisId?: string;
    exposureId?: string;
    externalValuesBase64?: string;
}

interface ResolvedTrajectoryValues {
    parsed: ParsedTrajectory;
    values: Float32Array;
}

enum GradientCode {
    Viridis = 0,
    Plasma = 1,
    BlueRed = 2,
    Grayscale = 3
}

const GRADIENT_BY_NAME: Record<string, GradientCode> = {
    viridis: GradientCode.Viridis,
    plasma: GradientCode.Plasma,
    bluered: GradientCode.BlueRed,
    grayscale: GradientCode.Grayscale
};

const POSITIONAL_PROPERTIES: ReadonlySet<string> = new Set(['type', 'x', 'y', 'z', 'id']);

const HIGHLIGHT_COLOR: readonly [number, number, number] = [1.0, 0.2, 0.6];
const DEFAULT_COLOR: readonly [number, number, number] = [0.8, 0.8, 0.8];

const resolveGradientCode = (gradient: string): GradientCode => (
    GRADIENT_BY_NAME[gradient.toLowerCase()] ?? GradientCode.Viridis
);

const toDumpLookup = (input: {
    trajectoryId: string;
    timestep: number;
    ownerClusterId: string;
}): DumpFileInput => ({
    trajectoryId: input.trajectoryId,
    timestep: input.timestep,
    ownerClusterId: input.ownerClusterId
});

const evaluateComparison = (
    values: Float32Array,
    operator: ComparisonOperator,
    reference: number
): { mask: Uint8Array; matchCount: number } => {
    const mask = new Uint8Array(values.length);
    let matchCount = 0;

    for (let index = 0; index < values.length; index++) {
        const value = values[index];
        let matches = false;

        switch (operator) {
            case '==':
                matches = value === reference;
                break;
            case '!=':
                matches = value !== reference;
                break;
            case '>':
                matches = value > reference;
                break;
            case '>=':
                matches = value >= reference;
                break;
            case '<':
                matches = value < reference;
                break;
            case '<=':
                matches = value <= reference;
                break;
        }

        if (matches) {
            mask[index] = 1;
            matchCount++;
        }
    }

    return { mask, matchCount };
};

const countActive = (mask: Uint8Array): number => {
    let count = 0;
    for (let index = 0; index < mask.length; index++) {
        if (mask[index]) count++;
    }
    return count;
};

const invertMask = (mask: Uint8Array): Uint8Array => {
    const inverted = new Uint8Array(mask.length);
    for (let index = 0; index < mask.length; index++) {
        inverted[index] = mask[index] ? 0 : 1;
    }
    return inverted;
};

const selectAtomsByMask = (
    positions: Float32Array,
    types: Uint16Array,
    mask: Uint8Array
): { positions: Float32Array; types: Uint16Array; count: number } => {
    const count = countActive(mask);
    const selectedPositions = new Float32Array(count * 3);
    const selectedTypes = new Uint16Array(count);
    let cursor = 0;

    for (let index = 0; index < mask.length; index++) {
        if (!mask[index]) continue;

        const sourceOffset = index * 3;
        const targetOffset = cursor * 3;
        selectedPositions[targetOffset] = positions[sourceOffset];
        selectedPositions[targetOffset + 1] = positions[sourceOffset + 1];
        selectedPositions[targetOffset + 2] = positions[sourceOffset + 2];
        selectedTypes[cursor] = types[index];
        cursor++;
    }

    return { positions: selectedPositions, types: selectedTypes, count };
};

const buildHighlightColors = (
    mask: Uint8Array,
    atomCount: number
): { colors: Float32Array; highlightedCount: number } => {
    const colors = new Float32Array(atomCount * 3);
    let highlightedCount = 0;

    for (let index = 0; index < atomCount; index++) {
        const color = mask[index] === 1 ? HIGHLIGHT_COLOR : DEFAULT_COLOR;
        const offset = index * 3;
        colors[offset] = color[0];
        colors[offset + 1] = color[1];
        colors[offset + 2] = color[2];
        if (mask[index] === 1) {
            highlightedCount++;
        }
    }

    return { colors, highlightedCount };
};

@Service('filterEvaluator')
export class FilterEvaluator {
    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly trajectoryParser: TrajectoryParser,
        private readonly trajectoryPluginParser: TrajectoryPluginParser
    ) {}

    previewFilter(input: PreviewFilterInput): Promise<PreviewFilterResult> {
        return this.trajectoryParser.withDumpFile(toDumpLookup(input), async (dumpPath) => {
            const { values } = await this.resolveTrajectoryValues(dumpPath, input);
            const { mask, matchCount } = evaluateComparison(values, input.operator, input.value);

            return {
                maskBase64: Buffer.from(mask.buffer, mask.byteOffset, mask.byteLength).toString('base64'),
                matchCount,
                totalAtoms: mask.length
            };
        });
    }

    exportColoredModel(input: ExportColoredModelInput): Promise<ExportColoredModelResult> {
        return this.trajectoryParser.withDumpFile(toDumpLookup(input), async (dumpPath) => {
            const { parsed, values } = await this.resolveTrajectoryValues(dumpPath, input);
            const gradientCode = resolveGradientCode(input.gradient);
            const colors: Float32Array = spatialAssembler.applyPropertyColors(
                values,
                input.startValue,
                input.endValue,
                gradientCode
            );
            const buffer: Buffer = spatialAssembler.generatePointCloudGLB(
                parsed.positions,
                colors,
                parsed.min,
                parsed.max
            );

            await this.uploadGlb(buffer, input.objectKey, input.ownerClusterId);

            return { objectKey: input.objectKey };
        });
    }

    exportParticleFilterModel(
        input: ExportParticleFilterModelInput
    ): Promise<ExportParticleFilterModelResult> {
        return this.trajectoryParser.withDumpFile(toDumpLookup(input), async (dumpPath) => {
            const parsed = this.trajectoryParser.parseTrajectory(dumpPath);
            const atomCount = parsed.positions.length / 3;
            const mask = this.trajectoryParser.decodeUint8Array(input.maskBase64);

            if (mask.length !== atomCount) {
                throw ApplicationError.badRequest(
                    'MASK_LENGTH_MISMATCH',
                    `Mask length (${mask.length}) does not match trajectory atom count (${atomCount}) ` +
                    `at timestep ${input.timestep}.`
                );
            }

            const { buffer, atomsResult } = input.action === 'delete'
                ? this.buildDeletedAtomsModel(parsed, mask)
                : this.buildHighlightedAtomsModel(parsed, mask, atomCount);

            await this.uploadGlb(buffer, input.objectKey, input.ownerClusterId);

            return { objectKey: input.objectKey, atomsResult };
        });
    }

    private buildDeletedAtomsModel(
        parsed: ParsedTrajectory,
        mask: Uint8Array
    ): { buffer: Buffer; atomsResult: number } {
        const retainMask = invertMask(mask);
        const retained = selectAtomsByMask(parsed.positions, parsed.types, retainMask);
        if (retained.count === 0) {
            throw ApplicationError.unprocessableEntity(
                'EMPTY_FILTER_RESULT',
                `Particle filter removed all ${mask.length} atom(s); the resulting model would be empty. ` +
                'Adjust the filter so that at least one atom is retained.'
            );
        }

        const buffer: Buffer = spatialAssembler.generateGLB(
            retained.positions,
            retained.types,
            parsed.min,
            parsed.max
        );

        return { buffer, atomsResult: retained.count };
    }

    private buildHighlightedAtomsModel(
        parsed: ParsedTrajectory,
        mask: Uint8Array,
        atomCount: number
    ): { buffer: Buffer; atomsResult: number } {
        const { colors, highlightedCount } = buildHighlightColors(mask, atomCount);
        const buffer: Buffer = spatialAssembler.generatePointCloudGLB(
            parsed.positions,
            colors,
            parsed.min,
            parsed.max
        );

        return { buffer, atomsResult: highlightedCount };
    }

    private async resolveTrajectoryValues(
        dumpPath: string,
        input: PerAtomValueSource
    ): Promise<ResolvedTrajectoryValues> {
        const externalValues = await this.resolveExternalValues(input);

        if (externalValues) {
            const parsed = this.trajectoryParser.parseTrajectory(dumpPath, {
                includeIds: true,
                properties: []
            });
            const values = this.trajectoryParser.remapExternalValues(parsed, externalValues);
            this.assertValuesAvailable(values, input);
            return { parsed, values };
        }

        const lowerProperty = input.property.toLowerCase();
        const parsed = this.trajectoryParser.parseTrajectory(dumpPath, {
            includeIds: lowerProperty === 'id',
            properties: POSITIONAL_PROPERTIES.has(lowerProperty) ? [] : [input.property]
        });
        const values = this.trajectoryParser.getPropertyValues(parsed, input.property);
        this.assertValuesAvailable(values, input);
        return { parsed, values };
    }

    private async resolveExternalValues(input: PerAtomValueSource): Promise<Float32Array | undefined> {
        if (input.externalValuesBase64) {
            return this.trajectoryParser.decodeFloat32Array(input.externalValuesBase64);
        }

        if (!input.analysisId || !input.exposureId) {
            return undefined;
        }

        const modifierValues = await this.trajectoryPluginParser.getModifierValues({
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            exposureId: input.exposureId,
            timestep: input.timestep,
            property: input.property,
            ownerClusterId: input.ownerClusterId
        });

        if (!modifierValues) {
            throw ApplicationError.unprocessableEntity(
                'MODIFIER_VALUES_UNAVAILABLE',
                `Per-atom property "${input.property}" is not available for exposure "${input.exposureId}" ` +
                `on analysis "${input.analysisId}" at timestep ${input.timestep}.`
            );
        }

        return modifierValues;
    }

    private assertValuesAvailable(values: Float32Array, input: PerAtomValueSource): void {
        if (values.length > 0) return;

        throw ApplicationError.unprocessableEntity(
            'PROPERTY_NOT_FOUND',
            `Property "${input.property}" is not present in the trajectory at timestep ${input.timestep}.`
        );
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
            tempDirectory: path.join(DAEMON_PATHS.analysisOutput, 'filter-export'),
            tempFilePrefix: 'volt-filter-export',
            tempFileSuffix: '.glb'
        });
    }
}
