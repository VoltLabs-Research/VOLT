export interface DockerVolumeEntity {
    _id: string;
    volumeId: string;
    name: string;
    driver: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IDockerVolumeRepository {
    findOrCreateByVolumeId(
        volumeId: string,
        data: { name: string; driver: string }
    ): Promise<DockerVolumeEntity>;

    findById(_id: string): Promise<DockerVolumeEntity | null>;

    deleteById(_id: string): Promise<boolean>;
}
