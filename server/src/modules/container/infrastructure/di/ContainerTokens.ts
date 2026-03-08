interface ContainerTokens {
    readonly ContainerRepository: symbol;
    readonly DockerNetworkRepository: symbol;
    readonly DockerVolumeRepository: symbol;
    readonly ContainerService: symbol;
    readonly TerminalService: symbol;
    readonly ContainerSocketModule: symbol;
};

export const CONTAINER_TOKENS: ContainerTokens = {
    ContainerRepository: Symbol.for('ContainerRepository'),
    DockerNetworkRepository: Symbol.for('DockerNetworkRepository'),
    DockerVolumeRepository: Symbol.for('DockerVolumeRepository'),
    ContainerService: Symbol.for('ContainerService'),
    TerminalService: Symbol.for('TerminalService'),
    ContainerSocketModule: Symbol.for('ContainerSocketModule')
};
