import { Command, CommandGroup } from '@/core/commands/decorators';
import type { GlbExporter } from '@/modules/trajectory/application/glb/GlbExporter';
import type { TrajectoryParser } from '@/modules/trajectory/application/parsing/TrajectoryParser';
import type { TrajectoryPluginParser } from '@/modules/trajectory/application/parsing/TrajectoryPluginParser';
import type { FilterEvaluator } from '@/modules/trajectory/domain/services/FilterEvaluator';

@CommandGroup('trajectory.native')
export class TrajectoryNativeCommands {
    constructor(
        private readonly glbExporter: GlbExporter,
        private readonly trajectoryParser: TrajectoryParser,
        private readonly trajectoryPluginParser: TrajectoryPluginParser,
        private readonly filterEvaluator: FilterEvaluator
    ) {}

    @Command('preprocess')
    async preprocess(payload: any) {
        await this.glbExporter.preprocessTrajectory(payload);
        return { glbExported: true };
    }

    @Command('metadata')
    metadata(payload: any) {
        return this.trajectoryParser.getTrajectoryMetadata(payload);
    }

    @Command('property-stats')
    propertyStats(payload: any) {
        return this.trajectoryParser.getPropertyStats(payload);
    }

    @Command('unique-values')
    uniqueValues(payload: any) {
        return this.trajectoryParser.getUniqueValues(payload);
    }

    @Command('atom-ids')
    atomIds(payload: any) {
        return this.trajectoryParser.getAtomIds(payload);
    }

    @Command('atoms')
    async atoms(payload: any) {
        const nativeResult = await this.trajectoryParser.getAtomsPage(payload);
        if (!payload.analysisId) {
            return nativeResult;
        }

        if (!payload.ownerClusterId) {
            throw new Error(
                `ownerClusterId is required to load per-atom analysis data for trajectory ${payload.trajectoryId}`
            );
        }

        const atomIds = new Set<number>(
            nativeResult.atoms.map((atom: Record<string, unknown>) => Number(atom.id))
        );
        const analysisResult = await this.trajectoryPluginParser.getAnalysisAllPerAtomData({
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
    filterPreview(payload: any) {
        return this.filterEvaluator.previewFilter(payload);
    }

    @Command('color-model')
    colorModel(payload: any) {
        return this.filterEvaluator.exportColoredModel(payload);
    }

    @Command('particle-filter-model')
    particleFilterModel(payload: any) {
        return this.filterEvaluator.exportParticleFilterModel(payload);
    }
}
