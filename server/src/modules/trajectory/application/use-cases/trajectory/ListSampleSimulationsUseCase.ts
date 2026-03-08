import { STATIC_ROOT } from '@core/config/paths';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable } from 'tsyringe';
import fs from 'node:fs';
import path from 'node:path';

import type { IUseCase } from '@shared/application/IUseCase';

const SAMPLES_PATH = path.join(STATIC_ROOT, 'default/simulations');

@injectable()
export default class ListSampleSimulationsUseCase implements IUseCase<void, string[], ApplicationError> {
    async execute(): Promise<Result<string[], ApplicationError>> {
        if (!fs.existsSync(SAMPLES_PATH)) {
            return Result.fail(new ApplicationError(ErrorCodes.FILE_NOT_FOUND, 'Sample simulations not found', 404));
        }

        const files = fs.readdirSync(SAMPLES_PATH).filter((f) => f.endsWith('.zip'));
        return Result.ok(files);
    }
};
