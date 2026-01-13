import { Schema } from 'mongoose';

export const VisualizersDataSchema = new Schema({
    canvas: {
        type: Boolean,
        default: false
    },
    raster: {
        type: Boolean,
        default: false
    },
    listingTitle: {
        type: String,
        default: ''
    },
    listing: {
        type: Schema.Types.Mixed
    },
    perAtomProperties: {
        type: [String],
        default: []
    }
}, { _id: false });
