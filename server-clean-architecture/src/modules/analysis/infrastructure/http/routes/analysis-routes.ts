import { Router } from "express";
import { container } from "tsyringe";
import { protect } from "@/src/shared/infrastructure/http/middleware/authentication";
import DeleteAnalysisByIdController from "../controllers/DeleteAnalysisByIdController";
import GetAnalysesByTeamIdController from "../controllers/GetAnalysesByTeamIdController";
import GetAnalysisByIdController from "../controllers/GetAnalysisByIdController";

const deleteAnalysisByIdController = container.resolve(DeleteAnalysisByIdController);
const getAnalysesByTeamIdController = container.resolve(GetAnalysesByTeamIdController);
const getAnalysisByIdController = container.resolve(GetAnalysisByIdController);

const router = Router();

router.use(protect);

router.get('/:teamId', getAnalysesByTeamIdController.handle);

router.route('/:teamId/:analysisId')
    .get(getAnalysisByIdController.handle)
    .delete(deleteAnalysisByIdController.handle);

export default router;