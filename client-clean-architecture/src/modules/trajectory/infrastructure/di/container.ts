import { container } from 'tsyringe';
import type ITrajectoryRepository from '../../domain/ports/ITrajectoryRepository';
import type ITrajectoryJobsRepository from '../../domain/ports/ITrajectoryJobsRepository';
import type IParticleFilterRepository from '../../domain/ports/IParticleFilterRepository';
import type IPreviewCache from '../../domain/ports/IPreviewCache';
import TrajectoryRepository from '../repositories/TrajectoryRepository';
import TrajectoryJobsRepository from '../repositories/TrajectoryJobsRepository';
import ParticleFilterRepository from '../repositories/ParticleFilterRepository';
import TrajectoryPreviewCache from '../adapters/TrajectoryPreviewCache';
import {
    GetTrajectoriesUseCase,
    GetTrajectoryByIdUseCase,
    CreateTrajectoryUseCase,
    UpdateTrajectoryUseCase,
    DeleteTrajectoryUseCase,
    GetPreviewUseCase,
    DownloadTrajectoryUseCase,
    GetAtomsUseCase,
    ListSamplesUseCase,
    DownloadSampleUseCase,
    GetMetricsUseCase,
    ClearHistoryUseCase,
    RemoveRunningJobsUseCase,
    RetryFailedJobsUseCase,
    GetFilterPropertiesUseCase,
    PreviewFilterUseCase,
    ApplyFilterUseCase,
    GetFilteredGlbUseCase
} from '../../application/use-cases';
import { TRAJECTORY_TOKENS } from './tokens';

export const ensureTrajectoryDI = (): void => {
    container.registerSingleton<IPreviewCache>(TRAJECTORY_TOKENS.PreviewCache, TrajectoryPreviewCache);
    container.register<ITrajectoryRepository>(TRAJECTORY_TOKENS.TrajectoryRepository, TrajectoryRepository);
    container.register<ITrajectoryJobsRepository>(TRAJECTORY_TOKENS.TrajectoryJobsRepository, TrajectoryJobsRepository);
    container.register<IParticleFilterRepository>(TRAJECTORY_TOKENS.ParticleFilterRepository, ParticleFilterRepository);

    container.register(TRAJECTORY_TOKENS.GetTrajectoriesUseCase, GetTrajectoriesUseCase);
    container.register(TRAJECTORY_TOKENS.GetTrajectoryByIdUseCase, GetTrajectoryByIdUseCase);
    container.register(TRAJECTORY_TOKENS.CreateTrajectoryUseCase, CreateTrajectoryUseCase);
    container.register(TRAJECTORY_TOKENS.UpdateTrajectoryUseCase, UpdateTrajectoryUseCase);
    container.register(TRAJECTORY_TOKENS.DeleteTrajectoryUseCase, DeleteTrajectoryUseCase);
    container.register(TRAJECTORY_TOKENS.GetPreviewUseCase, GetPreviewUseCase);
    container.register(TRAJECTORY_TOKENS.DownloadTrajectoryUseCase, DownloadTrajectoryUseCase);
    container.register(TRAJECTORY_TOKENS.GetAtomsUseCase, GetAtomsUseCase);
    container.register(TRAJECTORY_TOKENS.ListSamplesUseCase, ListSamplesUseCase);
    container.register(TRAJECTORY_TOKENS.DownloadSampleUseCase, DownloadSampleUseCase);
    container.register(TRAJECTORY_TOKENS.GetMetricsUseCase, GetMetricsUseCase);
    container.register(TRAJECTORY_TOKENS.ClearHistoryUseCase, ClearHistoryUseCase);
    container.register(TRAJECTORY_TOKENS.RemoveRunningJobsUseCase, RemoveRunningJobsUseCase);
    container.register(TRAJECTORY_TOKENS.RetryFailedJobsUseCase, RetryFailedJobsUseCase);
    container.register(TRAJECTORY_TOKENS.GetFilterPropertiesUseCase, GetFilterPropertiesUseCase);
    container.register(TRAJECTORY_TOKENS.PreviewFilterUseCase, PreviewFilterUseCase);
    container.register(TRAJECTORY_TOKENS.ApplyFilterUseCase, ApplyFilterUseCase);
    container.register(TRAJECTORY_TOKENS.GetFilteredGlbUseCase, GetFilteredGlbUseCase);
};
