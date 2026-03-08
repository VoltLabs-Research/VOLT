import { z } from 'zod/v4';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { createPaginationQuerySchema } from '@shared/infrastructure/http/validation/shared-schemas';

const listMyNotificationsQuerySchema = createPaginationQuerySchema({ maxLimit: 100 });

const markAllMyNotificationsAsReadBodySchema = z.object({}).strict();

export const notificationValidation = {
    listMyNotifications: createValidationMiddleware(listMyNotificationsQuerySchema, 'query'),
    markAllMyNotificationsAsRead: createValidationMiddleware(markAllMyNotificationsAsReadBodySchema)
};
