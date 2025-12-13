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

import mongoose, { Schema, Model } from 'mongoose';
import { ITeam } from '@/types/models/team';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import useInverseRelations from '@/utilities/mongo/inverse-relations';
import { ValidationCodes } from '@/constants/validation-codes';

const TeamSchema = new Schema({
    name: {
        type: String,
        required: [true, ValidationCodes.TEAM_NAME_REQUIRED],
        trim: true,
        minlength: [3, ValidationCodes.TEAM_NAME_MINLEN],
        maxlength: [50, ValidationCodes.TEAM_NAME_MAXLEN]
    },
    description: {
        type: String,
        trim: true,
        maxlength: [250, ValidationCodes.TEAM_NAME_DESCRIPTION_MAXLEN]
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, ValidationCodes.TEAM_OWNER_REQUIRED],
        cascade: 'delete'
    },
    members: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        inverse: { path: 'teams', behavior: 'addToSet' },
        cascade: 'pull'
    }],
    invitations: [{
        type: Schema.Types.ObjectId,
        ref: 'TeamInvitation',
        cascade: 'delete'
    }],
    containers: [{
        type: Schema.Types.ObjectId,
        ref: 'Container',
        cascade: 'delete'
    }],
    trajectories: [{
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        cascade: 'pull',
        inverse: { path: 'team', behavior: 'set' }
    }]
}, {
    timestamps: true
});

TeamSchema.plugin(useCascadeDelete);
TeamSchema.plugin(useInverseRelations);

const Team: Model<ITeam> = mongoose.model<ITeam>('Team', TeamSchema);

export default Team;