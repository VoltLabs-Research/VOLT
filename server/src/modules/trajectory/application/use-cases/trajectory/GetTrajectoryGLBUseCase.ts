import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetTrajectoryGLBInputDTO, GetTrajectoryGLBOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryGLBDTO';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';

@injectable()
export default class GetTrajectoryGLBUseCase implements IUseCase<GetTrajectoryGLBInputDTO, GetTrajectoryGLBOutputDTO, ApplicationError> {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ){}

    async execute(input: GetTrajectoryGLBInputDTO): Promise<Result<GetTrajectoryGLBOutputDTO, ApplicationError>> {
        try {
            const { trajectoryId, timestep } = input;
            const objectName = `trajectory-${trajectoryId}/timestep-${timestep}.glb`;
            const [stat, stream] = await Promise.all([
                this.storageService.getStat(SYS_BUCKETS.MODELS, objectName),
                this.storageService.getStream(SYS_BUCKETS.MODELS, objectName)
            ]);

            return Result.ok({ stream, size: stat.size, objectName });
        } catch {
            return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'GLB model not found', 404));
        }
    }
};
