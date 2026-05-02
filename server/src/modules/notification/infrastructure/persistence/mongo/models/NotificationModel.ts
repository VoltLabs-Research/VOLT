import { ValidationCodes } from '@core/constants/validation-codes';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Schema } from 'mongoose';
import type { Document, Model } from 'mongoose';
import type { NotificationProps } from '@modules/notification/domain/entities/Notification';

type NotificationRelations = 'recipient';
export interface NotificationDocument extends Persistable<NotificationProps, NotificationRelations>, Document {}

const NotificationSchema: Schema<NotificationDocument> = new Schema({
    recipient: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: [true, ValidationCodes.NOTIFICATION_TITLE_REQUIRED],
        trim: true
    },
    content: {
        type: String,
        required: [true, ValidationCodes.NOTIFICATION_CONTENT_REQUIRED],
        trim: true
    },
    read: {
        type: Boolean,
        default: false,
        required: true
    },
    link: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

const NotificationModel: Model<NotificationDocument> = mongoose.model<NotificationDocument>('Notification', NotificationSchema);

export default NotificationModel;
