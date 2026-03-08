import { Schema } from 'mongoose';

const createReferenceField = (ref: string, required: boolean | [boolean, string] = true) => {
    return Object.freeze({
        type: Schema.Types.ObjectId,
        ref,
        required
    });
};

export const teamRefField = (required: boolean | [boolean, string] = true) => createReferenceField('Team', required);

export const userRefField = (required: boolean | [boolean, string] = true) => createReferenceField('User', required);

export const trajectoryRefField = (required: boolean | [boolean, string] = true) => createReferenceField('Trajectory', required);
