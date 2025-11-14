import { Router } from 'express';
import * as controller from '@controllers/team-invitation';
import * as authMiddleware from '@middlewares/authentication';

const router = Router();

// Public route - Get invitation details (for unauthenticated users viewing email link)
router.get('/details/:token', controller.getInvitationDetails);

// Protected routes (require authentication)
router.use(authMiddleware.protect);

// Specific routes BEFORE generic routes to prevent path conflicts
// Get pending invitations for current user
router.get('/pending', controller.getPendingInvitations);

// Accept invitation
router.post('/accept/:token', controller.acceptTeamInvitation);

// Reject invitation
router.post('/reject/:token', controller.rejectTeamInvitation);

// Generic route - Send invitation
router.post('/:teamId/invite', controller.sendTeamInvitation);

export default router;
