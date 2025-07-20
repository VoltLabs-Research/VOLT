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

import mongoose, { Schema, Model, HookNextFunction } from 'mongoose';
import { ITeam } from '@types/models/team';
import User from '@models/user';
import Trajectory from '@models/trajectory';

const TeamSchema: Schema<ITeam> = new Schema({
    name: {
        type: String,
        required: [true, 'Team::Name::Required'],
        trim: true,
        minlength: [3, 'Team::Name::MinLength'],
        maxlength: [50, 'Team::Name::MaxLength']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [250, 'Team::Description::MaxLength']
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Team::Owner::Required']
    },
    members: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    trajectories: [{
        type: Schema.Types.ObjectId,
        ref: 'Trajectory'
    }]
}, {
    timestamps: true
});

TeamSchema.pre('findOneAndDelete', async function (next: HookNextFunction){
    const teamToDelete = await this.model.findOne(this.getFilter());
    if(!teamToDelete){
        return next();
    }

    await Trajectory.deleteMany({ _id: { $in: teamToDelete.trajectories } });

    await User.updateMany(
        { _id: { $in: [teamToDelete.owner, ...teamToDelete.members] } },
        { $pull: { teams: teamToDelete._id } }
    );
    
    next();
});

const Team: Model<ITeam> = mongoose.model<ITeam>('Team', TeamSchema);

export default Team;