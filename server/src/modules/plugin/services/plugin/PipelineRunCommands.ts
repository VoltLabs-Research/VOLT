import { ErrorCodes } from '@core/constants/error-codes';
import PipelineRunEntity from '@modules/plugin/models/PipelineRun';
import { toWireRun } from '@modules/plugin/services/plugin/PipelineRunQueries';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';

const NAME_MAX_LENGTH = 120;

export interface UpdatePipelineRunInput{
    teamId: string;
    pipelineRunId: string;
    name: string;
}

/**
 * Renames a run, or clears the override when `name` is empty.
 *
 * The empty case is a real command, not a rejected edit: it is how the UI returns
 * a run to being labelled by its plugin chain, so it stores `null` rather than
 * refusing the write the way the notebook and conversation renames do.
 *
 * Scoping by `team` in the lookup is the ownership check — `teamScoped` on the
 * controller proves membership of the team in the URL, not that this run belongs
 * to it, so without the `team` predicate a member of team A could rename a run
 * belonging to team B by id.
 */
export const updatePipelineRun = async (input: UpdatePipelineRunInput): Promise<PipelineRun> => {
    const run = await PipelineRunEntity.findOneBy({
        id: input.pipelineRunId,
        team: input.teamId
    });

    if(!run){
        throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Pipeline run not found');
    }

    const name = input.name.trim();

    if(name.length > NAME_MAX_LENGTH){
        throw ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            `Pipeline run name must be at most ${NAME_MAX_LENGTH} characters`
        );
    }

    run.name = name || null;

    return toWireRun(await run.save());
};
