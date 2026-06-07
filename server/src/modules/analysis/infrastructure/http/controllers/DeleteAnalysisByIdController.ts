import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import DeleteAnalysisByIdUseCase from '@modules/analysis/application/use-cases/DeleteAnalysisByIdUseCase';

export default createController(DeleteAnalysisByIdUseCase, {
    statusCode: HttpStatus.NoContent,
});
