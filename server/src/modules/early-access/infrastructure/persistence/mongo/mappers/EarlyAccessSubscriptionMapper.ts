import EarlyAccessSubscription, {
    EarlyAccessSubscriptionProps
} from '@modules/early-access/domain/entities/EarlyAccessSubscription';
import { EarlyAccessSubscriptionDocument } from '@modules/early-access/infrastructure/persistence/mongo/models/EarlyAccessSubscriptionModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<EarlyAccessSubscription, EarlyAccessSubscriptionProps, EarlyAccessSubscriptionDocument>(
    EarlyAccessSubscription,
    ['team']
);
