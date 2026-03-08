export interface DockerNetworkEntity {
    _id: string;
    networkId: string;
    name: string;
    driver: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IDockerNetworkRepository {
    findOrCreateByNetworkId(
        networkId: string,
        data: { name: string; driver: string }
    ): Promise<DockerNetworkEntity>;

    findById(_id: string): Promise<DockerNetworkEntity | null>;

    deleteById(_id: string): Promise<boolean>;
}
