import { Container, IContainerProps } from '@modules/container/entities/Container';
import { IContainer as IContainerDoc } from '@modules/container/models/ContainerModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<Container, IContainerProps, IContainerDoc>(Container, [
    'createdBy',
    'team',
    'teamCluster',
    'folder'
]);
