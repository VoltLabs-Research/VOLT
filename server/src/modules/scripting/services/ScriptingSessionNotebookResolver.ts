import { ErrorCodes } from '@core/constants/error-codes';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import { JupyterNotebookService } from '@modules/scripting/services/JupyterNotebookService';
import { buildScriptingNotebookPath, DEFAULT_SCRIPTING_NOTEBOOK_TITLE } from '@modules/scripting/services/scripting-notebook-defaults';
import type { CreateJupyterSessionInput } from '@modules/scripting/contracts/notebook-session';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import pRetry from 'p-retry';

const PENDING_NOTEBOOK_WAIT_ATTEMPTS = 5;
const PENDING_NOTEBOOK_WAIT_DELAY_MS = 300;

interface TouchNotebookPatch{
    lastOpenedAt: Date;
    trajectory?: string;
}

const getSortTimestamp = (notebook: ScriptingNotebook): number =>
    notebook.lastOpenedAt?.getTime() ?? notebook.updatedAt.getTime();

const selectExistingTrajectoryNotebook = (notebooks: ScriptingNotebook[], teamId: string): ScriptingNotebook | null => {
    const teamNotebooks = notebooks.filter((notebook) => notebook.team === teamId);
    if(!teamNotebooks.length){
        return null;
    }

    return [...teamNotebooks].sort((left, right) => {
        const timestampDelta = getSortTimestamp(right) - getSortTimestamp(left);
        if(timestampDelta !== 0){
            return timestampDelta;
        }

        return right.id.localeCompare(left.id);
    })[0] || null;
};

class ScriptingSessionNotebookResolver{
    #notebookTemplate = new JupyterNotebookService();

    #teamClusterSelection: ITeamClusterSelectionService = teamClusterSelectionService;

    async resolve(input: CreateJupyterSessionInput): Promise<ScriptingNotebook>{
        if(input.notebookId){
            const notebook = await ScriptingNotebook.findOneBy({
                id: input.notebookId,
                team: input.teamId
            });
            if(!notebook){
                throw new ApplicationError(ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND, 'Notebook not found', 404);
            }

            const patch: TouchNotebookPatch = { lastOpenedAt: new Date() };
            if(input.trajectoryId && notebook.trajectory !== input.trajectoryId){
                patch.trajectory = input.trajectoryId;
            }

            return Object.assign(notebook, patch).save();
        }

        if(!input.trajectoryId){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Trajectory id or notebook id is required');
        }

        const existingNotebooks = await ScriptingNotebook.findBy({ trajectory: input.trajectoryId });
        const existing = selectExistingTrajectoryNotebook(existingNotebooks, input.teamId);

        if(existing){
            return Object.assign(existing, {
                trajectory: input.trajectoryId,
                lastOpenedAt: new Date()
            }).save();
        }

        if(!input.teamClusterId){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Notebook deployment cluster is required');
        }

        const notebookContent = await this.#notebookTemplate.resolveNotebookTemplateContent();
        const teamClusterId = await this.#teamClusterSelection.resolveConnectedClusterId(input.teamId, input.teamClusterId);

        return ScriptingNotebook.create({
            team: input.teamId,
            teamCluster: teamClusterId,
            title: DEFAULT_SCRIPTING_NOTEBOOK_TITLE,
            notebookPath: buildScriptingNotebookPath(input.trajectoryId),
            trajectory: input.trajectoryId,
            createdBy: input.userId,
            content: notebookContent,
            lastOpenedAt: new Date()
        }).save();
    }

    async resolvePendingNotebookId(input: CreateJupyterSessionInput): Promise<string>{
        if(input.notebookId){
            return input.notebookId;
        }
        if(!input.trajectoryId){
            return '';
        }

        const trajectoryId = input.trajectoryId;
        try{
            return await pRetry(async () => {
                const notebooks = await ScriptingNotebook.findBy({ trajectory: trajectoryId });
                const existingNotebook = selectExistingTrajectoryNotebook(notebooks, input.teamId);
                if(!existingNotebook){
                    throw ApplicationError.notFound(ErrorCodes.SCRIPTING_PENDING_NOTEBOOK_NOT_FOUND, 'Pending notebook not created yet');
                }

                return existingNotebook.id;
            }, {
                retries: PENDING_NOTEBOOK_WAIT_ATTEMPTS - 1,
                factor: 1,
                minTimeout: PENDING_NOTEBOOK_WAIT_DELAY_MS,
                maxTimeout: PENDING_NOTEBOOK_WAIT_DELAY_MS,
                shouldRetry: ({ error }) => error instanceof ApplicationError
                    && error.code === ErrorCodes.SCRIPTING_PENDING_NOTEBOOK_NOT_FOUND
            });
        }catch{
            return '';
        }
    }
}

export default new ScriptingSessionNotebookResolver();
