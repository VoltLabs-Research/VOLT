/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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

import express, { Router } from 'express';
import TeamController from '@/controllers/team';
import * as authMiddleware from '@middlewares/authentication';
import * as middleware from '@middlewares/team';
import ActivityController from '@/controllers/activity';

const router = express.Router();
const teamController = new TeamController();
const activityController = new ActivityController();

router.use(authMiddleware.protect);
router.route('/')
    .get(teamController.getAll)
    .post(teamController.createOne);

router.route('/:id')
    .get(middleware.checkTeamMembership, teamController.getOne)
    .patch(middleware.checkTeamOwnership, teamController.updateOne)
    .delete(middleware.checkTeamOwnership, teamController.deleteOne);

// Leave team endpoint
router.post('/:id/leave', middleware.checkTeamMembership, teamController.leaveTeam);

// Get team members
router.get('/:id/members', middleware.checkTeamMembership, teamController.getMembers);

// Remove member from team
router.post('/:id/members/remove', middleware.checkTeamMembership, teamController.removeMember);

// Promote/Demote admins
router.patch('/:id/members/promote', middleware.checkTeamMembership, teamController.promoteToAdmin);
router.patch('/:id/members/demote', middleware.checkTeamMembership, teamController.demoteFromAdmin);
router.get('/:teamId/activity', activityController.getTeamActivity);

export default router;
