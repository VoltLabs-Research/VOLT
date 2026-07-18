import type { TrajectoryDeletedEventPayload } from '@shared/contracts/events';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import SceneArtifactModel from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

import type { IEventHandler } from '@shared/application/events/IEventHandler';

class TrajectoryDeletedEventHandler implements IEventHandler<IDomainEvent<TrajectoryDeletedEventPayload>> {
    async handle(event: IDomainEvent<TrajectoryDeletedEventPayload>): Promise<void> {
        const { trajectoryId } = event.payload;
        const query = { trajectory: trajectoryId };

        await SceneArtifactModel.deleteMany({ ...query, sourceType: 'plugin-exposure' }).exec();
    }
}

const trajectoryDeletedEventHandler = new TrajectoryDeletedEventHandler();
subscribeHandler('trajectory.deleted', trajectoryDeletedEventHandler);

export default trajectoryDeletedEventHandler;
