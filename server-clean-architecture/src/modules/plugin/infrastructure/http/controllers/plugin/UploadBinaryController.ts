import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { UploadBinaryUseCase } from '../../../../application/use-cases/plugin/UploadBinaryUseCase';

@injectable()
export default class UploadBinaryController extends BaseController<UploadBinaryUseCase> {
    constructor(
        @inject(UploadBinaryUseCase) useCase: UploadBinaryUseCase
    ) {
        super(useCase);
    }
}
