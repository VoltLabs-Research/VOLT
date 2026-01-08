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
import FilePreviewController from '@/controllers/file-preview';
import {
    verifyChatAccess,
    verifyTeamAccess,
    verifyParticipantInTeam,
    requireMessageOwner,
    loadMessage
} from '@/middlewares/chat';

import * as auth from '@/middlewares/authentication';
import ChatController from '@/controllers/chat/chat';
import GroupChatController from '@/controllers/chat/group-chat';

const router = Router();
const previewController = new FilePreviewController();
const controller = new ChatController();
const group = new GroupChatController();

router.use(auth.protect);

router.get('/', controller.getChats);
router.get('/teams/:teamId/members', verifyTeamAccess, controller.getTeamMembers);
router.get('/teams/:teamId/participants/:participantId',
    verifyTeamAccess,
    verifyParticipantInTeam,
    controller.getOrCreateChat
);

router.get('/files/:filename', controller.getFile);

router.get('/:chatId/messages',
    verifyChatAccess,
    controller.getChatMessages
);

router.post('/:chatId/messages',
    verifyChatAccess,
    controller.sendMessage
);

router.patch('/:chatId/messages/:messageId',
    verifyChatAccess,
    loadMessage,
    requireMessageOwner,
    controller.editMessage
);

router.delete('/:chatId/messages/:messageId',
    verifyChatAccess,
    loadMessage,
    requireMessageOwner,
    controller.deleteMessage
);

router.patch('/:chatId/read',
    verifyChatAccess,
    controller.markMessagesAsRead
);

router.post('/:chatId/upload',
    verifyChatAccess,
    controller.uploadFile
);

router.post('/:chatId/send-file',
    verifyChatAccess,
    controller.sendFileMessage
);

router.get('/:chatId/messages/:messageId/preview',
    verifyChatAccess,
    previewController.getFileBase64
);

router.post('/groups', group.createGroupChat);
router.post('/:chatId/groups/add-users', group.addUsersToGroup);
router.post('/:chatId/groups/remove-users', group.removeUsersFromGroup);
router.patch('/:chatId/groups/info', group.updateGroupInfo);
router.patch('/:chatId/groups/admins', group.updateGroupAdmins);
router.post('/:chatId/groups/leave', group.leaveGroup);

export default router;
