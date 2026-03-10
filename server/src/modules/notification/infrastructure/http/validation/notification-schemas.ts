import { ValidationTarget } from '@shared/infrastructure/http/middleware/validation';
import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { createPaginationQuerySchema } from '@shared/infrastructure/http/validation/shared-schemas';

const listMyNotificationsQuerySchema = createPaginationQuerySchema({ maxLimit: 100 });

export const notificationValidation = createResourceValidation({
    listMyNotifications: {
        schema: listMyNotificationsQuerySchema,
        target: ValidationTarget.Query
    }
});
