import { container } from 'tsyringe';
import { VFSService } from '@modules/trajectory/infrastructure/services/VFSService';
import { TRAJECTORY_TOKENS } from './TrajectoryTokens';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/TrajectoryRepository';
import TrajectoryProcessingQueue from '@modules/trajectory/infrastructure/queues/TrajectoryProcessingQueue';
import CloudUploadQueue from '@modules/trajectory/infrastructure/queues/CloudUploadQueue';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/TrajectoryDumpStorageService';
import TrajectoryBackgroundProcessor from '@modules/trajectory/infrastructure/services/TrajectoryBackgroundProcessor';
import AtomPropertiesService from '@modules/trajectory/infrastructure/services/AtomPropertiesService';
import ColorCodingService from '@modules/trajectory/infrastructure/services/ColorCodingService';
import ParticleFilterService from '@modules/trajectory/infrastructure/services/ParticleFilterService';
import AtomisticExporter from '@modules/trajectory/infrastructure/services/exporters/AtomisticExporter';
import DislocationExporter from '@modules/trajectory/infrastructure/services/exporters/DislocationExporter';
import MeshExporter from '@modules/trajectory/infrastructure/services/exporters/MeshExporter';
import ChartExporter from '@modules/trajectory/infrastructure/services/exporters/ChartExporter';
import { ListVFSDirectoryUseCase } from '@modules/trajectory/application/use-cases/vfs/ListVFSDirectoryUseCase';
import { GetVFSFileUseCase } from '@modules/trajectory/application/use-cases/vfs/GetVFSFileUseCase';
import { UploadVFSFileUseCase } from '@modules/trajectory/application/use-cases/vfs/UploadVFSFileUseCase';
import { DeleteVFSFileUseCase } from '@modules/trajectory/application/use-cases/vfs/DeleteVFSFileUseCase';
import { DownloadVFSArchiveUseCase } from '@modules/trajectory/application/use-cases/vfs/DownloadVFSArchiveUseCase';
import SessionCompletedEventHandler from '@modules/trajectory/application/events/SessionCompletedEventHandler';
import JobStatusChangedEventHandler from '@modules/trajectory/application/events/JobStatusChangedEventHandler';
import { GetColorCodingPropertiesUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingPropertiesUseCase';
import { GetColorCodingStatsUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingStatsUseCase';
import { CreateColoredModelUseCase } from '@modules/trajectory/application/use-cases/color-coding/CreateColoredModelUseCase';
import { GetColoredModelStreamUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColoredModelStreamUseCase';
import { GetParticleFilterPropertiesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterPropertiesUseCase';
import { PreviewParticleFilterUseCase } from '@modules/trajectory/application/use-cases/particle-filter/PreviewParticleFilterUseCase';
import { ApplyParticleFilterActionUseCase } from '@modules/trajectory/application/use-cases/particle-filter/ApplyParticleFilterActionUseCase';
import { GetFilteredModelStreamUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetFilteredModelStreamUseCase';

export const registerTrajectoryDependencies = (): void => {
    // VFS Use Dependencies
    container.register('IVFSService', { useClass: VFSService });

    // VFS Use Cases
    container.registerSingleton(ListVFSDirectoryUseCase);
    container.registerSingleton(GetVFSFileUseCase);
    container.registerSingleton(UploadVFSFileUseCase);
    container.registerSingleton(DeleteVFSFileUseCase);
    container.registerSingleton(DownloadVFSArchiveUseCase);

    container.registerSingleton(TRAJECTORY_TOKENS.TrajectoryRepository, TrajectoryRepository);
    container.registerSingleton(TRAJECTORY_TOKENS.TrajectoryProcessingQueue, TrajectoryProcessingQueue);
    container.registerSingleton(TRAJECTORY_TOKENS.CloudUploadQueue, CloudUploadQueue);
    container.registerSingleton(TRAJECTORY_TOKENS.TrajectoryDumpStorageService, TrajectoryDumpStorageService);
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

    container.registerSingleton(SessionCompletedEventHandler);
    container.registerSingleton(JobStatusChangedEventHandler);
};
