import { container } from 'tsyringe';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import { DockerNetworkRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/DockerNetworkRepository';
import { DockerVolumeRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/DockerVolumeRepository';
import { DockerContainerService } from '@modules/container/infrastructure/services/DockerContainerService';
import { TerminalService } from '@modules/container/infrastructure/services/TerminalService';
import { ContainerSocketModule } from '@modules/container/infrastructure/socket/ContainerSocketModule';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';

import { CreateContainerUseCase } from '@modules/container/application/use-cases/CreateContainerUseCase';
import { UpdateContainerUseCase } from '@modules/container/application/use-cases/UpdateContainerUseCase';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';
import { ListContainersUseCase } from '@modules/container/application/use-cases/ListContainersUseCase';
import { GetContainerStatsUseCase } from '@modules/container/application/use-cases/GetContainerStatsUseCase';
import { GetContainerFilesUseCase } from '@modules/container/application/use-cases/GetContainerFilesUseCase';
import { ReadContainerFileUseCase } from '@modules/container/application/use-cases/ReadContainerFileUseCase';
import { GetContainerProcessesUseCase } from '@modules/container/application/use-cases/GetContainerProcessesUseCase';
import { GetContainerByIdUseCase } from '@modules/container/application/use-cases/GetContainerByIdUseCase';
import { ContainerOwnershipService } from '@modules/container/application/services/ContainerOwnershipService';

import * as containerAiTools from '@modules/container/application/ai-tools';

export const registerContainerDependencies = (): void => {
    container.register(CONTAINER_TOKENS.ContainerRepository, { useClass: ContainerRepository });
    container.register(CONTAINER_TOKENS.DockerNetworkRepository, { useClass: DockerNetworkRepository });
    container.register(CONTAINER_TOKENS.DockerVolumeRepository, { useClass: DockerVolumeRepository });
    container.register(CONTAINER_TOKENS.ContainerService, { useClass: DockerContainerService });
    container.register(CONTAINER_TOKENS.TerminalService, { useClass: TerminalService });
    container.register(ContainerOwnershipService, { useClass: ContainerOwnershipService });

    container.register(CreateContainerUseCase, { useClass: CreateContainerUseCase });
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

    for (const ToolClass of Object.values(containerAiTools)) {
        container.registerSingleton(AI_TOKENS.AITool, ToolClass as any);
    }
};
