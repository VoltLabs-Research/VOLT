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
import type { PluginPropertyStore } from '@/modules/plugin/application/properties/PluginPropertyStore';

export type ComparisonOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';

export interface PreviewFilterInput {
    trajectoryId: string;
    timestep: number;
    ownerClusterId: string;
    objectKey?: string;
    property: string;
    operator: ComparisonOperator;
    value: number | string;
    analysisId?: string;
    exposureId?: string;
    externalValues?: Uint8Array | Float32Array;
}

export interface PreviewFilterResult {
    mask: Uint8Array;
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
    externalValues?: Uint8Array | Float32Array;
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
    mask: Uint8Array;
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
    externalValues?: Uint8Array | Float32Array;
}

interface ResolvedTrajectoryValues {
    parsed: ParsedTrajectory;
    values: Float32Array | Array<string | null>;
    valueType: 'number' | 'string';
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

type ScalarComparator = (value: number, reference: number) => boolean;

const selectCmp = (operator: ComparisonOperator): ScalarComparator => {
    switch (operator) {
        case '==': return (value, reference) => value === reference;
        case '!=': return (value, reference) => value !== reference;
        case '>':  return (value, reference) => value > reference;
        case '>=': return (value, reference) => value >= reference;
        case '<':  return (value, reference) => value < reference;
        case '<=': return (value, reference) => value <= reference;
        default: {
            const unreachable: never = operator;
            throw new Error(`FilterEvaluator: unsupported comparison operator '${unreachable}'`);
        }
    }
};

// Why: hoisting the switch out of the loop avoids one branch per atom.
// For 10M-atom sweeps (property filter) this alone is ~20-30% faster in
// warm V8 benchmarks because the inner call site monomorphizes to the
// selected comparator.
const evaluateComparison = (
    values: Float32Array,
    operator: ComparisonOperator,
    reference: number
): { mask: Uint8Array; matchCount: number } => {
    const length = values.length;
    const mask = new Uint8Array(length);
    const cmp = selectCmp(operator);
    let matchCount = 0;

    for (let index = 0; index < length; index++) {
        if (cmp(values[index], reference)) {
            mask[index] = 1;
            matchCount++;
        }
    }

    return { mask, matchCount };
};

const evaluateStringComparison = (
    values: Array<string | null>,
    operator: ComparisonOperator,
    reference: string
): { mask: Uint8Array; matchCount: number } => {
    if (operator !== '==' && operator !== '!=') {
        throw ApplicationError.badRequest(
            'FILTER_STRING_OPERATOR_UNSUPPORTED',
            'String particle filters support only == and != operators.'
        );
    }

    const length = values.length;
    const mask = new Uint8Array(length);
    let matchCount = 0;

    for (let index = 0; index < length; index++) {
        const current = values[index];
        const matches = operator === '=='
            ? current === reference
            : current !== null && current !== reference;
        if (matches) {
            mask[index] = 1;
            matchCount++;
        }
    }

    return { mask, matchCount };
};

const countActive = (mask: Uint8Array): number => {
    const length = mask.length;
    let count = 0;
    for (let index = 0; index < length; index++) {
        count += mask[index];
    }
    return count;
};

const invertMask = (mask: Uint8Array): Uint8Array => {
    const length = mask.length;
    const inverted = new Uint8Array(length);
    for (let index = 0; index < length; index++) {
        inverted[index] = mask[index] ^ 1;
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
        private readonly pluginPropertyStore: PluginPropertyStore
    ) {}

    async previewFilter(input: PreviewFilterInput): Promise<PreviewFilterResult> {
        const { values, valueType } = await this.resolveTrajectoryValues(input);
        const { mask, matchCount } = valueType === 'string'
            ? evaluateStringComparison(values as Array<string | null>, input.operator, String(input.value))
            : evaluateComparison(values as Float32Array, input.operator, Number(input.value));
        return {
            mask,
            matchCount,
            totalAtoms: mask.length
        };
    }

    async exportColoredModel(input: ExportColoredModelInput): Promise<ExportColoredModelResult> {
        const { parsed, values, valueType } = await this.resolveTrajectoryValues(input);
        const colors: Float32Array = valueType === 'string'
            ? this.buildCategoricalColors(values as Array<string | null>, parsed.positions.length / 3)
            : spatialAssembler.applyPropertyColors(
                values as Float32Array,
                input.startValue,
                input.endValue,
                resolveGradientCode(input.gradient)
            );
        const buffer: Buffer = spatialAssembler.generatePointCloudGLB(
            parsed.positions,
            colors,
            parsed.min,
            parsed.max
        );

        await this.uploadGlb(buffer, input.objectKey, input.ownerClusterId);

        return { objectKey: input.objectKey };
    }

    async exportParticleFilterModel(
        input: ExportParticleFilterModelInput
    ): Promise<ExportParticleFilterModelResult> {
        const parsed = await this.trajectoryParser.readFrame(toDumpLookup(input));
        const atomCount = parsed.positions.length / 3;
        const mask = input.mask instanceof Uint8Array
            ? input.mask
            : new Uint8Array(input.mask as unknown as ArrayBufferLike);

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
        input: PerAtomValueSource
    ): Promise<ResolvedTrajectoryValues> {
        const parsed = await this.trajectoryParser.readFrame({
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            ownerClusterId: input.ownerClusterId
        });
        const externalValues = await this.resolveExternalValues(input);

        if (externalValues) {
            if (externalValues.type === 'string') {
                const values = this.remapExternalStringValues(parsed, externalValues.values);
                this.assertStringValuesAvailable(values, input);
                return { parsed, values, valueType: 'string' };
            }

            const values = this.trajectoryParser.remapExternalValues(parsed, externalValues.values);
            this.assertValuesAvailable(values, input);
            return { parsed, values, valueType: 'number' };
        }

        const values = this.trajectoryParser.getPropertyValues(parsed, input.property);
        this.assertValuesAvailable(values, input);
        return { parsed, values, valueType: 'number' };
    }

    private async resolveExternalValues(input: PerAtomValueSource): Promise<
        | { type: 'number'; values: Float32Array }
        | { type: 'string'; values: Array<string | null> }
        | undefined
    > {
        if (input.externalValues) {
            if (input.externalValues instanceof Float32Array) {
                return { type: 'number', values: input.externalValues };
            }
            const bytes = input.externalValues instanceof Uint8Array
                ? input.externalValues
                : new Uint8Array(input.externalValues as unknown as ArrayBufferLike);
            // Why: the sender may align the Float32 data on arbitrary offsets
            // (e.g. inside a binary envelope payload). A typed-array cast is
            // only legal when the byte offset is a multiple of 4; copy once
            // when that precondition fails.
            if ((bytes.byteOffset % Float32Array.BYTES_PER_ELEMENT) === 0) {
                return {
                    type: 'number',
                    values: new Float32Array(
                        bytes.buffer,
                        bytes.byteOffset,
                        bytes.byteLength / Float32Array.BYTES_PER_ELEMENT
                    )
                };
            }
            const aligned = new Uint8Array(bytes);
            return { type: 'number', values: new Float32Array(aligned.buffer) };
        }

        if (!input.analysisId || !input.exposureId) {
            return undefined;
        }

        const modifierValues = await this.pluginPropertyStore.getModifierScalarValues({
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

    private remapExternalStringValues(parsed: ParsedTrajectory, externalValues: Array<string | null>): Array<string | null> {
        if (!parsed.ids) {
            throw new Error('Trajectory atom ids are required for external values');
        }
        const values = Array<string | null>(parsed.ids.length).fill(null);
        for (let index = 0; index < parsed.ids.length; index++) {
            values[index] = externalValues[parsed.ids[index]] ?? null;
        }
        return values;
    }

    private assertValuesAvailable(values: Float32Array, input: PerAtomValueSource): void {
        if (values.length > 0) return;

        throw ApplicationError.unprocessableEntity(
            'PROPERTY_NOT_FOUND',
            `Property "${input.property}" is not present in the trajectory at timestep ${input.timestep}.`
        );
    }

    private assertStringValuesAvailable(values: Array<string | null>, input: PerAtomValueSource): void {
        if (values.some((value) => value !== null)) return;

        throw ApplicationError.unprocessableEntity(
            'PROPERTY_NOT_FOUND',
            `Property "${input.property}" is not present in the trajectory at timestep ${input.timestep}.`
        );
    }

    private buildCategoricalColors(values: Array<string | null>, atomCount: number): Float32Array {
        const palette: Array<readonly [number, number, number]> = [
            [0.121, 0.466, 0.705],
            [1.0, 0.498, 0.054],
            [0.172, 0.627, 0.172],
            [0.839, 0.152, 0.156],
            [0.580, 0.404, 0.741],
            [0.549, 0.337, 0.294],
            [0.890, 0.466, 0.760],
            [0.498, 0.498, 0.498],
            [0.737, 0.741, 0.133],
            [0.090, 0.745, 0.811]
        ];
        const categories = new Map<string, number>();
        const colors = new Float32Array(atomCount * 3);

        for (let index = 0; index < atomCount; index++) {
            const category = values[index];
            const offset = index * 3;
            if (category === null) {
                colors[offset] = DEFAULT_COLOR[0];
                colors[offset + 1] = DEFAULT_COLOR[1];
                colors[offset + 2] = DEFAULT_COLOR[2];
                continue;
            }

            if (!categories.has(category)) {
                categories.set(category, categories.size);
            }
            const color = palette[(categories.get(category) ?? 0) % palette.length];
            colors[offset] = color[0];
            colors[offset + 1] = color[1];
            colors[offset + 2] = color[2];
        }

        return colors;
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
