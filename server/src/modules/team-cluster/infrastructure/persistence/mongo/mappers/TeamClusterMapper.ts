import TeamCluster, { TeamClusterProps } from '@modules/team-cluster/domain/entities/TeamCluster';
import { TeamClusterDocument } from '@modules/team-cluster/infrastructure/persistence/mongo/models/TeamClusterModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamCluster, TeamClusterProps, TeamClusterDocument>(TeamCluster, [
    'team',
    'createdBy'
]);
