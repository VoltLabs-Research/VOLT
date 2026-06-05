import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { inject } from 'tsyringe';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

import type { IEventHandler } from '@shared/application/events/IEventHandler';

@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository) private readonly sceneArtifactRepository: ISceneArtifactRepository
    ) {}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId } = event.payload;
        const query = { trajectory: trajectoryId };

        await this.sceneArtifactRepository.deleteMany({ ...query, sourceType: 'plugin-exposure' });
    }
}
