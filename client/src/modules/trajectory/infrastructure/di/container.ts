import { container } from 'tsyringe';
import type ITrajectoryRepository from '../../domain/ports/ITrajectoryRepository';
import type IParticleFilterRepository from '../../domain/ports/IParticleFilterRepository';
import type IColorCodingRepository from '../../domain/ports/IColorCodingRepository';
import type ISceneArtifactRepository from '../../domain/ports/ISceneArtifactRepository';
import type IPreviewCache from '../../domain/ports/IPreviewCache';
import TrajectoryRepository from '../repositories/TrajectoryRepository';
import ParticleFilterRepository from '../repositories/ParticleFilterRepository';
import ColorCodingRepository from '../repositories/ColorCodingRepository';
import SceneArtifactRepository from '../repositories/SceneArtifactRepository';
import TrajectoryPreviewCache from '../adapters/TrajectoryPreviewCache';
import DeleteTrajectoryUseCase from '../../application/use-cases/trajectory/DeleteTrajectoryUseCase';
import ListSceneArtifactsUseCase from '../../application/use-cases/generated-scenes/ListSceneArtifactsUseCase';
import { TRAJECTORY_TOKENS } from './tokens';

export const ensureTrajectoryDI = (): void => {
    container.registerSingleton<IPreviewCache>(TRAJECTORY_TOKENS.PreviewCache, TrajectoryPreviewCache);
    container.register<ITrajectoryRepository>(TRAJECTORY_TOKENS.TrajectoryRepository, TrajectoryRepository);
    container.register<IParticleFilterRepository>(TRAJECTORY_TOKENS.ParticleFilterRepository, ParticleFilterRepository);
    container.register<IColorCodingRepository>(TRAJECTORY_TOKENS.ColorCodingRepository, ColorCodingRepository);
    container.register<ISceneArtifactRepository>(TRAJECTORY_TOKENS.SceneArtifactRepository, SceneArtifactRepository);
    container.register(TRAJECTORY_TOKENS.ListSceneArtifactsUseCase, ListSceneArtifactsUseCase);
    container.register(TRAJECTORY_TOKENS.DeleteTrajectoryUseCase, DeleteTrajectoryUseCase);
};
