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

    /**
     * Marks all notifications for the current user as read.
     * (Specialized bulk operation - not standard CRUD)
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
}
