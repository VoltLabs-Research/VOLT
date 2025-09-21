/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*/

import HandlerFactory from '@/controllers/handler-factory';
import { Notification } from '@/models/index';
import { Request } from 'express';

const factory = new HandlerFactory({
    model: Notification,
    fields: ['title', 'content', 'read', 'link'],
    errorMessages: {
        default: {
            notFound: 'Notification::NotFound',
            validation: 'Notification::ValidationError',
            unauthorized: 'Notification::AccessDenied'
        }
    },
    defaultErrorConfig: 'default'
});

const withCurrentUserFilter = (options: any = {}) => ({
    ...options,
    customFilter: async (req: Request) => ({ recipient: (req as any).user.id })
});

export const getUserNotifications = factory.getAll(
    withCurrentUserFilter({
        // Default sort: newest first
        // Sorting is controlled by query, but we can provide defaults client-side.
    })
);

export const markNotificationRead = factory.updateOne(
    withCurrentUserFilter({
        allowedFields: ['read']
    })
);

export const deleteNotification = factory.deleteOne(withCurrentUserFilter());
