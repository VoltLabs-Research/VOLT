import ClusterTransferJob, { ClusterTransferJobProps } from '@modules/team-cluster/domain/entities/ClusterTransferJob';
import { ClusterTransferJobDocument } from '@modules/team-cluster/infrastructure/persistence/mongo/models/ClusterTransferJobModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<ClusterTransferJob, ClusterTransferJobProps, ClusterTransferJobDocument>(ClusterTransferJob, [
    'team'
]);
