import { createValidationMiddleware, ValidationTarget } from '@shared/infrastructure/http/middleware/validation';
import { createPaginationQuerySchema } from '@shared/infrastructure/http/validation/shared-schemas';

const listMyNotificationsQuerySchema = createPaginationQuerySchema({ maxLimit: 100 });

export const notificationValidation = {
    listMyNotifications: createValidationMiddleware(listMyNotificationsQuerySchema, ValidationTarget.Query)
};
