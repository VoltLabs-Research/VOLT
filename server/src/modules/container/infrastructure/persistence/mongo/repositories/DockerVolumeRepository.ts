import { injectable } from 'tsyringe';
import {
    IDockerVolumeRepository,
    DockerVolumeEntity
} from '@modules/container/domain/port/IDockerVolumeRepository';
import {
    DockerVolume,
    IDockerVolume
} from '@modules/container/infrastructure/persistence/mongo/models/DockerVolumeModel';

@injectable()
export class DockerVolumeRepository implements IDockerVolumeRepository {
    async findOrCreateByVolumeId(
        volumeId: string,
        data: { name: string; driver: string }
    ): Promise<DockerVolumeEntity> {
        const document = await DockerVolume.findOneAndUpdate(
            { volumeId },
            { name: data.name, driver: data.driver },
            { upsert: true, new: true }
        );
        return this.toEntity(document);
    }

    async findById(id: string): Promise<DockerVolumeEntity | null> {
        const document = await DockerVolume.findById(id);
        if (!document) {
            return null;
        }
        return this.toEntity(document);
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await DockerVolume.findByIdAndDelete(id);
        return result !== null;
    }

    private toEntity(document: IDockerVolume): DockerVolumeEntity {
        return {
            id: document._id.toString(),
            volumeId: document.volumeId,
            name: document.name,
            driver: document.driver,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt
        };
    }
}
