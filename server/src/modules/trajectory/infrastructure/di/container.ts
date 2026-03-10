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
import JobStatusChangedEventHandler from '@modules/trajectory/application/events/JobStatusChangedEventHandler';
import GetTeamMetricsUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTeamMetricsUseCase';
import SceneArtifactRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/scene-artifacts/SceneArtifactRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import CloudUploadProcessor from '@modules/trajectory/infrastructure/services/trajectory/CloudUploadProcessor';
import AtomPropertiesService from '@modules/trajectory/infrastructure/services/trajectory/AtomPropertiesService';
import ColorCodingService from '@modules/trajectory/infrastructure/services/color-coding/ColorCodingService';
import AtomisticExporter from '@modules/trajectory/infrastructure/services/trajectory/exporters/AtomisticExporter';
import ChartExporter from '@modules/trajectory/infrastructure/services/trajectory/exporters/ChartExporter';
import DislocationExporter from '@modules/trajectory/infrastructure/services/trajectory/exporters/DislocationExporter';
import MeshExporter from '@modules/trajectory/infrastructure/services/trajectory/exporters/MeshExporter';
import ParticleFilterService from '@modules/trajectory/infrastructure/services/particle-filter/ParticleFilterService';
import TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';
import TeamMetricsQueryService from '@modules/trajectory/infrastructure/services/trajectory/TeamMetricsQueryService';
import TrajectoryBackgroundProcessor from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryBackgroundProcessor';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryDumpStorageService';
import TrajectoryReader from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryReader';

import type { ClassProvider } from 'tsyringe';
import { container } from 'tsyringe';

const TRAJECTORY_AI_TOOL_CLASSES: ClassProvider<unknown>[] = Object.values(trajectoryAiTools).map((useClass) => ({ useClass }));

export const registerTrajectoryDependencies = (): void => {
    container.registerSingleton(TRAJECTORY_TOKENS.TrajectoryRepository, TrajectoryRepository);
    container.registerSingleton(TRAJECTORY_TOKENS.TeamMetricsQueryService, TeamMetricsQueryService);
    container.registerSingleton(TRAJECTORY_TOKENS.SceneArtifactRepository, SceneArtifactRepository);
    container.registerSingleton(TRAJECTORY_TOKENS.CloudUploadProcessor, CloudUploadProcessor);
    container.registerSingleton(TRAJECTORY_TOKENS.TrajectoryNativeDaemonService, TrajectoryNativeDaemonService);
    container.registerSingleton(TRAJECTORY_TOKENS.TrajectoryDumpStorageService, TrajectoryDumpStorageService);
    container.registerSingleton(TRAJECTORY_TOKENS.TrajectoryReader, TrajectoryReader);
    container.registerSingleton(TRAJECTORY_TOKENS.TrajectoryBackgroundProcessor, TrajectoryBackgroundProcessor);

    // Exporters
    container.registerSingleton(TRAJECTORY_TOKENS.AtomisticExporter, AtomisticExporter);
    container.registerSingleton(TRAJECTORY_TOKENS.DislocationExporter, DislocationExporter);
    container.registerSingleton(TRAJECTORY_TOKENS.MeshExporter, MeshExporter);
    container.registerSingleton(TRAJECTORY_TOKENS.ChartExporter, ChartExporter);

    // Color-coding and Particle-filter services
    container.registerSingleton(TRAJECTORY_TOKENS.AtomPropertiesService, AtomPropertiesService);
    container.registerSingleton(TRAJECTORY_TOKENS.ColorCodingService, ColorCodingService);
    container.registerSingleton(TRAJECTORY_TOKENS.ParticleFilterService, ParticleFilterService);

    // Color-Coding Use Cases
    container.registerSingleton(GetColorCodingPropertiesUseCase);
    container.registerSingleton(GetColorCodingStatsUseCase);
    container.registerSingleton(CreateColoredModelUseCase);
    container.registerSingleton(GetColoredModelStreamUseCase);

    // Particle-Filter Use Cases
    container.registerSingleton(GetParticleFilterPropertiesUseCase);
    container.registerSingleton(PreviewParticleFilterUseCase);
    container.registerSingleton(ApplyParticleFilterActionUseCase);
    container.registerSingleton(GetFilteredModelStreamUseCase);
    container.registerSingleton(GetParticleFilterUniqueValuesUseCase);

    // Scene Artifacts Use Cases
    container.registerSingleton(ListTrajectorySceneArtifactsUseCase);

    // Team Metrics Use Case
    container.registerSingleton(GetTeamMetricsUseCase);

    container.registerSingleton(JobStatusChangedEventHandler);

    // Register all AI Tools for discovery
    for (const toolClassProvider of TRAJECTORY_AI_TOOL_CLASSES) {
        container.register(AI_TOKENS.AITool, toolClassProvider);
    }
};
