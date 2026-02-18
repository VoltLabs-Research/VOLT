import type { Response } from 'express';
import type { Readable } from 'node:stream';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { IUseCase } from '@shared/application/IUseCase';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import logger from '@shared/infrastructure/logger';

export abstract class BaseStreamController<TUseCase extends IUseCase<any, Readable, any>> extends BaseController<TUseCase> {
    protected getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'model/gltf-binary',
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

            const headers = this.getHeaders();
            for (const [name, value] of Object.entries(headers)) {
                res.setHeader(name, value);
            }

            result.value.pipe(res);
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
