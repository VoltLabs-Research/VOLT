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

import mongoose, { Schema, Model } from 'mongoose';
import { IMessage } from '@/types/models/chat';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import { ValidationCodes } from '@/constants/validation-codes';

const MessageSchema: Schema<IMessage> = new Schema({
    chat: {
        type: Schema.Types.ObjectId,
        ref: 'Chat',
        required: true,
        inverse: { path: 'messages', behavior: 'addToSet' }
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: [true, ValidationCodes.MESSAGE_CONTENT_REQUIRED],
        trim: true,
        maxlength: [2000, ValidationCodes.MESSAGE_CONTENT_MAXLEN]
    },
    messageType: {
        type: String,
        enum: ['text', 'file', 'system'],
        default: 'text'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readBy: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    metadata: {
        fileName: String,
        fileSize: Number,
        fileType: String,
        fileUrl: String,
        filePath: String
    },
    editedAt: {
        type: Date,
        default: null
    },
    deleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    deletedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    reactions: [
        new Schema({
            emoji: { type: String, required: true },
            users: [{ type: Schema.Types.ObjectId, ref: 'User' }]
        }, { _id: false })
    ]
}, {
    timestamps: true
});

MessageSchema.index({ chat: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ readBy: 1 });
MessageSchema.index({ 'reactions.emoji': 1 });
MessageSchema.index({ content: 'text' });

MessageSchema.plugin(useCascadeDelete);

const Message: Model<IMessage> = mongoose.model<IMessage>('Message', MessageSchema);

export default Message;
