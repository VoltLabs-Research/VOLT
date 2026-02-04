import { Document, Schema } from 'mongoose';

export interface INotification extends Document{
    recipient: Schema.Types.ObjectId,
    title: string;
    content: string;
    read: boolean;
    link?: string;
}
