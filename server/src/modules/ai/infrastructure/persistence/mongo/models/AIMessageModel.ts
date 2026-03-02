import mongoose, { Schema, Model, Document } from 'mongoose';
import { AIMessageProps } from '@modules/ai/domain/entities/AIMessage';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

type AIMessageRelations = 'conversationId';
export interface AIMessageDocument extends Persistable<AIMessageProps, AIMessageRelations>, Document {}

const AIMessageSchema: Schema<AIMessageDocument> = new Schema({
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: 'AIConversation',
        required: true,
        index: true
    },
    role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true
    },
    parts: {
        type: Schema.Types.Mixed,
        required: true,
        default: []
    },
    content: {
        type: String,
        default: ''
    },
    modelInfo: {
        type: Schema.Types.Mixed,
        default: null
    },
    tokenUsage: {
        type: Schema.Types.Mixed,
        default: null
    }
}, {
    timestamps: true
});

AIMessageSchema.index({ conversationId: 1, createdAt: 1 });

const AIMessageModel: Model<AIMessageDocument> = mongoose.model<AIMessageDocument>('AIMessage', AIMessageSchema);

export default AIMessageModel;
