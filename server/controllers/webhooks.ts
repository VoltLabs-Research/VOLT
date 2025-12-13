import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import Webhook from '@/models/webhook';
import { catchAsync } from '@/utilities/runtime/runtime';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';

export default class WebhooksController{
    public getMyWebhooks = catchAsync(async(req: Request, res: Response): Promise<void> =>{
        const user = (req as any).user;

        const webhooks = await Webhook.findByUser(user.id);

        res.status(200).json({
            status: 'success',
            results: webhooks.length,
            data: webhooks
        });
    });

    public createWebhook = catchAsync(async(req: Request, res: Response, next: NextFunction): Promise<void> =>{
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

        if(!events || !Array.isArray(events) || events.length === 0) {
            return next(new RuntimeError(ErrorCodes.WEBHOOK_EVENTS_AT_LEAST_ONE_REQUIRED, 400));
        }

        if(!events.every((event: string) => validEvents.includes(event))) {
            return next(new RuntimeError(ErrorCodes.WEBHOOK_EVENT_INVALID, 400));
        }

        const secret = randomBytes(32).toString('hex');

        const webhook = await Webhook.create({
            name,
            url,
            events,
            secret,
            createdBy: user.id
        });

        res.status(201).json({
            status: 'success',
            data: webhook
        });
    });

    public getWebhook = catchAsync(async(req: Request, res: Response, next: NextFunction): Promise<void> =>{
        const user = (req as any).user;
        const { id } = req.params;

        const webhook = await Webhook.findOne({ _id: id, createdBy: user.id });

        if(!webhook){
            return next(new RuntimeError(ErrorCodes.WEBHOOK_NOT_FOUND, 404));
        }

        res.status(200).json({
            status: 'success',
            data: webhook
        });
    });

    public updateWebhook = catchAsync(async(req: Request, res: Response, next: NextFunction): Promise<void> =>{
        const user = (req as any).user;
        const { id } = req.params;
        const { name, url, events, isActive } = req.body;

        const webhook = await Webhook.findOne({ _id: id, createdBy: user.id });

        if(!webhook){
            return next(new RuntimeError(ErrorCodes.WEBHOOK_NOT_FOUND, 404));
        }

        if(name !== undefined) webhook.name = name;
        if(url !== undefined) webhook.url = url;
        if(events !== undefined){
            const validEvents = [
                'trajectory.created',
                'trajectory.updated',
                'trajectory.deleted',
                'analysis.completed',
                'analysis.failed',
                'user.login',
                'user.logout'
            ];

            if(!events.every((event: string) => validEvents.includes(event))) {
                return next(new RuntimeError(ErrorCodes.WEBHOOK_INVALID_EVENT_TYPE, 400));
            }

            webhook.events = events;
        }
        if(isActive !== undefined) webhook.isActive = isActive;

        await webhook.save();

        res.status(200).json({
            status: 'success',
            data: webhook
        });
    });

    public deleteWebhook = catchAsync(async(req: Request, res: Response, next: NextFunction): Promise<void> =>{
        const user = (req as any).user;
        const { id } = req.params;

        const webhook = await Webhook.findOne({ _id: id, createdBy: user.id });

        if(!webhook){
            return next(new RuntimeError(ErrorCodes.WEBHOOK_NOT_FOUND, 404));
        }

        await Webhook.findByIdAndDelete(id);

        res.status(204).json({
            status: 'success',
            data: null
        });
    });

    public testWebhook = catchAsync(async(req: Request, res: Response, next: NextFunction): Promise<void> =>{
        const user = (req as any).user;
        const { id } = req.params;

        const webhook = await Webhook.findOne({ _id: id, createdBy: user.id });

        if(!webhook){
            return next(new RuntimeError(ErrorCodes.WEBHOOK_NOT_FOUND, 404));
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

        try{
            await webhook.trigger(testPayload);

            res.status(200).json({
                status: 'success',
                message: 'Webhook test successful'
            });
        }catch(error: any){
            res.status(400).json({
                status: 'error',
                message: 'Webhook test failed',
                error: error.message
            });
        }
    });

    public getWebhookStats = catchAsync(async(req: Request, res: Response): Promise<void> =>{
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

        res.status(200).json({
            status: 'success',
            data: stats[0] || {
                totalWebhooks: 0,
                activeWebhooks: 0,
                failedWebhooks: 0,
                lastTriggered: null
            }
        });
    });
}
