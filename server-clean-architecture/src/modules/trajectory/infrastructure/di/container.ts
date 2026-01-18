import { container } from 'tsyringe';
import { VFSService } from '@modules/trajectory/infrastructure/services/VFSService';
import { TRAJECTORY_TOKENS } from './TrajectoryTokens';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/TrajectoryRepository';
import TrajectoryProcessingQueue from '@modules/trajectory/infrastructure/queues/TrajectoryProcessingQueue';
import CloudUploadQueue from '@modules/trajectory/infrastructure/queues/CloudUploadQueue';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/TrajectoryDumpStorageService';
import TrajectoryBackgroundProcessor from '@modules/trajectory/infrastructure/services/TrajectoryBackgroundProcessor';
import { ListVFSDirectoryUseCase } from '@modules/trajectory/application/use-cases/vfs/ListVFSDirectoryUseCase';
import { GetVFSFileUseCase } from '@modules/trajectory/application/use-cases/vfs/GetVFSFileUseCase';
import { UploadVFSFileUseCase } from '@modules/trajectory/application/use-cases/vfs/UploadVFSFileUseCase';
import { DeleteVFSFileUseCase } from '@modules/trajectory/application/use-cases/vfs/DeleteVFSFileUseCase';
import { DownloadVFSArchiveUseCase } from '@modules/trajectory/application/use-cases/vfs/DownloadVFSArchiveUseCase';
import SessionCompletedEventHandler from '@modules/trajectory/application/events/SessionCompletedEventHandler';
import JobStatusChangedEventHandler from '@modules/trajectory/application/events/JobStatusChangedEventHandler';

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
    container.registerSingleton(SessionCompletedEventHandler);
    container.registerSingleton(JobStatusChangedEventHandler);
};
