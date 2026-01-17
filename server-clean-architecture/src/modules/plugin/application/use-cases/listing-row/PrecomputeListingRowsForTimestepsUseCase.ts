import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { PrecomputeListingRowsForTimestepsInputDTO } from '../../dtos/listing-row/PrecomputeListingRowsForTimestepsDTO';
import { PLUGIN_TOKENS } from "../../../infrastructure/di/PluginTokens";
import { injectable, inject } from 'tsyringe';
import { IPluginRepository } from "../../../domain/ports/IPluginRepository";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { WorkflowNodeType } from "../../../domain/entities/workflow/WorkflowNode";
import { TRAJECTORY_TOKENS } from "@/src/modules/trajectory/infrastructure/di/TrajectoryTokens";
import { ITrajectoryRepository } from "@/src/modules/trajectory/domain/port/ITrajectoryRepository";
import { ANALYSIS_TOKENS } from "@/src/modules/analysis/infrastructure/di/AnalysisTokens";
import { IAnalysisRepository } from "@/src/modules/analysis/domain/port/IAnalysisRepository";
import { IExposureMetaRepository } from "../../../domain/ports/IExposureMetaRepository";

@injectable()
export default class PrecomputeListingRowsForTimestepsUseCase implements IUseCase<PrecomputeListingRowsForTimestepsInputDTO, null, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private pluginRepo: IPluginRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private trajectoryRepo: ITrajectoryRepository,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository,

        @inject(PLUGIN_TOKENS.ExposureMetaRepository)
        private exposureMetaRepo: IExposureMetaRepository
    ) { }

    async execute(input: PrecomputeListingRowsForTimestepsInputDTO): Promise<Result<null, ApplicationError>> {
        const { pluginId, teamId, trajectoryId, analysisId, listingSlug, timesteps } = input;
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        if (!trajectory) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }

        const analysis = await this.analysisRepo.findById(analysisId);
        if (!analysis) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            ));
        }

        const columns = plugin.props.workflow.findColumnsDefinitionsFromExposureVisualizer(listingSlug);
        if (!columns.length) return Result.ok(null);

        const exposureIds = plugin.props.workflow.props.nodes
            .filter((node) => node.type === WorkflowNodeType.Exposure)
            .map((node) => node.id);

        const primaryExposureId = plugin.props.workflow.findExposureByListingSlug(listingSlug);
        if (!primaryExposureId) return Result.ok(null);

        const nodeMap = plugin.props.workflow.getNodeMap();
        const parentMap = plugin.props.workflow.getParentMap();

        const metadatas = await this.exposureMetaRepo.findAll({
            filter: {
                plugin: pluginId,
                trajectory: trajectoryId,
                analysis: analysisId,
                // timestep: { $in: params.timesteps },
                // exposureId: { $in: exposureIds }
            },
            limit: -1,
            page: -1
        });

        const byTimestep = new Map<number, Map<string, any>>();
        for (const meta of metadatas.data) {
            const timestep = meta.props.timestep;
            let map = byTimestep.get(timestep);
            if (!map) {
                map = new Map();
                byTimestep.set(timestep, map);
            }

            map.set(meta.props.exposureId, meta.props.metadata || {});
        }

        const operations: any[] = [];
        for (const timestep of timesteps) {
            const perExposure = byTimestep.get(timestep);
            // Build exposureData even if no metas exist
            const exposureData = new Map<string, any>();
            for (const id of exposureIds) {
                exposureData.set(id, perExposure?.get(id) ?? {});
            }

            const context = {
                nodeMap,
                parentMap,
                trajectory,
                analysis,
                timestep
            };

            // TODO: Logic implementation
        }

        return Result.ok(null);
    }
};