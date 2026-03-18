import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { createNamedResourceSchema } from '@shared/infrastructure/http/validation/resource-schemas';
import { z } from 'zod/v4';

const createTeamSchema = createNamedResourceSchema();

const updateTeamSchema = createTeamSchema.partial();

const joinByCodeSchema = z.object({
    code: z.string().length(5).regex(/^[A-Z0-9]{5}$/, 'Code must be 5 uppercase alphanumeric characters')
}).strict();

export const teamValidation = createResourceValidation({
    create: createTeamSchema,
    update: updateTeamSchema,
    joinByCode: joinByCodeSchema,
    previewJoinByCode: joinByCodeSchema
});
