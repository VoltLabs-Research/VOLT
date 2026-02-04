import { Router } from 'express';
import SSHFileExplorerController from '@/controllers/docker/ssh-file-explorer';
import * as authMiddleware from '@/middlewares/authentication';
import * as middleware from '@/middlewares/ssh-connection';
import * as teamMiddleware from '@/middlewares/team';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new SSHFileExplorerController();
const rbac = new RBACMiddleware(controller, router);

router.use(authMiddleware.protect);
router.use(middleware.loadAndVerifySSHConnection);

rbac.groupBy(Action.READ)
    .route('/list', controller.listSSHFiles);

rbac.groupBy(Action.CREATE)
    .route(
        '/import', 
        middleware.validateSSHImportFields, 
        teamMiddleware.checkTeamMembership, 
        controller.importTrajectoryFromSSH
    );

export default router;