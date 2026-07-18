import { CONTAINER_CONTRACT_TOKENS } from '@shared/contracts/tokens/ContainerTokens';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';

export const CONTAINER_TOKENS = Object.freeze({
    ContainerService: Symbol.for('ContainerService'),
    ContainerRepository: CONTAINER_CONTRACT_TOKENS.ContainerRepository,
    ContainerFolderRepository: Symbol.for('ContainerFolderRepository'),
    TeamClusterSelectionService: CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService,
    ContainerOwnershipService: Symbol.for('ContainerOwnershipService'),
    ContainerRuntimeService: Symbol.for('ContainerRuntimeService'),
    ContainerAccessiblePortResolver: Symbol.for('ContainerAccessiblePortResolver'),
    ContainerPortProxyRelayService: Symbol.for('ContainerPortProxyRelayService'),
    ContainerPublicPortAllocator: Symbol.for('ContainerPublicPortAllocator')
});
