import type { AIConversationMessageParts } from '@modules/ai/contracts/AIConversationMessage';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Document, Model, Schema } from 'mongoose';

export enum AIMessageRole {
    User = 'user',
    Assistant = 'assistant'
}

export interface AIMessageToolCall {
    toolName: string;
    input: unknown;
}

export interface AIMessageToolResult {
    toolName: string;
    input: unknown;
    output: unknown;
}

export interface AIMessageToolStep {
    stepNumber: number;
    toolCalls: AIMessageToolCall[];
    toolResults: AIMessageToolResult[];
}

export interface AIMessageModelInfo {
    provider: string;
    model: string;
    finishReason: string;
    steps: AIMessageToolStep[];
}

export interface AIMessageTokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

export interface AIMessageProps {
    conversationId: string;
    role: AIMessageRole;
    parts: AIConversationMessageParts;
    
    content: string;
    
    modelInfo: AIMessageModelInfo | null;
    
    tokenUsage: AIMessageTokenUsage | null;
    createdAt: Date;
    updatedAt: Date;
}

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
