import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import {
    createPaginationQuerySchema,
    teamParamsSchema
} from '@shared/infrastructure/http/validation/shared-schemas';

const discoverTrajectoriesQuerySchema = createPaginationQuerySchema({
    maxLimit: 100,
    includeSearch: true
});

export const discoverValidation = createResourceValidation({
    listPublicTeamTrajectories: {
        params: teamParamsSchema,
        query: discoverTrajectoriesQuerySchema
    }
});
