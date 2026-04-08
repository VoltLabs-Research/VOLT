import DeleteAnalysisByIdController from './DeleteAnalysisByIdController';
import GetAnalysesByTeamIdController from './GetAnalysesByTeamIdController';
import GetAnalysesByTrajectoryIdController from './GetAnalysesByTrajectoryIdController';
import GetAnalysisByIdController from './GetAnalysisByIdController';
import GetAnalysisFrameLogController from './GetAnalysisFrameLogController';
import RetryFailedFramesController from './RetryFailedFramesController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    deleteById: DeleteAnalysisByIdController,
    getById: GetAnalysisByIdController,
    getFrameLog: GetAnalysisFrameLogController,
    listByTeamId: GetAnalysesByTeamIdController,
    listByTrajectoryId: GetAnalysesByTrajectoryIdController,
    retryFailedFrames: RetryFailedFramesController
});
