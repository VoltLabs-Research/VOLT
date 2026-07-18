import { STATIC_ROOT } from '@core/config/paths';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';

import { injectable } from 'tsyringe';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { IUseCase } from '@shared/application/IUseCase';

const SAMPLES_PATH = path.join(STATIC_ROOT, 'default/simulations');

@injectable()
export default class ListSampleSimulationsUseCase implements IUseCase<void, string[]> {
    async execute(): Promise<string[]> {
        try {
            await fs.access(SAMPLES_PATH);
        } catch {
            throw new ApplicationError(ErrorCodes.FILE_NOT_FOUND, 'Sample simulations not found', 404);
        }

        const entries = await fs.readdir(SAMPLES_PATH);
        const files = entries.filter((f) => f.endsWith('.zip'));
        return files;
    }
};
