import { ValidationCodes } from '@/constants/validation-codes';
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWebhook extends Document {
    name: string;
    url: string;
    events: string[];
    secret: string;
    isActive: boolean;
    lastTriggered?: Date;
    failureCount: number;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;

    trigger(payload: any): Promise<void>;
    isHealthy(): boolean;
}

export interface IWebhookModel extends Model<IWebhook>{
    findByUser(userId: string): Promise<IWebhook[]>;
    findByEvent(event: string): Promise<IWebhook[]>;
}

const webhookSchema = new Schema<IWebhook>({
    name: {
        type: String,
        required: [true, ValidationCodes.WEBHOOK_NAME_REQUIRED],
        trim: true,
        maxlength: [100, ValidationCodes.WEBHOOK_NAME_MAXLEN]
    },
    url: {
        type: String,
        required: [true, ValidationCodes.WEBHOOK_URL_REQUIRED],
        trim: true,
        validate: {
            validator: function(v: string) {
                return /^https?:\/\/.+/.test(v);
            },
            message: ValidationCodes.WEBHOOK_URL_INVALID
        }
    },
    events: [{
        type: String,
        enum: [
            'trajectory.created',
            'trajectory.updated',
            'trajectory.deleted',
            'analysis.completed',
            'analysis.failed',
            'user.login',
            'user.logout'
        ],
        required: true
    }],
    secret: {
        type: String,
        required: true,
        select: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastTriggered: {
        type: Date,
        default: null
    },
    failureCount: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

webhookSchema.index({ createdBy: 1, isActive: 1 });
webhookSchema.index({ events: 1 });
webhookSchema.index({ lastTriggered: -1 });

webhookSchema.virtual('status').get(function() {
    if(!this.isActive) return 'inactive';
    if(this.failureCount >= 5) return 'failed';
    return 'active';
});

webhookSchema.methods.trigger = async function(payload: any): Promise<void>{
    const crypto = require('crypto');
    const axios = require('axios');

    const signature = crypto
        .createHmac('sha256', this.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

    try{
        await axios.post(this.url, payload, {
            headers: {
                'X-Webhook-Signature': `sha256=${signature}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        this.lastTriggered = new Date();
        this.failureCount = 0;
        await this.save();
    }catch(error){
        this.failureCount += 1;
        await this.save();
        throw error;
    }
};

webhookSchema.methods.isHealthy = function(): boolean{
    return this.failureCount < 5;
};

webhookSchema.statics.findByUser = function(this: mongoose.Model<IWebhook>, userId: string) {
    return this.find({ createdBy: userId }).sort({ createdAt: -1 });
};

webhookSchema.statics.findByEvent = function(this: mongoose.Model<IWebhook>, event: string) {
    return this.find({ events: event, isActive: true });
};

const Webhook = mongoose.model<IWebhook, IWebhookModel>('Webhook', webhookSchema);

export default Webhook;
