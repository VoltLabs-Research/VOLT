import { Container, IContainerProps } from '@modules/container/domain/entities/Container';
import { IContainer as IContainerDoc } from '@modules/container/infrastructure/persistence/mongo/models/ContainerModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class ContainerMapper extends BaseMapper<Container, IContainerProps, IContainerDoc> {
    constructor(){
        super(Container, [
            'createdBy',
            'team',
            'network',
            'volume'
        ]);
    }
}

export default new ContainerMapper();
