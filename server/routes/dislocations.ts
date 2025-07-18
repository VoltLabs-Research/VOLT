import { Router } from 'express';
import * as controller from '@controllers/dislocations';

const router = Router();

router.get('/trajectory/:trajectoryId', controller.getTrajectoryDislocations);

export default router;