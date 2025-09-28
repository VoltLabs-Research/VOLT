/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
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
**/

import { Router } from 'express';
import { protect } from '@/middlewares/authentication';
import {
    getChats,
    getOrCreateChat,
    getChatMessages,
    sendMessage,
    markMessagesAsRead,
    getTeamMembers,
    editMessage,
    deleteMessage,
    toggleReaction,
    uploadFile,
    serveFile,
    sendFileMessage
} from '@/controllers/chat';
import {
    createGroupChat,
    addUsersToGroup,
    removeUsersFromGroup,
    updateGroupInfo,
    updateGroupAdmins,
    leaveGroup
} from '@/controllers/group-chat';

const router = Router();

// All routes require authentication
router.use(protect);

// Get all chats for user's teams
router.get('/', getChats);

// Get team members for chat initialization
router.get('/teams/:teamId/members', getTeamMembers);

// Get or create a chat between two users
router.get('/teams/:teamId/participants/:participantId', getOrCreateChat);

// Get messages for a specific chat
router.get('/:chatId/messages', getChatMessages);

// Send a message to a chat
router.post('/:chatId/messages', sendMessage);

// Edit, delete and react to messages
router.patch('/:chatId/messages/:messageId', editMessage);
router.delete('/:chatId/messages/:messageId', deleteMessage);
router.post('/:chatId/messages/:messageId/reactions', toggleReaction);

// Mark messages as read
router.patch('/:chatId/read', markMessagesAsRead);

// File upload and serving
router.post('/:chatId/upload', uploadFile);
router.post('/:chatId/send-file', sendFileMessage);
router.get('/files/:filename', serveFile);

// Group chat management
router.post('/groups', createGroupChat);
router.post('/:chatId/groups/add-users', addUsersToGroup);
router.post('/:chatId/groups/remove-users', removeUsersFromGroup);
router.patch('/:chatId/groups/info', updateGroupInfo);
router.patch('/:chatId/groups/admins', updateGroupAdmins);
router.post('/:chatId/groups/leave', leaveGroup);

export default router;
