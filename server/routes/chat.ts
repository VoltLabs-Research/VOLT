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
    getTeamMembers
} from '@/controllers/chat';

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

// Mark messages as read
router.patch('/:chatId/read', markMessagesAsRead);

export default router;
