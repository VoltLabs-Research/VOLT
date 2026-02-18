import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { GetRasterMetadataUseCase } from '@modules/raster/application/use-cases/GetRasterMetadataUseCase';

@injectable()
export class GetRasterMetadataController extends BaseController<GetRasterMetadataUseCase> {
    constructor(
        @inject(GetRasterMetadataUseCase) useCase: GetRasterMetadataUseCase
    ){
        super(useCase);
    }

    protected override getParams(req: AuthenticatedRequest): string {
        return String(req.params.trajectoryId);
    }
}
