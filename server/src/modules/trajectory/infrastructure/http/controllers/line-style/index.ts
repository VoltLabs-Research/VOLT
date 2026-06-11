import { createController, createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { CreateLineStyledModelUseCase } from '@modules/trajectory/application/use-cases/line-style/CreateLineStyledModelUseCase';
import { GetLineStyledModelStreamUseCase } from '@modules/trajectory/application/use-cases/line-style/GetLineStyledModelStreamUseCase';
import { GetLineModelRangesStreamUseCase } from '@modules/trajectory/application/use-cases/line-style/GetLineModelRangesStreamUseCase';
import { GetLineEntityPropertiesUseCase } from '@modules/trajectory/application/use-cases/line-style/GetLineEntityPropertiesUseCase';

const CreateLineStyledModelController = createController(CreateLineStyledModelUseCase);
const GetLineStyledModelController = createStreamController(GetLineStyledModelStreamUseCase);
const GetLineModelRangesController = createStreamController(GetLineModelRangesStreamUseCase);
const GetLineEntityPropertiesController = createController(GetLineEntityPropertiesUseCase);

export default {
    create: new CreateLineStyledModelController(),
    get: new GetLineStyledModelController(),
    getRanges: new GetLineModelRangesController(),
    getEntityProperties: new GetLineEntityPropertiesController()
};
