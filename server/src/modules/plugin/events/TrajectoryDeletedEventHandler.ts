import type { TrajectoryDeletedEventPayload } from '@shared/contracts/events';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import SceneArtifactModel from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

import type { IEventHandler } from '@shared/application/events/IEventHandler';

@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedEventHandler implements IEventHandler<IDomainEvent<TrajectoryDeletedEventPayload>> {
    async handle(event: IDomainEvent<TrajectoryDeletedEventPayload>): Promise<void> {
        const { trajectoryId } = event.payload;
        const query = { trajectory: trajectoryId };

        await SceneArtifactModel.deleteMany({ ...query, sourceType: 'plugin-exposure' }).exec();
    }
}
