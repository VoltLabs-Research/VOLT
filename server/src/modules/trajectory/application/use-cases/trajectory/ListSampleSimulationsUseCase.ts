import { injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import path from 'node:path';
import fs from 'node:fs';
import { STATIC_ROOT } from '@core/config/paths';

const SAMPLES_PATH = path.join(STATIC_ROOT, 'default/simulations');

@injectable()
export default class ListSampleSimulationsUseCase implements IUseCase<void, string[], ApplicationError> {
    async execute(): Promise<Result<string[], ApplicationError>> {
        if (!fs.existsSync(SAMPLES_PATH)) {
            return Result.fail(new ApplicationError('SAMPLES::NOT_FOUND', 'Sample simulations not found', 404));
        }

        const files = fs.readdirSync(SAMPLES_PATH).filter((f) => f.endsWith('.zip'));
        return Result.ok(files);
    }
}
