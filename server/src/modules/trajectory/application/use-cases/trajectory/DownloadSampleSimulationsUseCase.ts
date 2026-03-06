import { injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import path from 'node:path';
import fs from 'node:fs';
import { STATIC_ROOT } from '@core/config/paths';
import { DownloadSampleSimulationsInputDTO, DownloadSampleSimulationsOutputDTO } from '@modules/trajectory/application/dtos/trajectory/DownloadSampleSimulationsDTO';

const SAMPLES_PATH = path.join(STATIC_ROOT, 'default/simulations');

@injectable()
export default class DownloadSampleSimulationsUseCase implements IUseCase<DownloadSampleSimulationsInputDTO, DownloadSampleSimulationsOutputDTO, ApplicationError> {
    async execute(input: DownloadSampleSimulationsInputDTO): Promise<Result<DownloadSampleSimulationsOutputDTO, ApplicationError>> {
        const { filename } = input;
        
        if (!filename || !filename.endsWith('.zip')) {
            return Result.fail(new ApplicationError('SAMPLES::INVALID_NAME', 'Invalid filename', 400));
        }

        const filePath = path.join(SAMPLES_PATH, filename);

        if (!fs.existsSync(filePath)) {
            return Result.fail(new ApplicationError('SAMPLES::NOT_FOUND', 'Sample not found', 404));
        }

        const stream = fs.createReadStream(filePath);
        return Result.ok({ stream, filename });
    }
}
