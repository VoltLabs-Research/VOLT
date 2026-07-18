import {
    GetLineEntityPropertiesInputDTO,
    GetLineEntityPropertiesOutputDTO
} from '@modules/trajectory/application/dtos/line-style';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { IAtomPropertiesService } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetLineEntityPropertiesUseCase implements IUseCase<GetLineEntityPropertiesInputDTO, GetLineEntityPropertiesOutputDTO> {
    constructor(
        @inject(TRAJECTORY_TOKENS.AtomPropertiesService)
        private readonly atomPropertiesService: IAtomPropertiesService
    ) { }

    async execute(input: GetLineEntityPropertiesInputDTO): Promise<GetLineEntityPropertiesOutputDTO> {
        const entityId = Number(input.entityId);
        if (!Number.isInteger(entityId) || entityId < 0) {
            throw ApplicationError.badRequest(
                'LINE_ENTITY_ID_INVALID',
                'The entity id must be a non-negative integer.'
            );
        }

        const index = await this.atomPropertiesService.buildPluginIndexForAtomIds(
            input.trajectoryId,
            input.analysisId,
            input.exposureId,
            input.timestep,
            new Set([entityId])
        );

        const properties = index?.get(entityId);
        if (!properties) {
            throw ApplicationError.notFound(
                'LINE_ENTITY_NOT_FOUND',
                `No entity ${entityId} found for exposure "${input.exposureId}" at timestep ${input.timestep}`
            );
        }

        return { entityId, properties };
    }
};
