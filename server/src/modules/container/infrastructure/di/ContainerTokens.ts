interface ContainerTokens {
    readonly ContainerRepository: symbol;
    readonly ContainerFolderRepository: symbol;
    readonly DockerNetworkRepository: symbol;
    readonly DockerVolumeRepository: symbol;
    readonly ContainerService: symbol;
    readonly ContainerRuntimeService: symbol;
    readonly TerminalService: symbol;
    readonly ContainerSocketModule: symbol;
    readonly ContainerAccessiblePortResolver: symbol;
};

export const CONTAINER_TOKENS: ContainerTokens = {
    ContainerRepository: Symbol.for('ContainerRepository'),
    ContainerFolderRepository: Symbol.for('ContainerFolderRepository'),
    DockerNetworkRepository: Symbol.for('DockerNetworkRepository'),
    DockerVolumeRepository: Symbol.for('DockerVolumeRepository'),
    ContainerService: Symbol.for('ContainerService'),
    ContainerRuntimeService: Symbol.for('ContainerRuntimeService'),
    TerminalService: Symbol.for('TerminalService'),
    ContainerSocketModule: Symbol.for('ContainerSocketModule'),
    ContainerAccessiblePortResolver: Symbol.for('ContainerAccessiblePortResolver')
};
