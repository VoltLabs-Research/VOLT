import ScriptingNotebookModel from '@modules/scripting/models/ScriptingNotebookModel';
import scriptingSessionOrchestrator from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import notebookCredentialService from '@modules/scripting/services/NotebookCredentialService';
import type { TrajectoryDeletedEventPayload } from '@shared/contracts/events';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

class TrajectoryDeletedEventHandler implements IEventHandler<IDomainEvent<TrajectoryDeletedEventPayload>> {
    #scriptingSessionOrchestrator = scriptingSessionOrchestrator;
    #notebookCredentialService = notebookCredentialService;

    async handle(event: IDomainEvent<TrajectoryDeletedEventPayload>): Promise<void> {
        const { trajectoryId } = event.payload;
        const notebooks = await ScriptingNotebookModel.find({ trajectory: trajectoryId }).exec();
        await this.#scriptingSessionOrchestrator.deleteSession(trajectoryId);
        for (const notebook of notebooks) {
            await this.#notebookCredentialService.revokeSecretKey(notebook);
        }
        await this.#removeTrajectory(trajectoryId);
    }

    async #removeTrajectory(trajectoryId: string): Promise<void> {
        const impactedNotebookIds = await ScriptingNotebookModel.find({ trajectory: trajectoryId }).distinct('_id').exec();

        await ScriptingNotebookModel.updateMany(
            { trajectory: trajectoryId },
            { $set: { trajectory: null } }
        ).exec();

        if (!impactedNotebookIds.length) {
            return;
        }

        await ScriptingNotebookModel.deleteMany({
            _id: { $in: impactedNotebookIds },
            $or: [
                { trajectory: null },
                { trajectory: { $exists: false } }
            ]
        }).exec();
    }
}

const trajectoryDeletedEventHandler = new TrajectoryDeletedEventHandler();
subscribeHandler('trajectory.deleted', trajectoryDeletedEventHandler);

export default trajectoryDeletedEventHandler;
