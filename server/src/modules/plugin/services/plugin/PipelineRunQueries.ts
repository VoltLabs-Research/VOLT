import PipelineRunEntity from '@modules/plugin/models/PipelineRun';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';

const LIST_DEFAULT_LIMIT = 50;

export interface GetPipelineRunsByTrajectoryIdInput{
    teamId: string;
    trajectoryId: string;
    page?: number;
    limit?: number;
}

export const toWireRun = (run: PipelineRunEntity): PipelineRun => run.toJSON() as unknown as PipelineRun;

/**
 * Newest-first, paginated **by run** rather than by analysis: a page boundary
 * that fell in the middle of a run would hand the client a partial stage chain.
 */
export const getPipelineRunsByTrajectoryId = async (
    input: GetPipelineRunsByTrajectoryIdInput
): Promise<PaginatedResult<PipelineRun>> => {
    const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: LIST_DEFAULT_LIMIT });

    const [runs, total] = await PipelineRunEntity.findAndCount({
        where: {
            team: input.teamId,
            trajectory: input.trajectoryId
        },
        order: { createdAt: 'DESC' },
        skip: skipFor(pageRequest),
        take: pageRequest.limit
    });

    return paginate([runs.map(toWireRun), total], pageRequest);
};
