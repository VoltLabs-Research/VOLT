import { injectable } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';

const SAMPLES_PATH = path.join(__dirname, '../../../../../../..', 'static/default/simulations');

@injectable()
export default class DownloadSampleSimulationsController {
    public list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!fs.existsSync(SAMPLES_PATH)) {
                res.status(404).json({ status: 'error', message: 'Sample simulations not found' });
                return;
            }

            const files = fs.readdirSync(SAMPLES_PATH).filter((f) => f.endsWith('.zip'));
            res.json({ status: 'success', data: files });
        } catch (error) {
            next(error);
        }
    };

    public download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const filename = req.params.filename as string;

            if (!filename || !filename.endsWith('.zip')) {
                res.status(400).json({ status: 'error', message: 'Invalid filename' });
                return;
            }

            const filePath = path.join(SAMPLES_PATH, filename);

            if (!fs.existsSync(filePath)) {
                res.status(404).json({ status: 'error', message: 'Sample not found' });
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
