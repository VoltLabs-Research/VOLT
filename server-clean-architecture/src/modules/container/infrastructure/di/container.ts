import { container } from 'tsyringe';
import { ContainerModel } from '../persistence/mongo/models/ContainerModel';
import { ContainerRepository } from '../persistence/mongo/repositories/ContainerRepository';
import { DockerContainerService } from '../services/DockerContainerService';
import { TerminalService } from '../services/TerminalService';
import { ContainerSocketModule } from '../socket/ContainerSocketModule';

import { CreateContainerUseCase } from '../../application/use-cases/CreateContainerUseCase';
import { UpdateContainerUseCase } from '../../application/use-cases/UpdateContainerUseCase';
import { DeleteContainerUseCase } from '../../application/use-cases/DeleteContainerUseCase';
import { ListContainersUseCase } from '../../application/use-cases/ListContainersUseCase';
import { GetContainerStatsUseCase } from '../../application/use-cases/GetContainerStatsUseCase';
import { GetContainerFilesUseCase } from '../../application/use-cases/GetContainerFilesUseCase';
import { ReadContainerFileUseCase } from '../../application/use-cases/ReadContainerFileUseCase';
import { GetContainerProcessesUseCase } from '../../application/use-cases/GetContainerProcessesUseCase';
import { GetContainerByIdUseCase } from '../../application/use-cases/GetContainerByIdUseCase';

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
