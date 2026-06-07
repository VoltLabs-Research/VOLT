import { createController } from '@shared/infrastructure/http/controllers/createController';
import { ListLatexFilesUseCase } from '@modules/latex/application/use-cases/ListLatexFilesUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(ListLatexFilesUseCase, {
    statusCode: HttpStatus.OK
});
