import { Schema } from 'mongoose';

export const ViewportSchema = new Schema({
    x: {
        type: Number,
        default: 0
    },
    y: {
        type: Number,
        default: 0
    },
    zoom: {
        type: Number,
        default: 1
    }
}, { _id: false });
