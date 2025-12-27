/**
* Copyright(C) Rodolfo Herrera Hernandez. All rights reserved.
*/

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { FilterQuery } from 'mongoose';
import BaseController from '@/controllers/base-controller';
import { Notification } from '@/models/index';
import type { INotification } from '@/types/models/notification';

export default class NotificationController extends BaseController<INotification> {
    constructor() {
        super(Notification, {
            resourceName: 'Notification',
            fields: ['title', 'content', 'read', 'link']
        });
    }

    /**
     * Users can only access their own notifications.
     */
    protected async getFilter(req: Request): Promise<FilterQuery<INotification>> {
        return { recipient: (req as any).user.id };
    }

    public getUserNotifications: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
        return this.getAll(req, res, next);
    };

    /**
     * Marks a notification as read(id comes from route param).
     */
    public markNotificationRead: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
        req.body = { read: true };
        return this.updateOne(req, res, next);
    };

    /**
     * Marks all notifications for the current user as read.
     */
    public markAllRead: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.model.updateMany(
                { recipient: (req as any).user.id, read: false },
                { read: true }
            );
            res.status(200).json({ status: 'success', data: null });
        } catch (error) {
            next(error);
        }
    };

    public deleteNotification: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
        return this.deleteOne(req, res, next);
    };
}
