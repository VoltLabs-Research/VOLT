import { createController } from '@shared/infrastructure/http/controllers/createController';
import { ListLatexAssetsUseCase } from '@modules/latex/application/use-cases/ListLatexAssetsUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(ListLatexAssetsUseCase, {
    statusCode: HttpStatus.OK
});
