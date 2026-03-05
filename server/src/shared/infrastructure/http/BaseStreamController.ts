import type { Response } from 'express';
import type { Readable } from 'node:stream';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { UseCaseInstance } from '@shared/application/IUseCase';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import logger from '@shared/infrastructure/logger';

interface StreamableOutput {
    stream: Readable;
}

export abstract class BaseStreamController<TUseCase extends UseCaseInstance> extends BaseController<TUseCase> {
    protected getHeaders(_resultValue: StreamableOutput): Record<string, string> {
        return {
            'Content-Type': 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000'
        };
    }

    public override handle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const dto = this.getParams(req);
            const result = await this.useCase.execute(dto);

            if (!result.success) {
                return BaseResponse.error(
                    res,
                    result.error.message,
                    result.error.statusCode,
                    result.error.code
                );
            }

            const output = result.value as StreamableOutput;
            const headers = this.getHeaders(output);
            for (const [name, value] of Object.entries(headers)) {
                res.setHeader(name, value);
            }

            output.stream.pipe(res);
        } catch (error) {
            logger.error(error);
            return BaseResponse.error(
                res,
                'Internal Server Error',
                HttpStatus.InternalServerError,
                'Internal::Server::Error'
            );
        }
    };
}
