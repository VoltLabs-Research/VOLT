import { IMapper } from '@/src/shared/infrastructure/persistence/IMapper';
import { Container, IContainerProps } from '../../../../domain/entities/Container';
import { IContainer as IContainerDoc } from '../models/ContainerModel';

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
        // If it's the class, access properties. If interface, same.
        // But mapped properties should be clean.
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
