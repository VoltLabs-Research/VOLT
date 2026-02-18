import { Schema } from 'mongoose';

export const teamRefField = (required: boolean | [boolean, string] = true) => ({
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required
} as const);

export const userRefField = (required: boolean | [boolean, string] = true) => ({
    type: Schema.Types.ObjectId,
    ref: 'User',
    required
} as const);

export const trajectoryRefField = (required: boolean | [boolean, string] = true) => ({
    type: Schema.Types.ObjectId,
    ref: 'Trajectory',
    required
} as const);
