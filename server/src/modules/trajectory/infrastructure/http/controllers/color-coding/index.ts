import { createController, createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { GetColorCodingPropertiesUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingPropertiesUseCase';
import { GetColorCodingStatsUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingStatsUseCase';
import { CreateColoredModelUseCase } from '@modules/trajectory/application/use-cases/color-coding/CreateColoredModelUseCase';
import { GetColoredModelStreamUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColoredModelStreamUseCase';

const GetColorCodingPropertiesController = createController(GetColorCodingPropertiesUseCase);
const GetColorCodingStatsController = createController(GetColorCodingStatsUseCase);
const CreateColoredModelController = createController(CreateColoredModelUseCase);
const GetColoredModelController = createStreamController(GetColoredModelStreamUseCase);

export default {
    getProperties: new GetColorCodingPropertiesController(),
    getStats: new GetColorCodingStatsController(),
    create: new CreateColoredModelController(),
    get: new GetColoredModelController()
};
