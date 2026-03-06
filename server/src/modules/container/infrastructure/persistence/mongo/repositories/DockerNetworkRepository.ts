import { injectable } from 'tsyringe';
import {
    IDockerNetworkRepository,
    DockerNetworkEntity
} from '@modules/container/domain/port/IDockerNetworkRepository';
import {
    DockerNetwork,
    IDockerNetwork
} from '@modules/container/infrastructure/persistence/mongo/models/DockerNetworkModel';

@injectable()
export class DockerNetworkRepository implements IDockerNetworkRepository {
    async findOrCreateByNetworkId(
        networkId: string,
        data: { name: string; driver: string }
    ): Promise<DockerNetworkEntity> {
        const document = await DockerNetwork.findOneAndUpdate(
            { networkId },
            { name: data.name, driver: data.driver },
            { upsert: true, new: true }
        );
        return this.toEntity(document);
    }

    async findById(id: string): Promise<DockerNetworkEntity | null> {
        const document = await DockerNetwork.findById(id);
        if (!document) {
            return null;
        }
        return this.toEntity(document);
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await DockerNetwork.findByIdAndDelete(id);
        return result !== null;
    }

    private toEntity(document: IDockerNetwork): DockerNetworkEntity {
        return {
            id: document._id.toString(),
            networkId: document.networkId,
            name: document.name,
            driver: document.driver,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt
        };
    }
}
