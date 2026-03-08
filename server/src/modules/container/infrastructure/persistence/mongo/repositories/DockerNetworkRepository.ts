import { DockerNetworkEntity, DockerNetworkData, IDockerNetworkRepository } from '@modules/container/domain/port/IDockerNetworkRepository';
import { DockerNetwork, IDockerNetwork } from '@modules/container/infrastructure/persistence/mongo/models/DockerNetworkModel';
import { injectable } from 'tsyringe';

@injectable()
export class DockerNetworkRepository implements IDockerNetworkRepository {
    async findOrCreateByNetworkId(
        networkId: string,
        data: DockerNetworkData
    ): Promise<DockerNetworkEntity> {
        const document = await DockerNetwork.findOneAndUpdate(
            { networkId },
            { name: data.name, driver: data.driver },
            { upsert: true, new: true }
        );
        return this.toEntity(document);
    }

    async findById(_id: string): Promise<DockerNetworkEntity | null> {
        const document = await DockerNetwork.findById(_id);
        if (!document) {
            return null;
        }
        return this.toEntity(document);
    }

    async deleteById(_id: string): Promise<boolean> {
        const result = await DockerNetwork.findByIdAndDelete(_id);
        return result !== null;
    }

    private toEntity(document: IDockerNetwork): DockerNetworkEntity {
        return {
            _id: document._id.toString(),
            networkId: document.networkId,
            name: document.name,
            driver: document.driver,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt
        };
    }
};
