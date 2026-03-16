import { TRAJECTORY_TOKENS } from './TrajectoryTokens';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import * as trajectoryAiTools from '@modules/trajectory/application/ai-tools/trajectory';
import { CreateColoredModelUseCase } from '@modules/trajectory/application/use-cases/color-coding/CreateColoredModelUseCase';
import { GetColorCodingPropertiesUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingPropertiesUseCase';
import { GetColorCodingStatsUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingStatsUseCase';
import { GetColoredModelStreamUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColoredModelStreamUseCase';
import { ApplyParticleFilterActionUseCase } from '@modules/trajectory/application/use-cases/particle-filter/ApplyParticleFilterActionUseCase';
import { GetFilteredModelStreamUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetFilteredModelStreamUseCase';
import { GetParticleFilterPropertiesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterPropertiesUseCase';
import { GetParticleFilterUniqueValuesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterUniqueValuesUseCase';
import { PreviewParticleFilterUseCase } from '@modules/trajectory/application/use-cases/particle-filter/PreviewParticleFilterUseCase';
import { ListTrajectorySceneArtifactsUseCase } from '@modules/trajectory/application/use-cases/scene-artifacts/ListTrajectorySceneArtifactsUseCase';
import { GetPublicCanvasBootstrapUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasBootstrapUseCase';
import JobStatusChangedEventHandler from '@modules/trajectory/application/events/JobStatusChangedEventHandler';
import GetTeamMetricsUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTeamMetricsUseCase';
import SceneArtifactRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/scene-artifacts/SceneArtifactRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import CloudUploadProcessor from '@modules/trajectory/infrastructure/services/trajectory/CloudUploadProcessor';
import AtomPropertiesService from '@modules/trajectory/infrastructure/services/trajectory/AtomPropertiesService';
import ColorCodingService from '@modules/trajectory/infrastructure/services/color-coding/ColorCodingService';
import ParticleFilterService from '@modules/trajectory/infrastructure/services/particle-filter/ParticleFilterService';
import TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';
import TeamMetricsQueryService from '@modules/trajectory/infrastructure/services/trajectory/TeamMetricsQueryService';
import TrajectoryBackgroundProcessor from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryBackgroundProcessor';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryDumpStorageService';
import TrajectoryReader from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryReader';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';
import CreateTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/CreateTrajectoryFolderUseCase';
import DeleteTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryFolderUseCase';
import GetTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryFolderUseCase';
import ListTrajectoryFoldersUseCase from '@modules/trajectory/application/use-cases/trajectory/ListTrajectoryFoldersUseCase';
import MoveTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/MoveTrajectoryUseCase';
import UpdateTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/UpdateTrajectoryFolderUseCase';
import TrajectoryFolderRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFolderRepository';

import type { ClassProvider } from 'tsyringe';
import { container } from 'tsyringe';

const TRAJECTORY_AI_TOOL_CLASSES: ClassProvider<unknown>[] = Object.values(trajectoryAiTools).map((useClass) => ({ useClass }));

export const registerTrajectoryDependencies = (): void => {
    registerModuleDependencies({
        singletons: [
            [TRAJECTORY_TOKENS.TrajectoryRepository, TrajectoryRepository],
            [TRAJECTORY_TOKENS.TrajectoryFolderRepository, TrajectoryFolderRepository],
            [TRAJECTORY_TOKENS.TeamMetricsQueryService, TeamMetricsQueryService],
            [TRAJECTORY_TOKENS.SceneArtifactRepository, SceneArtifactRepository],
            [TRAJECTORY_TOKENS.CloudUploadProcessor, CloudUploadProcessor],
            [TRAJECTORY_TOKENS.TrajectoryNativeDaemonService, TrajectoryNativeDaemonService],
            [TRAJECTORY_TOKENS.TrajectoryDumpStorageService, TrajectoryDumpStorageService],
            [TRAJECTORY_TOKENS.TrajectoryReader, TrajectoryReader],
            [TRAJECTORY_TOKENS.TrajectoryBackgroundProcessor, TrajectoryBackgroundProcessor],
            [TRAJECTORY_TOKENS.AtomPropertiesService, AtomPropertiesService],
            [TRAJECTORY_TOKENS.ColorCodingService, ColorCodingService],
            [TRAJECTORY_TOKENS.ParticleFilterService, ParticleFilterService],
            GetColorCodingPropertiesUseCase,
            GetColorCodingStatsUseCase,
            CreateTrajectoryFolderUseCase,
            CreateColoredModelUseCase,
            DeleteTrajectoryFolderUseCase,
            GetColoredModelStreamUseCase,
            GetParticleFilterPropertiesUseCase,
            GetTrajectoryFolderUseCase,
            PreviewParticleFilterUseCase,
            ApplyParticleFilterActionUseCase,
            GetFilteredModelStreamUseCase,
            GetParticleFilterUniqueValuesUseCase,
            ListTrajectoryFoldersUseCase,
            ListTrajectorySceneArtifactsUseCase,
            GetPublicCanvasBootstrapUseCase,
            MoveTrajectoryUseCase,
            GetTeamMetricsUseCase,
            UpdateTrajectoryFolderUseCase,
            JobStatusChangedEventHandler
        ]
    });

    // Register all AI Tools for discovery
    for (const toolClassProvider of TRAJECTORY_AI_TOOL_CLASSES) {
        container.register(AI_TOKENS.AITool, toolClassProvider);
    }
};
