import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import { cascadeDeleteEach } from '@shared/events/cascadeDeleteEach';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import ScriptingService from '@modules/scripting/services/ScriptingService';
import scriptingSessionOrchestrator from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import notebookCredentialService from '@modules/scripting/services/NotebookCredentialService';
import { In, IsNull } from 'typeorm';

@DefineEventGroup('scripting')
export default class ScriptingEvents {
    #service?: ScriptingService;

    @Event('team.deleted')
    async deleteTeamNotebooks({ teamId }: EventMap['team.deleted']) {
        const notebooks = await ScriptingNotebook.find({
            where: { team: teamId },
            select: { id: true }
        });

        await cascadeDeleteEach({
            label: 'ScriptingEvents',
            ids: notebooks.map((notebook) => notebook.id),
            deleteOne: async (notebookId) => {
                this.#service ??= new ScriptingService();
                await this.#service.deleteNotebook({
                    notebookId,
                    teamId
                });
            }
        });
    }

    @Event('trajectory.deleted')
    async detachTrajectoryNotebooks({ trajectoryId }: EventMap['trajectory.deleted']) {
        const notebooks = await ScriptingNotebook.findBy({ trajectory: trajectoryId });
        await scriptingSessionOrchestrator.deleteSession(trajectoryId);
        for (const notebook of notebooks) {
            await notebookCredentialService.revokeSecretKey(notebook);
        }
        await this.#removeTrajectory(trajectoryId);
    }

    async #removeTrajectory(trajectoryId: string): Promise<void> {
        const impacted = await ScriptingNotebook.find({
            where: { trajectory: trajectoryId },
            select: { id: true }
        });
        const impactedNotebookIds = impacted.map((notebook) => notebook.id);

        await ScriptingNotebook.update(
            { trajectory: trajectoryId },
            { trajectory: null }
        );

        if (!impactedNotebookIds.length) {
            return;
        }

        await ScriptingNotebook.delete({
            id: In(impactedNotebookIds),
            trajectory: IsNull()
        });
    }
}
