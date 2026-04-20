import { STATIC_ROOT } from '@core/config/paths';
import { ErrorCodes } from '@core/constants/error-codes';
import { DownloadSampleSimulationsInputDTO, DownloadSampleSimulationsOutputDTO } from '@modules/trajectory/application/dtos/trajectory/DownloadSampleSimulationsDTO';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';

import { injectable } from 'tsyringe';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';

import type { IUseCase } from '@shared/application/IUseCase';

const SAMPLES_PATH = path.join(STATIC_ROOT, 'default/simulations');

@injectable()
export default class DownloadSampleSimulationsUseCase implements IUseCase<DownloadSampleSimulationsInputDTO, DownloadSampleSimulationsOutputDTO, ApplicationError> {
    async execute(input: DownloadSampleSimulationsInputDTO): Promise<Result<DownloadSampleSimulationsOutputDTO, ApplicationError>> {
        const { filename } = input;

        if (!filename || !filename.endsWith('.zip')) {
            return Result.fail(new ApplicationError(ErrorCodes.VALIDATION_INVALID_INPUT, 'Invalid filename', 400));
        }

        const filePath = path.join(SAMPLES_PATH, filename);

        try {
            await access(filePath);
        } catch {
            return Result.fail(new ApplicationError(ErrorCodes.FILE_NOT_FOUND, 'Sample not found', 404));
        }

        const stream = createReadStream(filePath);
        return Result.ok({ stream, filename });
    }
};
