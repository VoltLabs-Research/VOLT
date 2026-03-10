import { secretKeyNameSchema, secretKeyRoleIdSchema } from '@modules/team/application/dtos/secret-key/CreateSecretKeyDTO';
import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { z } from 'zod/v4';

const createSecretKeySchema = z.object({
    name: secretKeyNameSchema,
    roleId: secretKeyRoleIdSchema
}).strict();

export const teamSecretKeyValidation = createResourceValidation({
    create: createSecretKeySchema
});
