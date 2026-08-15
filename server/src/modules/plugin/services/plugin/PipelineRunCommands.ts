import { ErrorCodes } from '@core/constants/error-codes';
import PipelineRunEntity from '@modules/plugin/models/PipelineRun';
import { toWireRun } from '@modules/plugin/services/plugin/PipelineRunQueries';
import ApplicationError from '@shared/application/errors/ApplicationError';
import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';

const NAME_MAX_LENGTH = 120;

export interface UpdatePipelineRunInput{
    teamId: string;
    pipelineRunId: string;
    name: string;
}

export interface DeletePipelineRunInput{
    teamId: string;
    pipelineRunId: string;
    userId?: string;
}

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

export const deletePipelineRun = async (input: DeletePipelineRunInput): Promise<{ success: boolean }> => {
    const run = await PipelineRunEntity.findOneBy({
        id: input.pipelineRunId,
        team: input.teamId
    });

    if(!run){
        throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Pipeline run not found');
    }

    const trajectoryId = run.trajectory;
    await PipelineRunEntity.delete({ id: input.pipelineRunId });

    await eventBus.emit('pipelineRun.deleted', {
        pipelineRunId: input.pipelineRunId,
        trajectoryId,
        teamId: input.teamId,
        userId: input.userId
    });

    return { success: true };
};
