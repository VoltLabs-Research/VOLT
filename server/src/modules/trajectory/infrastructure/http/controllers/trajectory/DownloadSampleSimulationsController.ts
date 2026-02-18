import { injectable } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { STATIC_ROOT } from '@core/config/paths';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';

const SAMPLES_PATH = path.join(STATIC_ROOT, 'default/simulations');

@injectable()
export default class DownloadSampleSimulationsController {
    public list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!fs.existsSync(SAMPLES_PATH)) {
                BaseResponse.error(res, 'Sample simulations not found', HttpStatus.NotFound);
                return;
            }

            const files = fs.readdirSync(SAMPLES_PATH).filter((f) => f.endsWith('.zip'));
            BaseResponse.success(res, files);
        } catch (error) {
            next(error);
        }
    };

    public download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const filename = req.params.filename as string;

            if (!filename || !filename.endsWith('.zip')) {
                BaseResponse.error(res, 'Invalid filename', 400);
                return;
            }

            const filePath = path.join(SAMPLES_PATH, filename);

            if (!fs.existsSync(filePath)) {
                BaseResponse.error(res, 'Sample not found', HttpStatus.NotFound);
                return;
            }

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
        } catch (error) {
            next(error);
        }
    };
}
