import { injectable, inject } from 'tsyringe';
import { Response } from 'express';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetTrajectoryPreviewUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryPreviewUseCase';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class GetTrajectoryPreviewController extends BaseController<GetTrajectoryPreviewUseCase> {
    constructor(
        @inject(GetTrajectoryPreviewUseCase)
        useCase: GetTrajectoryPreviewUseCase
    ){
        super(useCase);
    }

    public override handle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const dto = this.getParams(req);
            const result = await this.useCase.execute(dto);

            if (!result.success) {
                return BaseResponse.error(res, result.error.message, result.error.statusCode, result.error.code);
            }

            const { base64, etag } = result.value;

            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('ETag', etag);
            return BaseResponse.success(res, base64);
        } catch (error) {
            logger.error(error);
            BaseResponse.error(res, 'Internal Server Error', HttpStatus.InternalServerError, 'Internal::Server::Error');
        }
    };
}
