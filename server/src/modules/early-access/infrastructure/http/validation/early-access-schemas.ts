import { EarlyAccessSubscriptionSource } from '@modules/early-access/domain/entities/EarlyAccessSubscription';
import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { teamParamsSchema } from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const createSubscriptionBodySchema = z.object({
    email: z.string().trim().email().max(254),
    source: z.literal(EarlyAccessSubscriptionSource.DiscoverTeam).optional(),
    referrer: z.string().trim().max(2048).optional()
}).strict();

export const earlyAccessValidation = createResourceValidation({
    createSubscription: {
        params: teamParamsSchema,
        body: createSubscriptionBodySchema
    }
});
