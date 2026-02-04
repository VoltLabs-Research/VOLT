import mongoose, { Document } from 'mongoose';

export interface ITeam extends Document {
    name: string;
    description?: string;
    owner: mongoose.Types.ObjectId;
    admins: mongoose.Types.ObjectId[];
    members: mongoose.Types.ObjectId[];
    invitations: mongoose.Types.ObjectId[];
    containers: mongoose.Types.ObjectId[];
    trajectories: mongoose.Types.ObjectId[];
    chats: mongoose.Types.ObjectId[];
    plugins: mongoose.Types.ObjectId[];
}
