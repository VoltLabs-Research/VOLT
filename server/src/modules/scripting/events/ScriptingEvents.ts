import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import { cascadeDeleteEach } from '@shared/events/cascadeDeleteEach';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import ScriptingService from '@modules/scripting/services/ScriptingService';
import scriptingSessionOrchestrator from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import notebookCredentialService from '@modules/scripting/services/NotebookCredentialService';

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
        await ScriptingNotebook.delete({ trajectory: trajectoryId });
    }
}
