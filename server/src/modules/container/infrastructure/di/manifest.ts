import { CreateContainerAITool } from '@modules/container/application/ai-tools/CreateContainerAITool';
import { DeleteContainerAITool } from '@modules/container/application/ai-tools/DeleteContainerAITool';
import { GetContainerByIdAITool } from '@modules/container/application/ai-tools/GetContainerByIdAITool';
import { GetContainerProcessesAITool } from '@modules/container/application/ai-tools/GetContainerProcessesAITool';
import { GetContainerStatsAITool } from '@modules/container/application/ai-tools/GetContainerStatsAITool';
import { ListContainerFilesAITool } from '@modules/container/application/ai-tools/ListContainerFilesAITool';
import { ListContainersAITool } from '@modules/container/application/ai-tools/ListContainersAITool';
import { ReadContainerFileAITool } from '@modules/container/application/ai-tools/ReadContainerFileAITool';
import { UpdateContainerAITool } from '@modules/container/application/ai-tools/UpdateContainerAITool';
import {
    CreateContainerUseCase,
    CreateContainerFolderUseCase,
    DeleteContainerUseCase,
    DeleteContainerFolderUseCase,
    GetContainerByIdUseCase,
    GetContainerFolderUseCase,
    GetContainerFilesUseCase,
    GetContainerProcessesUseCase,
    GetContainerStatsUseCase,
    ListContainerFoldersUseCase,
    ListContainersUseCase,
    MoveContainerUseCase,
    ReadContainerFileUseCase,
    UpdateContainerFolderUseCase,
    UpdateContainerUseCase
} from '@modules/container/application/use-cases';
import { ContainerFolderRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerFolderRepository';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import {
    ClusterRoleAwareSelectionService,
    ContainerAccessiblePortResolver,
    ContainerDeploymentProgressService,
    ContainerOwnershipService,
    ContainerPortProxyRelayService,
    DaemonContainerRuntimeService,
    TeamClusterSelectionService,
    TerminalService
} from '@modules/container/infrastructure/services';
import { CreateContainerPortProxySessionUseCase } from '@modules/container/application/use-cases/CreateContainerPortProxySessionUseCase';
import { ContainerPortProxyAccessTokenService } from '@modules/container/infrastructure/utilities/container-port-proxy';
import { ContainerSocketModule } from '@modules/container/socket';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { createClassBindings } from '@shared/infrastructure/di/ModuleManifest';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';
import { Lifecycle } from 'tsyringe';

const CONTAINER_AI_TOOLS = [
    CreateContainerAITool,
    DeleteContainerAITool,
    GetContainerByIdAITool,
    GetContainerProcessesAITool,
    GetContainerStatsAITool,
    ListContainerFilesAITool,
    ListContainersAITool,
    ReadContainerFileAITool,
    UpdateContainerAITool
];

export const containerDIManifest: ModuleManifest = {
    name: 'container',
    singletons: [
        ContainerDeploymentProgressService,
        ContainerPortProxyRelayService,
        ContainerPortProxyAccessTokenService,
        [CONTAINER_TOKENS.ContainerSocketModule, ContainerSocketModule]
    ],
    bindings: [
        [CONTAINER_TOKENS.ContainerRepository, ContainerRepository],
        [CONTAINER_TOKENS.ContainerFolderRepository, ContainerFolderRepository],
        [CONTAINER_TOKENS.ContainerRuntimeService, DaemonContainerRuntimeService],
        [CONTAINER_TOKENS.TerminalService, TerminalService],
        [CONTAINER_TOKENS.ContainerAccessiblePortResolver, ContainerAccessiblePortResolver],
        ContainerOwnershipService,
        ClusterRoleAwareSelectionService,
        TeamClusterSelectionService,
        CreateContainerUseCase,
        CreateContainerFolderUseCase,
        UpdateContainerUseCase,
        UpdateContainerFolderUseCase,
        DeleteContainerUseCase,
        DeleteContainerFolderUseCase,
        ListContainersUseCase,
        ListContainerFoldersUseCase,
        GetContainerStatsUseCase,
        GetContainerFilesUseCase,
        ReadContainerFileUseCase,
        GetContainerProcessesUseCase,
        GetContainerByIdUseCase,
        CreateContainerPortProxySessionUseCase,
        GetContainerFolderUseCase,
        MoveContainerUseCase,
        ...createClassBindings(AI_TOKENS.AITool, CONTAINER_AI_TOOLS, Lifecycle.Singleton)
    ],
    aliases: [
        [SOCKET_TOKENS.SocketModule, CONTAINER_TOKENS.ContainerSocketModule]
    ]
};
