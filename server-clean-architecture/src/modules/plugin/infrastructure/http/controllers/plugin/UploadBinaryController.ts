import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { UploadBinaryUseCase } from '@modules/plugin/application/use-cases/plugin/UploadBinaryUseCase';

@injectable()
export default class UploadBinaryController extends BaseController<UploadBinaryUseCase> {
    constructor(
        @inject(UploadBinaryUseCase) useCase: UploadBinaryUseCase
    ) {
        super(useCase);
    }
}
