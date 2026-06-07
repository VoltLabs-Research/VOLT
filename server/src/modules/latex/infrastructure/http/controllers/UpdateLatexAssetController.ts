import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateLatexAssetUseCase } from '@modules/latex/application/use-cases/UpdateLatexAssetUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(UpdateLatexAssetUseCase, {
    statusCode: HttpStatus.OK
});
