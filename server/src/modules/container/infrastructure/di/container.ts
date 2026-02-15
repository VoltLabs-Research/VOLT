import { container } from 'tsyringe';
import { ContainerModel } from '@modules/container/infrastructure/persistence/mongo/models/ContainerModel';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import { DockerContainerService } from '@modules/container/infrastructure/services/DockerContainerService';
import { TerminalService } from '@modules/container/infrastructure/services/TerminalService';
import { ContainerSocketModule } from '@modules/container/infrastructure/socket/ContainerSocketModule';

import { CreateContainerUseCase } from '@modules/container/application/use-cases/CreateContainerUseCase';
import { UpdateContainerUseCase } from '@modules/container/application/use-cases/UpdateContainerUseCase';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';
import { ListContainersUseCase } from '@modules/container/application/use-cases/ListContainersUseCase';
import { GetContainerStatsUseCase } from '@modules/container/application/use-cases/GetContainerStatsUseCase';
import { GetContainerFilesUseCase } from '@modules/container/application/use-cases/GetContainerFilesUseCase';
import { ReadContainerFileUseCase } from '@modules/container/application/use-cases/ReadContainerFileUseCase';
import { GetContainerProcessesUseCase } from '@modules/container/application/use-cases/GetContainerProcessesUseCase';
import { GetContainerByIdUseCase } from '@modules/container/application/use-cases/GetContainerByIdUseCase';

export const registerContainerDependencies = (): void => {
    container.register('ContainerModel', { useValue: ContainerModel });
    container.register('IContainerRepository', { useClass: ContainerRepository });
    container.register('IContainerService', { useClass: DockerContainerService });
    container.register('ITerminalService', { useClass: TerminalService });

    // Services aliases if needed, or just UseCases relying on tokens

    // UseCases (registered by Class usually, or Token if injected by Interface, here strict class usage in controllers)
    container.register(CreateContainerUseCase, { useClass: CreateContainerUseCase });
    container.register(UpdateContainerUseCase, { useClass: UpdateContainerUseCase });
    container.register(DeleteContainerUseCase, { useClass: DeleteContainerUseCase });
    container.register(ListContainersUseCase, { useClass: ListContainersUseCase });
    container.register(GetContainerStatsUseCase, { useClass: GetContainerStatsUseCase });
    container.register(GetContainerFilesUseCase, { useClass: GetContainerFilesUseCase });
    container.register(ReadContainerFileUseCase, { useClass: ReadContainerFileUseCase });
    container.register(GetContainerProcessesUseCase, { useClass: GetContainerProcessesUseCase });
    container.register(GetContainerByIdUseCase, { useClass: GetContainerByIdUseCase });

    // Register Socket Module
    container.register('SocketModule', { useClass: ContainerSocketModule });
};
