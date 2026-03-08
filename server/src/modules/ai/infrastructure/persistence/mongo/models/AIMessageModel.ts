import type { AIMessageProps } from '@modules/ai/domain/entities/AIMessage';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Document, Model, Schema } from 'mongoose';
import { AIMessageRole } from '@modules/ai/domain/entities/AIMessage';

type AIMessageRelation = 'conversationId';

export interface AIMessageDocument extends Persistable<AIMessageProps, AIMessageRelation>, Document {}

const AIMessageSchema: Schema<AIMessageDocument> = new Schema({
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: 'AIConversation',
        required: true,
        index: true
    },
    role: {
        type: String,
        enum: [AIMessageRole.User, AIMessageRole.Assistant],
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
