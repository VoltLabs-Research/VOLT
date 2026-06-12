import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import { inject } from 'tsyringe';
import type { ISceneArtifactRepository } from '@shared/contracts/ports';
import type { TrajectoryDeletedEventPayload } from '@shared/contracts/events';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

import type { IEventHandler } from '@shared/application/events/IEventHandler';

@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedEventHandler implements IEventHandler<IDomainEvent<TrajectoryDeletedEventPayload>> {
    constructor(
        @inject(COMPUTE_TOKENS.SceneArtifactRepository) private readonly sceneArtifactRepository: ISceneArtifactRepository
    ) {}

    async handle(event: IDomainEvent<TrajectoryDeletedEventPayload>): Promise<void> {
        const { trajectoryId } = event.payload;
        const query = { trajectory: trajectoryId };

        await this.sceneArtifactRepository.deleteMany({ ...query, sourceType: 'plugin-exposure' });
    }
}
