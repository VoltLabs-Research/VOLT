import { getGlbExporter } from '@modules/trajectory/services/glb/GlbExporter';
import { getTrajectoryParser } from '@modules/trajectory/services/parsing/TrajectoryParser';
import { getPluginPropertyStore } from '@modules/plugin/services/ParquetPluginPropertyStore';
import { getFilterEvaluator } from '@modules/trajectory/services/FilterEvaluator';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import type { GlbExporter, PreprocessTrajectoryInput } from '@modules/trajectory/services/glb/GlbExporter';
import type {
    AtomsPageInput,
    PropertyStatsInput,
    TrajectoryParser,
    UniqueValuesInput
} from '@modules/trajectory/services/parsing/TrajectoryParser';
import type { PluginPropertyStore } from '@modules/plugin/services/properties/PluginPropertyStore';
import type {
    ExportColoredModelInput,
    ExportParticleFilterModelInput,
    FilterEvaluator,
    PreviewFilterInput
} from '@modules/trajectory/services/FilterEvaluator';
import type { TrajectoryFrameLookupInput } from '@shared/contracts/types/trajectory-frame-store';

/**
 * Per-atom analysis data is an opt-in extension of an atoms page: passing an
 * `analysisId` also requires the cluster that owns the analysis artifacts.
 */
export interface AtomsCommandInput extends AtomsPageInput {
    analysisId?: string;
}

@CommandGroup('trajectory.native')
export class TrajectoryNativeCommands {
    constructor(
        private readonly glbExporter: GlbExporter,
        private readonly trajectoryParser: TrajectoryParser,
        private readonly pluginPropertyStore: PluginPropertyStore,
        private readonly filterEvaluator: FilterEvaluator
    ) {}

    @Command('metadata')
    metadata(payload: TrajectoryFrameLookupInput) {
        return this.trajectoryParser.getTrajectoryMetadata(payload);
    }

    @Command('property-stats')
    propertyStats(payload: PropertyStatsInput) {
        return this.trajectoryParser.getPropertyStats(payload);
    }

    @Command('unique-values')
    uniqueValues(payload: UniqueValuesInput) {
        return this.trajectoryParser.getUniqueValues(payload);
    }

    @Command('atoms')
    async atoms(payload: AtomsCommandInput) {
        const nativeResult = await this.trajectoryParser.getAtomsPage(payload);
        if (!payload.analysisId) {
            return nativeResult;
        }

        if (!payload.ownerClusterId) {
            throw ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_OWNER_CLUSTER_REQUIRED,
                `ownerClusterId is required to load per-atom analysis data for trajectory ${payload.trajectoryId}`
            );
        }

        const atomIds = new Set<number>(nativeResult.atoms.map((atom) => atom.id));
        const analysisResult = await this.pluginPropertyStore.getAnalysisAllPerAtomData({
            trajectoryId: payload.trajectoryId,
            analysisId: payload.analysisId,
            timestep: payload.timestep,
            atomIds,
            ownerClusterId: payload.ownerClusterId
        });

        return {
            ...nativeResult,
            analysisPropertyNames: analysisResult.propertyNames,
            analysisAtoms: analysisResult.atoms
        };
    }

    @Command('filter-preview')
    filterPreview(payload: PreviewFilterInput) {
        return this.filterEvaluator.previewFilter(payload);
    }

    @Command('color-model')
    colorModel(payload: ExportColoredModelInput) {
        return this.filterEvaluator.exportColoredModel(payload);
    }

    @Command('particle-filter-model')
    particleFilterModel(payload: ExportParticleFilterModelInput) {
        return this.filterEvaluator.exportParticleFilterModel(payload);
    }
}

export const getTrajectoryNativeCommands = commandGroupFactory(TrajectoryNativeCommands, () => new TrajectoryNativeCommands(getGlbExporter(), getTrajectoryParser(), getPluginPropertyStore(), getFilterEvaluator()));
