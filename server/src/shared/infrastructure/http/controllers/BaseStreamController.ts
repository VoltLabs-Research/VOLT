import type { Response } from 'express';
import type { Readable } from 'node:stream';
import type {
    IUseCase,
    UseCaseOutput
} from '@shared/application/IUseCase';
import { BaseController } from '@shared/infrastructure/http/controllers/BaseController';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';

export interface StreamableOutput {
    stream: Readable;
}

export abstract class BaseStreamController<
    TUseCase extends IUseCase<unknown, StreamableOutput, unknown>
> extends BaseController<TUseCase> {
    protected async prepareOutput(_resultValue: UseCaseOutput<TUseCase>): Promise<void> {
        return;
    }

    protected getHeaders(_resultValue: UseCaseOutput<TUseCase>): Record<string, string> {
        return {
            'Content-Type': 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000'
        };
    }

    protected override async handleSuccess(res: Response, output: UseCaseOutput<TUseCase>): Promise<void> {
        await this.prepareOutput(output);

        const headers = this.getHeaders(output);
        for (const [name, value] of Object.entries(headers)) {
            res.setHeader(name, value);
        }

        res.on('close', () => {
            output.stream.destroy();
        });

        output.stream.on('error', (error) => {
            logger.error(error);

            if (!res.headersSent) {
                BaseResponse.fromError(res, error);
                return;
            }

            res.destroy(error instanceof Error ? error : undefined);
        });

        output.stream.pipe(res);
    }
}
