import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import ListSecretKeysByTeamIdUseCase from '@modules/team/application/use-cases/secret-key/ListSecretKeysByTeamIdUseCase';
import { z } from 'zod';

const listSecretKeysRequestSchema = z.object({
    teamId: z.string().min(1),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional()
});

const ListSecretKeysByTeamIdController = createPaginatedController(ListSecretKeysByTeamIdUseCase, {
    validationSchema: {
        params: listSecretKeysRequestSchema.pick({ teamId: true }),
        query: listSecretKeysRequestSchema.pick({ page: true, limit: true })
    }
});
export default ListSecretKeysByTeamIdController;
