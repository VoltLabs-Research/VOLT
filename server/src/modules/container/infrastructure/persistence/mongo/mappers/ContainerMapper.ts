import { Container, IContainerProps } from '@modules/container/domain/entities/Container';
import { IContainer as IContainerDoc } from '@modules/container/infrastructure/persistence/mongo/models/ContainerModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<Container, IContainerProps, IContainerDoc>(Container, [
    'createdBy',
    'team',
    'teamCluster',
    'network',
    'volume'
]);
