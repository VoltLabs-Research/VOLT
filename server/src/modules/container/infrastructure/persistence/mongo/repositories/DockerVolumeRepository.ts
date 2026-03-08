import { DockerVolumeEntity, DockerVolumeData, IDockerVolumeRepository } from '@modules/container/domain/port/IDockerVolumeRepository';
import { DockerVolume, IDockerVolume } from '@modules/container/infrastructure/persistence/mongo/models/DockerVolumeModel';
import { injectable } from 'tsyringe';

@injectable()
export class DockerVolumeRepository implements IDockerVolumeRepository {
    async findOrCreateByVolumeId(
        volumeId: string,
        data: DockerVolumeData
    ): Promise<DockerVolumeEntity> {
        const document = await DockerVolume.findOneAndUpdate(
            { volumeId },
            { name: data.name, driver: data.driver },
            { upsert: true, new: true }
        );
        return this.toEntity(document);
    }

    async findById(_id: string): Promise<DockerVolumeEntity | null> {
        const document = await DockerVolume.findById(_id);
        if (!document) {
            return null;
        }
        return this.toEntity(document);
    }

    async deleteById(_id: string): Promise<boolean> {
        const result = await DockerVolume.findByIdAndDelete(_id);
        return result !== null;
    }

    private toEntity(document: IDockerVolume): DockerVolumeEntity {
        return {
            _id: document._id.toString(),
            volumeId: document.volumeId,
            name: document.name,
            driver: document.driver,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt
        };
    }
};
