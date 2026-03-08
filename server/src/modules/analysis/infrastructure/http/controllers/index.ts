import DeleteAnalysisByIdController from './DeleteAnalysisByIdController';
import GetAnalysesByTeamIdController from './GetAnalysesByTeamIdController';
import GetAnalysesByTrajectoryIdController from './GetAnalysesByTrajectoryIdController';
import GetAnalysisByIdController from './GetAnalysisByIdController';
import RetryFailedFramesController from './RetryFailedFramesController';
import { container } from 'tsyringe';

export default {
    deleteById: container.resolve(DeleteAnalysisByIdController),
    getById: container.resolve(GetAnalysisByIdController),
    listByTeamId: container.resolve(GetAnalysesByTeamIdController),
    listByTrajectoryId: container.resolve(GetAnalysesByTrajectoryIdController),
    retryFailedFrames: container.resolve(RetryFailedFramesController)
};
