/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Router } from 'express';
import TeamInvitationController from '@controllers/team-invitation';
import * as authMiddleware from '@middlewares/authentication';

const router = Router();
const controller = new TeamInvitationController();

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
