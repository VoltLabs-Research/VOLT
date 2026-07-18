import ScriptingNotebookModel from '@modules/scripting/models/ScriptingNotebookModel';
import { DaemonScriptingSessionOrchestrator } from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import { NotebookCredentialService } from '@modules/scripting/services/NotebookCredentialService';
import type { TrajectoryDeletedEventPayload } from '@shared/contracts/events';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

/**
 * On trajectory deletion, tears down every notebook session bound to that
 * trajectory, revokes each notebook's `vsk_` credential, then detaches/prunes
 * the notebooks. Talks to the Mongoose {@link ScriptingNotebookModel} directly
 * (folds the former repository's `findAllWithTrajectory` + `removeTrajectory`)
 * and injects the shared orchestrator/credential singletons by class.
 */
@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedEventHandler implements IEventHandler<IDomainEvent<TrajectoryDeletedEventPayload>> {
    constructor(
        private readonly scriptingSessionOrchestrator: DaemonScriptingSessionOrchestrator,
        private readonly notebookCredentialService: NotebookCredentialService
    ) {}

    async handle(event: IDomainEvent<TrajectoryDeletedEventPayload>): Promise<void> {
        const { trajectoryId } = event.payload;
        const notebooks = await ScriptingNotebookModel.find({ trajectory: trajectoryId }).exec();
        await this.scriptingSessionOrchestrator.deleteSession(trajectoryId);
        for (const notebook of notebooks) {
            await this.notebookCredentialService.revokeSecretKey(notebook);
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
