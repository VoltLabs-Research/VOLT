import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import DeleteAnalysisByIdController from '@modules/analysis/infrastructure/http/controllers/DeleteAnalysisByIdController';
import GetAnalysesByTeamIdController from '@modules/analysis/infrastructure/http/controllers/GetAnalysesByTeamIdController';
import GetAnalysisByIdController from '@modules/analysis/infrastructure/http/controllers/GetAnalysisByIdController';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const deleteAnalysisByIdController = container.resolve(DeleteAnalysisByIdController);
const getAnalysesByTeamIdController = container.resolve(GetAnalysesByTeamIdController);
const getAnalysisByIdController = container.resolve(GetAnalysisByIdController);

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/analysis',
    router
};

router.use(protect);

router.get('/:teamId', getAnalysesByTeamIdController.handle);

router.route('/:teamId/:analysisId')
    .get(getAnalysisByIdController.handle)
    .delete(deleteAnalysisByIdController.handle);

export default module;