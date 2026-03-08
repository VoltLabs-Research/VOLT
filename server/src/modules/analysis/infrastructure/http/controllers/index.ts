import { container } from 'tsyringe';
import DeleteAnalysisByIdController from './DeleteAnalysisByIdController';
import GetAnalysesByTeamIdController from './GetAnalysesByTeamIdController';
import GetAnalysisByIdController from './GetAnalysisByIdController';
import GetAnalysesByTrajectoryIdController from './GetAnalysesByTrajectoryIdController';
import RetryFailedFramesController from './RetryFailedFramesController';

export default {
    deleteById: container.resolve(DeleteAnalysisByIdController),
    getById: container.resolve(GetAnalysisByIdController),
    listByTeamId: container.resolve(GetAnalysesByTeamIdController),
    listByTrajectoryId: container.resolve(GetAnalysesByTrajectoryIdController),
    retryFailedFrames: container.resolve(RetryFailedFramesController)
};
