import ClusterTransferJob, { ClusterTransferJobProps } from '@modules/cluster/entities/ClusterTransferJob';
import { ClusterTransferJobDocument } from '@modules/cluster/models/ClusterTransferJobModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<ClusterTransferJob, ClusterTransferJobProps, ClusterTransferJobDocument>(ClusterTransferJob, [
    'team'
]);
