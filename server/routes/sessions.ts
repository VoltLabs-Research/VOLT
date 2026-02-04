import { Router } from 'express';
import { protect } from '@/middlewares/authentication';
import SessionController from '@/controllers/auth/session';

const router = Router();
const controller = new SessionController();

router.use(protect);

// Standard CRUD via BaseController
router.get('/', controller.getAll);
router.patch('/:id', controller.updateOne);

// Specialized endpoints
router.get('/activity', controller.getMyLoginActivity);
router.delete('/all/others', controller.revokeAllOtherSessions);

export default router;
