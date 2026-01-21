import { container } from 'tsyringe';
import GetParticleFilterPropertiesController from './GetParticleFilterPropertiesController';
import PreviewParticleFilterController from './PreviewParticleFilterController';
import ApplyParticleFilterActionController from './ApplyParticleFilterActionController';
import GetFilteredModelController from './GetFilteredModelController';

const getProperties = container.resolve(GetParticleFilterPropertiesController);
const preview = container.resolve(PreviewParticleFilterController);
const applyAction = container.resolve(ApplyParticleFilterActionController);
const get = container.resolve(GetFilteredModelController);

export default { getProperties, preview, applyAction, get };
