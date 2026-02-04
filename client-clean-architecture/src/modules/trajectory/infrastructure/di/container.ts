import { container } from 'tsyringe';
import type ITrajectoryRepository from '../../domain/ports/ITrajectoryRepository';
import type ITrajectoryJobsRepository from '../../domain/ports/ITrajectoryJobsRepository';
import type IParticleFilterRepository from '../../domain/ports/IParticleFilterRepository';
import type IColorCodingRepository from '../../domain/ports/IColorCodingRepository';
import type IPreviewCache from '../../domain/ports/IPreviewCache';
import TrajectoryRepository from '../repositories/TrajectoryRepository';
import TrajectoryJobsRepository from '../repositories/TrajectoryJobsRepository';
import ParticleFilterRepository from '../repositories/ParticleFilterRepository';
import ColorCodingRepository from '../repositories/ColorCodingRepository';
import TrajectoryPreviewCache from '../adapters/TrajectoryPreviewCache';
import DeleteTrajectoryUseCase from '../../application/use-cases/trajectory/DeleteTrajectoryUseCase';
import { TRAJECTORY_TOKENS } from './tokens';

export const ensureTrajectoryDI = (): void => {
    container.registerSingleton<IPreviewCache>(TRAJECTORY_TOKENS.PreviewCache, TrajectoryPreviewCache);
    container.register<ITrajectoryRepository>(TRAJECTORY_TOKENS.TrajectoryRepository, TrajectoryRepository);
    container.register<ITrajectoryJobsRepository>(TRAJECTORY_TOKENS.TrajectoryJobsRepository, TrajectoryJobsRepository);
    container.register<IParticleFilterRepository>(TRAJECTORY_TOKENS.ParticleFilterRepository, ParticleFilterRepository);
    container.register<IColorCodingRepository>(TRAJECTORY_TOKENS.ColorCodingRepository, ColorCodingRepository);
    container.register(TRAJECTORY_TOKENS.DeleteTrajectoryUseCase, DeleteTrajectoryUseCase);
};
