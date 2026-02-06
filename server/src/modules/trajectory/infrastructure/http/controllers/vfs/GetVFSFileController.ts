import { injectable, inject } from 'tsyringe';
import { Response } from 'express';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetVFSFileUseCase } from '@modules/trajectory/application/use-cases/vfs/GetVFSFileUseCase';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';

@injectable()
export default class GetVFSFileController extends BaseController<GetVFSFileUseCase> {
    constructor(
        @inject(GetVFSFileUseCase) useCase: GetVFSFileUseCase
    ) {
        super(useCase);
    }

    public handle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const dto = this.getParams(req);
            const result = await this.useCase.execute(dto);

            if (!result.success) {
                return BaseResponse.error(
                    res,
                    result.error.message,
                    (result.error as any).statusCode || HttpStatus.InternalServerError
                );
            }

            res.setHeader('Content-Type', 'application/octet-stream');
            res.send(result.value);
        } catch (error) {
            console.error(error);
            return BaseResponse.error(res, 'Internal Server Error', HttpStatus.InternalServerError);
        }
    };
}
