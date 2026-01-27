/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
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

import mongoose, { Schema, Model } from 'mongoose';
import { IChat } from '@/types/models/chat';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import { ValidationCodes } from '@/constants/validation-codes';

const ChatSchema: Schema<IChat> = new Schema({
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, ValidationCodes.CHAT_PARTICIPANTS_REQUIRED]
    }],
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: [true, ValidationCodes.CHAT_TEAM_REQUIRED],
        inverse: { path: 'chats', behavior: 'addToSet' }
    },
    messages: [{
        type: Schema.Types.ObjectId,
        ref: 'Message',
        cascade: 'delete',
        inverse: { path: 'chat', behavior: 'set' }
    }],
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'Message'
    },
    lastMessageAt: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Group chat fields
    isGroup: {
        type: Boolean,
        default: false
    },
    groupName: {
        type: String,
        required: function() { return this.isGroup; }
    },
    groupDescription: {
        type: String,
        default: ''
    },
    groupAvatar: {
        type: String,
        default: ''
    },
    admins: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: function() { return this.isGroup; }
    }
}, {
    timestamps: true
});

ChatSchema.index({ participants: 1, team: 1 }, { unique: false });
ChatSchema.index({ isGroup: 1 });
ChatSchema.index({ team: 1, isActive: 1 });

ChatSchema.plugin(useCascadeDelete);

const Chat: Model<IChat> = mongoose.model<IChat>('Chat', ChatSchema);

export default Chat;
