import { injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import path from 'node:path';
import fs from 'node:fs';
import { STATIC_ROOT } from '@core/config/paths';
import type { ReadStream } from 'node:fs';

const SAMPLES_PATH = path.join(STATIC_ROOT, 'default/simulations');

export interface DownloadSampleSimulationsInput {
    filename?: string;
}

export interface DownloadSampleSimulationsOutput {
    stream: ReadStream;
    filename: string;
}

@injectable()
export default class DownloadSampleSimulationsUseCase implements IUseCase<DownloadSampleSimulationsInput, DownloadSampleSimulationsOutput, ApplicationError> {
    async execute(input: DownloadSampleSimulationsInput): Promise<Result<DownloadSampleSimulationsOutput, ApplicationError>> {
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
