import { ErrorCodes } from '@core/constants/error-codes';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import notebookCredentialService from '@modules/scripting/services/NotebookCredentialService';
import type { NotebookIdentityInput } from '@modules/scripting/contracts/scripting-notebook';
import type { NotebookKernelEnvironment } from '@volt/contracts/modules/scripting/domain';
import ApplicationError from '@shared/errors/ApplicationError';
import { resolveServerBaseUrl } from '@shared/utilities/server-url';

interface CreateKernelEnvironmentInput extends NotebookIdentityInput{
    userId: string;
}

// The environment of a kernel the client runs for a notebook (in the browser, when it runs its
// stack there): what a Jupyter container on a cluster starts with, besides Jupyter's own.
class NotebookKernelService{
    async createEnvironment(input: CreateKernelEnvironmentInput): Promise<NotebookKernelEnvironment>{
        const notebook = await ScriptingNotebook.findOneBy({
            id: input.notebookId,
            team: input.teamId
        });
        if(!notebook){
            throw ApplicationError.notFound(ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND, 'Notebook not found');
        }

        const secretKey = await notebookCredentialService.resolveSecretKey(notebook, input.userId);
        await ScriptingNotebook.update({ id: notebook.id }, { lastOpenedAt: new Date() });

        return {
            env: {
                VOLT_BASE_URL: `${resolveServerBaseUrl()}/api`,
                VOLT_SECRET_KEY: secretKey,
                VOLT_TEAM_ID: notebook.team,
                VOLT_NOTEBOOK_ID: notebook.id,
                VOLT_NOTEBOOK_PATH: notebook.notebookPath,
                VOLT_REQUESTED_BY: input.userId,
                ...(notebook.trajectory ? { VOLT_TRAJECTORY_ID: notebook.trajectory } : {})
            }
        };
    }
}

export default new NotebookKernelService();
