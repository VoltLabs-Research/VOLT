export interface DockerNetworkEntity {
    id: string;
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

    findById(id: string): Promise<DockerNetworkEntity | null>;

    deleteById(id: string): Promise<boolean>;
}
