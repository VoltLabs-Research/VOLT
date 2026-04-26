import TeamCluster, { TeamClusterProps } from '@modules/cluster/domain/entities/TeamCluster';
import { TeamClusterDocument } from '@modules/cluster/infrastructure/persistence/mongo/models/TeamClusterModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamCluster, TeamClusterProps, TeamClusterDocument>(TeamCluster, [
    'team',
    'createdBy'
]);
