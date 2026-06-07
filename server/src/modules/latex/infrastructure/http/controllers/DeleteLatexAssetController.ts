import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteLatexAssetUseCase } from '@modules/latex/application/use-cases/DeleteLatexAssetUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(DeleteLatexAssetUseCase, {
    statusCode: HttpStatus.NoContent
});
