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
    CreateContainerXrdpSessionUseCase,
    DeleteContainerUseCase,
    GetContainerByIdUseCase,
    GetContainerFilesUseCase,
    GetContainerProcessesUseCase,
    GetContainerStatsUseCase,
    ListContainersUseCase,
    ReadContainerFileUseCase,
    UpdateContainerUseCase
} from '@modules/container/application/use-cases';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import { DockerNetworkRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/DockerNetworkRepository';
import { DockerVolumeRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/DockerVolumeRepository';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import {
    ContainerOwnershipService,
    ContainerXrdpGatewayService,
    DaemonContainerRuntimeService,
    DockerContainerService,
    TeamClusterSelectionService,
    TerminalService
} from '@modules/container/infrastructure/services';
import { ContainerSocketModule } from '@modules/container/socket';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import type { ClassProvider } from 'tsyringe';
import { container, Lifecycle } from 'tsyringe';

const CONTAINER_AI_TOOL_CLASSES: ClassProvider<unknown>[] = [
    { useClass: CreateContainerAITool },
    { useClass: DeleteContainerAITool },
    { useClass: GetContainerByIdAITool },
    { useClass: GetContainerProcessesAITool },
    { useClass: GetContainerStatsAITool },
    { useClass: ListContainerFilesAITool },
    { useClass: ListContainersAITool },
    { useClass: ReadContainerFileAITool },
    { useClass: UpdateContainerAITool }
];

export const registerContainerDependencies = (): void => {
    container.register(CONTAINER_TOKENS.ContainerRepository, { useClass: ContainerRepository });
    container.register(CONTAINER_TOKENS.DockerNetworkRepository, { useClass: DockerNetworkRepository });
    container.register(CONTAINER_TOKENS.DockerVolumeRepository, { useClass: DockerVolumeRepository });
    container.register(CONTAINER_TOKENS.ContainerService, { useClass: DockerContainerService });
    container.register(CONTAINER_TOKENS.ContainerRuntimeService, { useClass: DaemonContainerRuntimeService });
    container.register(CONTAINER_TOKENS.TerminalService, { useClass: TerminalService });
    container.register(ContainerOwnershipService, { useClass: ContainerOwnershipService });
    container.registerSingleton(ContainerXrdpGatewayService, ContainerXrdpGatewayService);
    container.register(TeamClusterSelectionService, { useClass: TeamClusterSelectionService });

    container.register(CreateContainerUseCase, { useClass: CreateContainerUseCase });
    container.register(CreateContainerXrdpSessionUseCase, { useClass: CreateContainerXrdpSessionUseCase });
    container.register(UpdateContainerUseCase, { useClass: UpdateContainerUseCase });
    container.register(DeleteContainerUseCase, { useClass: DeleteContainerUseCase });
    container.register(ListContainersUseCase, { useClass: ListContainersUseCase });
    container.register(GetContainerStatsUseCase, { useClass: GetContainerStatsUseCase });
    container.register(GetContainerFilesUseCase, { useClass: GetContainerFilesUseCase });
    container.register(ReadContainerFileUseCase, { useClass: ReadContainerFileUseCase });
    container.register(GetContainerProcessesUseCase, { useClass: GetContainerProcessesUseCase });
    container.register(GetContainerByIdUseCase, { useClass: GetContainerByIdUseCase });

    container.registerSingleton(CONTAINER_TOKENS.ContainerSocketModule, ContainerSocketModule);
    container.register(SOCKET_TOKENS.SocketModule, { useToken: CONTAINER_TOKENS.ContainerSocketModule });

    for (const toolClassProvider of CONTAINER_AI_TOOL_CLASSES) {
        container.register(AI_TOKENS.AITool, toolClassProvider, {
            lifecycle: Lifecycle.Singleton
        });
    }
};
