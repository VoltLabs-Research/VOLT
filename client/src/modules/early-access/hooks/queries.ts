import service from '@/modules/early-access/api/service';
import { createMutation } from '@/shared/infrastructure/query';
import type {
    CreateEarlyAccessSubscriptionInputDTO,
    CreateEarlyAccessSubscriptionOutputDTO
} from '@/modules/early-access/api/service';

export const useCreateEarlyAccessSubscriptionMutation = createMutation<
    CreateEarlyAccessSubscriptionOutputDTO,
    CreateEarlyAccessSubscriptionInputDTO
>(service.createSubscription);
