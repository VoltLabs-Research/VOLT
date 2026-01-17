import { container } from 'tsyringe';
import { VFSService } from '../services/VFSService';
import { TRAJECTORY_TOKENS } from './TrajectoryTokens';
import TrajectoryRepository from '../persistence/mongo/repositories/TrajectoryRepository';
import TrajectoryProcessingQueue from '../queues/TrajectoryProcessingQueue';
import CloudUploadQueue from '../queues/CloudUploadQueue';
import TrajectoryDumpStorageService from '../services/TrajectoryDumpStorageService';
import TrajectoryBackgroundProcessor from '../services/TrajectoryBackgroundProcessor';
import { ListVFSDirectoryUseCase } from '../../application/use-cases/vfs/ListVFSDirectoryUseCase';
import { GetVFSFileUseCase } from '../../application/use-cases/vfs/GetVFSFileUseCase';
import { UploadVFSFileUseCase } from '../../application/use-cases/vfs/UploadVFSFileUseCase';
import { DeleteVFSFileUseCase } from '../../application/use-cases/vfs/DeleteVFSFileUseCase';
import { DownloadVFSArchiveUseCase } from '../../application/use-cases/vfs/DownloadVFSArchiveUseCase';
import SessionCompletedEventHandler from '../../application/events/SessionCompletedEventHandler';
import JobStatusChangedEventHandler from '../../application/events/JobStatusChangedEventHandler';

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
