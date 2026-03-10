import { rasterizeTrajectory } from '../../core/runtimeActions';
import type { MinioService } from '../../infrastructure/minio/MinioService';
import type { FilterEvaluatorService } from '../../modules/native/FilterEvaluatorService';
import type { GlbExporterService } from '../../modules/native/GlbExporterService';
import type { RasterizerService } from '../../modules/native/RasterizerService';
import type { TrajectoryParserService } from '../../modules/native/TrajectoryParserService';
import type { ReverseChannelCommandHandler } from '../ReverseChannelSocketBridge';

interface TrajectoryHandlersDependencies {
    minioService: MinioService;
    rasterizerService: RasterizerService;
    trajectoryParserService: TrajectoryParserService;
    glbExporterService: GlbExporterService;
    filterEvaluatorService: FilterEvaluatorService;
}

export const createTrajectoryHandlers = (deps: TrajectoryHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'trajectory.rasterize',
        execute: async (payload) => ({
            data: await rasterizeTrajectory(payload as never, deps.minioService, deps.rasterizerService)
        })
    },
    {
        command: 'trajectory.native.preprocess',
        execute: async (payload) => {
            await deps.glbExporterService.preprocessTrajectory(payload as never);
            return { data: { processed: true } };
        }
    },
    {
        command: 'trajectory.native.metadata',
        execute: async (payload) => ({
            data: await deps.trajectoryParserService.getTrajectoryMetadata(payload as never)
        })
    },
    {
        command: 'trajectory.native.property-stats',
        execute: async (payload) => ({
            data: await deps.trajectoryParserService.getPropertyStats(payload as never)
        })
    },
    {
        command: 'trajectory.native.unique-values',
        execute: async (payload) => ({
            data: await deps.trajectoryParserService.getUniqueValues(payload as never)
        })
    },
    {
        command: 'trajectory.native.atoms',
        execute: async (payload) => ({
            data: await deps.trajectoryParserService.getAtomsPage(payload as never)
        })
    },
    {
        command: 'trajectory.native.filter-preview',
        execute: async (payload) => ({
            data: await deps.filterEvaluatorService.previewFilter(payload as never)
        })
    },
    {
        command: 'trajectory.native.color-model',
        execute: async (payload) => ({
            data: await deps.filterEvaluatorService.exportColoredModel(payload as never)
        })
    },
    {
        command: 'trajectory.native.particle-filter-model',
        execute: async (payload) => ({
            data: await deps.filterEvaluatorService.exportParticleFilterModel(payload as never)
        })
    }
];
