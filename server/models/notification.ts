import mongoose, { Schema, Model, Document } from 'mongoose';

export interface INotification extends Document{
    recipient: Schema.Types.ObjectId,
    title: string;
    content: string;
    read: boolean;
    link?: string;
}

const NotificationSchema: Schema<INotification> = new Schema({
    recipient: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: [true, 'Notification::Title::Required'],
        trim: true
    },
    content: {
        type: String,
        required: [true, 'Notification::Content::Required'],
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

const Notification: Model<INotification> = mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;