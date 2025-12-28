import express from 'express';
import TeamRoleController from '@/controllers/team-role';
import * as authMiddleware from '@middlewares/authentication';
import * as teamMiddleware from '@middlewares/team';

const router = express.Router({ mergeParams: true });
const controller = new TeamRoleController();

router.use(authMiddleware.protect);
router.use(teamMiddleware.checkTeamMembership);

router.route('/')
    .get(controller.getRoles)
    .post(controller.createRole);

router.route('/:roleId')
    .patch(controller.updateRole)
    .delete(controller.deleteRole);

router.get('/members', controller.getMembers);
router.patch('/members/:memberId/role', controller.assignRole);

export default router;
