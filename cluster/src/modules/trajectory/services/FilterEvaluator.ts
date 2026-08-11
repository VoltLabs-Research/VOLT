import { ErrorCodes } from '@core/constants/error-codes';
import { singleton } from '@shared/application/utilities/singleton';
import { getTrajectoryParser } from '@modules/trajectory/services/parsing/TrajectoryParser';
import { getPluginPropertyStore } from '@modules/plugin/services/ParquetPluginPropertyStore';
import spatialAssembler from '@voltstack/spatial-assembler';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { toBytes, type InboundChunk } from '@shared/contracts/channel/binary-envelope';
import {
    buildCategoricalColors,
    buildHighlightColors,
    evaluateComparison,
    evaluateStringComparison,
    invertMask,
    selectAtomsByMask
} from '@modules/trajectory/services/particle-filter-kernels';
import { resolvePerAtomValues } from '@modules/trajectory/services/per-atom-value-resolver';
import { resolveGradientCode } from '@modules/trajectory/services/gradient-codes';
import { uploadGlbBuffer } from '@modules/trajectory/services/glb/upload-glb-buffer';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { type ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import type { ComparisonOperator } from '@modules/trajectory/services/particle-filter-kernels';
import type { ParsedTrajectory, TrajectoryParser } from '@modules/trajectory/services/parsing/TrajectoryParser';
import type { PluginPropertyStore } from '@modules/plugin/services/properties/PluginPropertyStore';

export interface PreviewFilterInput {
    trajectoryId: string;
    timestep: number;
    ownerClusterId: string;
    property: string;
    operator: ComparisonOperator;
    value: number | string;
    analysisId?: string;
    exposureId?: string;
    externalValues?: InboundChunk;
}

interface PreviewFilterResult {
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
    externalValues?: InboundChunk;
}

interface ExportColoredModelResult {
    objectKey: string;
}

export interface ExportParticleFilterModelInput {
    trajectoryId: string;
    timestep: number;
    ownerClusterId: string;
    objectKey: string;
    action: 'delete' | 'highlight';
    /* Built on the server and shipped over the reverse channel, so not a typed array yet. */
    mask: InboundChunk;
}

interface ExportParticleFilterModelResult {
    objectKey: string;
    atomsResult: number;
}

export class FilterEvaluator {
    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly trajectoryParser: TrajectoryParser,
        private readonly pluginPropertyStore: PluginPropertyStore
    ) {}

    async previewFilter(input: PreviewFilterInput): Promise<PreviewFilterResult> {
        const resolved = await resolvePerAtomValues(this.trajectoryParser, this.pluginPropertyStore, input);
        const { mask, matchCount } = resolved.valueType === 'string'
            ? evaluateStringComparison(resolved.values, input.operator, String(input.value))
            : evaluateComparison(resolved.values, input.operator, Number(input.value));
        return {
            mask,
            matchCount,
            totalAtoms: mask.length
        };
    }

    async exportColoredModel(input: ExportColoredModelInput): Promise<ExportColoredModelResult> {
        const resolved = await resolvePerAtomValues(this.trajectoryParser, this.pluginPropertyStore, input);
        const { parsed } = resolved;
        const colors: Float32Array = resolved.valueType === 'string'
            ? buildCategoricalColors(resolved.values, parsed.positions.length / 3)
            : spatialAssembler.applyPropertyColors(
                resolved.values,
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

        await uploadGlbBuffer(this.objectStore, buffer, input.objectKey, input.ownerClusterId);

        return { objectKey: input.objectKey };
    }

    async exportParticleFilterModel(
        input: ExportParticleFilterModelInput
    ): Promise<ExportParticleFilterModelResult> {
        const parsed = await this.trajectoryParser.readFrame(input);
        const atomCount = parsed.positions.length / 3;
        const mask = toBytes(input.mask);

        if (mask.length !== atomCount) {
            throw ApplicationError.badRequest(
                ErrorCodes.FILTER_MASK_LENGTH_MISMATCH,
                `Mask length (${mask.length}) does not match trajectory atom count (${atomCount}) ` +
                `at timestep ${input.timestep}.`
            );
        }

        const { buffer, atomsResult } = input.action === 'delete'
            ? this.buildDeletedAtomsModel(parsed, mask)
            : this.buildHighlightedAtomsModel(parsed, mask, atomCount);

        await uploadGlbBuffer(this.objectStore, buffer, input.objectKey, input.ownerClusterId);

        return {
            objectKey: input.objectKey,
            atomsResult
        };
    }

    private buildDeletedAtomsModel(
        parsed: ParsedTrajectory,
        mask: Uint8Array
    ): { buffer: Buffer; atomsResult: number } {
        const retained = selectAtomsByMask(parsed.positions, parsed.types, invertMask(mask));
        if (retained.count === 0) {
            throw ApplicationError.unprocessableEntity(
                ErrorCodes.FILTER_EMPTY_RESULT,
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

        return {
            buffer,
            atomsResult: retained.count
        };
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

        return {
            buffer,
            atomsResult: highlightedCount
        };
    }
}

export const getFilterEvaluator = singleton((): FilterEvaluator => new FilterEvaluator(getObjectStore(), getTrajectoryParser(), getPluginPropertyStore()));
