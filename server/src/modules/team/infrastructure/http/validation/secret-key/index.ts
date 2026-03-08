import { secretKeyNameSchema, secretKeyRoleIdSchema } from '@modules/team/application/dtos/secret-key/CreateSecretKeyDTO';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { z } from 'zod/v4';

const createSecretKeySchema = z.object({
    name: secretKeyNameSchema,
    roleId: secretKeyRoleIdSchema
}).strict();

export const teamSecretKeyValidation = {
    create: createValidationMiddleware(createSecretKeySchema)
};
