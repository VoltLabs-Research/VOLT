import { createValidationMiddleware, ValidationTarget } from '@shared/infrastructure/http/middleware/validation';
import { createPaginationQuerySchema } from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const listMyNotificationsQuerySchema = createPaginationQuerySchema({ maxLimit: 100 });

const markAllMyNotificationsAsReadBodySchema = z.object({}).strict();

export const notificationValidation = {
    listMyNotifications: createValidationMiddleware(listMyNotificationsQuerySchema, ValidationTarget.Query),
    markAllMyNotificationsAsRead: createValidationMiddleware(markAllMyNotificationsAsReadBodySchema)
};
