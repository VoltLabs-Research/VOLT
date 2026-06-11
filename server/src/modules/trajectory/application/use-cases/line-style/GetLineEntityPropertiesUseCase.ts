import {
    GetLineEntityPropertiesInputDTO,
    GetLineEntityPropertiesOutputDTO
} from '@modules/trajectory/application/dtos/line-style';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { IAtomPropertiesService } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

// Line entities share the per-id property pipeline with atoms: the exposure's
// property table is keyed by entity id, so one store lookup serves the
// inspector for any LineExporter exposure.
@Singleton()
export class GetLineEntityPropertiesUseCase implements IUseCase<GetLineEntityPropertiesInputDTO, GetLineEntityPropertiesOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.AtomPropertiesService)
        private readonly atomPropertiesService: IAtomPropertiesService
    ) { }

    async execute(input: GetLineEntityPropertiesInputDTO): Promise<Result<GetLineEntityPropertiesOutputDTO, ApplicationError>> {
        const entityId = Number(input.entityId);
        if (!Number.isInteger(entityId) || entityId < 0) {
            return Result.fail(ApplicationError.badRequest(
                'LINE_ENTITY_ID_INVALID',
                'The entity id must be a non-negative integer.'
            ));
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
            return Result.fail(ApplicationError.notFound(
                'LINE_ENTITY_NOT_FOUND',
                `No entity ${entityId} found for exposure "${input.exposureId}" at timestep ${input.timestep}`
            ));
        }

        return Result.ok({ entityId, properties });
    }
};
