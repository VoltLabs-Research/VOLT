import { createController, createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { CreateDislocationStyledModelUseCase } from '@modules/trajectory/application/use-cases/dislocation-style/CreateDislocationStyledModelUseCase';
import { GetDislocationStyledModelStreamUseCase } from '@modules/trajectory/application/use-cases/dislocation-style/GetDislocationStyledModelStreamUseCase';

const CreateDislocationStyledModelController = createController(CreateDislocationStyledModelUseCase);
const GetDislocationStyledModelController = createStreamController(GetDislocationStyledModelStreamUseCase);

export default {
    create: new CreateDislocationStyledModelController(),
    get: new GetDislocationStyledModelController()
};
