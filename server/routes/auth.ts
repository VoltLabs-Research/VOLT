import express from 'express';
import * as controller from '@controllers/authentication';
import * as middleware from '@middlewares/authentication';

const router = express.Router();

router.post('/sign-in', controller.signIn);
router.post('/sign-up', controller.signUp);

router.use(middleware.protect);
router.patch('/me/update/password/', controller.updateMyPassword);

router.route('/me')
    .get(controller.getMyAccount)
    .patch(controller.updateMyAccount)
    .delete(controller.deleteMyAccount);

export default router;