import TeamCluster, { TeamClusterProps } from '@modules/cluster/entities/TeamCluster';
import { TeamClusterDocument } from '@modules/cluster/models/TeamClusterModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamCluster, TeamClusterProps, TeamClusterDocument>(TeamCluster, [
    'team',
    'createdBy'
]);
