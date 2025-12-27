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

import { Router } from 'express';
import TeamController from '@controllers/team';
import * as authMiddleware from '@middlewares/authentication';
import * as middleware from '@middlewares/team';

const router = Router();
const controller = new TeamController();

router.use(authMiddleware.protect);
router.route('/')
    .get(controller.getAll)
    .post(controller.createOne);

router.route('/:id')
    .get(middleware.checkTeamMembership, controller.getOne)
    .patch(middleware.checkTeamOwnership, controller.updateOne)
    .delete(middleware.checkTeamOwnership, controller.deleteOne);

// Leave team endpoint
router.post('/:id/leave', middleware.checkTeamMembership, controller.leaveTeam);

// Get team members
router.get('/:id/members', middleware.checkTeamMembership, controller.getMembers);

// Remove member from team
router.post('/:id/members/remove', middleware.checkTeamMembership, controller.removeMember);

// Promote/Demote admins
router.patch('/:id/members/promote', middleware.checkTeamMembership, controller.promoteToAdmin);
router.patch('/:id/members/demote', middleware.checkTeamMembership, controller.demoteFromAdmin);

export default router;
