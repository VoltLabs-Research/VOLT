import { GetContainerByIdInputDTO, GetContainerByIdOutputDTO } from '@modules/container/application/dtos/GetContainerByIdDTO';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetContainerByIdUseCase implements IUseCase<GetContainerByIdInputDTO, GetContainerByIdOutputDTO> {
    constructor(
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService
    ) {}

    async execute(input: GetContainerByIdInputDTO): Promise<Result<GetContainerByIdOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);
        return Result.ok({ container });
    }
};
