import service from '@/modules/early-access/api/service';
import { createMutation } from '@/shared/query';
import type {
    CreateEarlyAccessSubscriptionInput,
    CreateEarlyAccessSubscriptionResponse
} from '@/modules/early-access/api/service';

export const useCreateEarlyAccessSubscriptionMutation = createMutation<
    CreateEarlyAccessSubscriptionResponse,
    CreateEarlyAccessSubscriptionInput
>(service.createSubscription);
