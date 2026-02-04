import mongoose, { Schema, Model } from 'mongoose';
import { INotification } from '@/types/models/notification';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import { ValidationCodes } from '@/constants/validation-codes';

const NotificationSchema: Schema<INotification> = new Schema({
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

NotificationSchema.plugin(useCascadeDelete);

const Notification: Model<INotification> = mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
