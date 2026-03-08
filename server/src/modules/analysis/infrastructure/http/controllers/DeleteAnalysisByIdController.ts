import { createController } from '@shared/infrastructure/http/controllers/createController';
import DeleteAnalysisByIdUseCase from '@modules/analysis/application/use-cases/DeleteAnalysisByIdUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { analysisValidation } from '@modules/analysis/infrastructure/http/validation/analysis-schemas';

export default createController(DeleteAnalysisByIdUseCase, {
    statusCode: HttpStatus.NoContent,
    validationSchema: analysisValidation.deleteById
});
