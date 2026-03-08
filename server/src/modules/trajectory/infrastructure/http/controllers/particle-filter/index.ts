import { createController, createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { GetParticleFilterPropertiesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterPropertiesUseCase';
import { PreviewParticleFilterUseCase } from '@modules/trajectory/application/use-cases/particle-filter/PreviewParticleFilterUseCase';
import { ApplyParticleFilterActionUseCase } from '@modules/trajectory/application/use-cases/particle-filter/ApplyParticleFilterActionUseCase';
import { GetFilteredModelStreamUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetFilteredModelStreamUseCase';
import { GetParticleFilterUniqueValuesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterUniqueValuesUseCase';

const GetParticleFilterPropertiesController = createController(GetParticleFilterPropertiesUseCase);
const PreviewParticleFilterController = createController(PreviewParticleFilterUseCase);
const ApplyParticleFilterActionController = createController(ApplyParticleFilterActionUseCase);
const GetFilteredModelController = createStreamController(GetFilteredModelStreamUseCase);
const GetUniqueValuesController = createController(GetParticleFilterUniqueValuesUseCase);

export default {
    getProperties: new GetParticleFilterPropertiesController(),
    preview: new PreviewParticleFilterController(),
    applyAction: new ApplyParticleFilterActionController(),
    get: new GetFilteredModelController(),
    getUniqueValues: new GetUniqueValuesController()
};
