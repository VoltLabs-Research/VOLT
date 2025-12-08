import { Router } from 'express';
import ColorCodingController from '@/controllers/color-coding';
import * as midldeware from '@/middlewares/authentication';

const router = Router();
const controller = new ColorCodingController();

router.use(midldeware.protect);

router.get(
    '/properties/:trajectoryId/:analysisId',
    // TODO: checkTeamMembershipForTrajectory
    controller.getProperties
);

router.get(
    '/stats/:trajectoryId/:analysisId',
    controller.getStats
);

router.route('/:trajectoryId/:analysisId/')
    .get(controller.get)
    .post(controller.create);

export default router;