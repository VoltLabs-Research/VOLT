import { IMapper } from '@shared/infrastructure/persistence/IMapper';
import { Container, IContainerProps } from '@modules/container/domain/entities/Container';
import { IContainer as IContainerDoc } from '@modules/container/infrastructure/persistence/mongo/models/ContainerModel';

export class ContainerMapper implements IMapper<Container, IContainerProps, IContainerDoc> {
    toDomain(raw: IContainerDoc): Container {
        return new Container(
            raw.name,
            raw.image,
            raw.containerId,
            raw.createdBy.toString(),
            raw.status,
            raw.memory,
            raw.cpus,
            raw.internalIp,
            raw.team?.toString(),
            raw.env || [],
            raw.ports || [],
            raw.network?.toString(),
            raw.volume?.toString(),
            raw.createdAt,
            raw.updatedAt,
            raw._id.toString()
        );
    }

    toPersistence(domain: Container | IContainerProps): any {
        return {
            name: domain.name,
            image: domain.image,
            containerId: domain.containerId,
            createdBy: domain.createdBy,
            status: domain.status,
            memory: domain.memory,
            cpus: domain.cpus,
            internalIp: domain.internalIp,
            team: domain.team,
            env: domain.env,
            ports: domain.ports,
            network: domain.network,
            volume: domain.volume
        };
    }
}
