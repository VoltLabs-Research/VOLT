import { injectable, inject } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { IStorageService } from '@shared/domain/ports/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { Readable } from 'node:stream';

export interface GetTrajectoryGLBInput {
    trajectoryId: string;
    timestep: string;
}

export interface GetTrajectoryGLBOutput {
    stream: Readable;
    size: number;
    objectName: string;
}

@injectable()
export default class GetTrajectoryGLBUseCase implements IUseCase<GetTrajectoryGLBInput, GetTrajectoryGLBOutput, ApplicationError> {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ){}

    async execute(input: GetTrajectoryGLBInput): Promise<Result<GetTrajectoryGLBOutput, ApplicationError>> {
        try {
            const { trajectoryId, timestep } = input;
            const objectName = `trajectory-${trajectoryId}/timestep-${timestep}.glb`;
            const [stat, stream] = await Promise.all([
                this.storageService.getStat(SYS_BUCKETS.MODELS, objectName), 
                this.storageService.getStream(SYS_BUCKETS.MODELS, objectName)
            ]);

            return Result.ok({ stream, size: stat.size, objectName });
        } catch (error: any) {
            return Result.fail(new ApplicationError('GLB::NOT_FOUND', 'GLB model not found', 404));
        }
    }
}
