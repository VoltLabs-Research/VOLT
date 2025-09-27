import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '@/utilities/runtime';
import { Webhook } from '@/models/index';
import RuntimeError from '@/utilities/runtime-error';

export const getMyWebhooks = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    
    const webhooks = await Webhook.findByUser(user.id);
    
    const response = {
        status: 'success',
        results: webhooks.length,
        data: webhooks
    };
    
    res.status(200).json(response);
});

export const createWebhook = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    const { name, url, events } = req.body;
    
    const validEvents = [
        'trajectory.created',
        'trajectory.updated',
        'trajectory.deleted',
        'analysis.completed',
        'analysis.failed',
        'user.login',
        'user.logout'
    ];
    
    if (!events || !Array.isArray(events) || events.length === 0) {
        return next(new RuntimeError('At least one event must be selected', 400));
    }
    
    if (!events.every((event: string) => validEvents.includes(event))) {
        return next(new RuntimeError('Invalid event type', 400));
    }
    
    const secret = require('crypto').randomBytes(32).toString('hex');
    
    const webhookData = {
        name,
        url,
        events,
        secret,
        createdBy: user.id
    };
    
    const webhook = await Webhook.create(webhookData);
    
    const response = {
        status: 'success',
        data: webhook
    };
    
    res.status(201).json(response);
});

export const getWebhook = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    const { id } = req.params;
    
    const webhook = await Webhook.findOne({ _id: id, createdBy: user.id });
    
    if (!webhook) {
        return next(new RuntimeError('Webhook not found', 404));
    }
    
    const response = {
        status: 'success',
        data: webhook
    };
    
    res.status(200).json(response);
});

export const updateWebhook = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    const { id } = req.params;
    const { name, url, events, isActive } = req.body;
    
    const webhook = await Webhook.findOne({ _id: id, createdBy: user.id });
    
    if (!webhook) {
        return next(new RuntimeError('Webhook not found', 404));
    }
    
    if (name !== undefined) webhook.name = name;
    if (url !== undefined) webhook.url = url;
    if (events !== undefined) {
        const validEvents = [
            'trajectory.created',
            'trajectory.updated',
            'trajectory.deleted',
            'analysis.completed',
            'analysis.failed',
            'user.login',
            'user.logout'
        ];
        
        if (!events.every((event: string) => validEvents.includes(event))) {
            return next(new RuntimeError('Invalid event type', 400));
        }
        
        webhook.events = events;
    }
    if (isActive !== undefined) webhook.isActive = isActive;
    
    await webhook.save();
    
    const response = {
        status: 'success',
        data: webhook
    };
    
    res.status(200).json(response);
});

export const deleteWebhook = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    const { id } = req.params;
    
    const webhook = await Webhook.findOne({ _id: id, createdBy: user.id });
    
    if (!webhook) {
        return next(new RuntimeError('Webhook not found', 404));
    }
    
    await Webhook.findByIdAndDelete(id);
    
    res.status(204).json({
        status: 'success',
        data: null
    });
});

export const testWebhook = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    const { id } = req.params;
    
    const webhook = await Webhook.findOne({ _id: id, createdBy: user.id });
    
    if (!webhook) {
        return next(new RuntimeError('Webhook not found', 404));
    }
    
    const testPayload = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: {
            message: 'This is a test webhook from OpenDXA',
            webhookId: webhook._id,
            webhookName: webhook.name
        }
    };
    
    try {
        await webhook.trigger(testPayload);
        
        res.status(200).json({
            status: 'success',
            message: 'Webhook test successful'
        });
    } catch (error: any) {
        res.status(400).json({
            status: 'error',
            message: 'Webhook test failed',
            error: error.message
        });
    }
});

export const getWebhookStats = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    
    const stats = await Webhook.aggregate([
        { $match: { createdBy: user._id } },
        {
            $group: {
                _id: null,
                totalWebhooks: { $sum: 1 },
                activeWebhooks: { $sum: { $cond: ['$isActive', 1, 0] } },
                failedWebhooks: { $sum: { $cond: [{ $gte: ['$failureCount', 5] }, 1, 0] } },
                lastTriggered: { $max: '$lastTriggered' }
            }
        }
    ]);
    
    const response = {
        status: 'success',
        data: stats[0] || {
            totalWebhooks: 0,
            activeWebhooks: 0,
            failedWebhooks: 0,
            lastTriggered: null
        }
    };
    
    res.status(200).json(response);
});
