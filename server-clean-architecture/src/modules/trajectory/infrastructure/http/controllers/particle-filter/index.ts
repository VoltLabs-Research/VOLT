import { container } from 'tsyringe';
import GetParticleFilterPropertiesController from './GetParticleFilterPropertiesController';
import PreviewParticleFilterController from './PreviewParticleFilterController';
import ApplyParticleFilterActionController from './ApplyParticleFilterActionController';
import GetFilteredModelController from './GetFilteredModelController';
import GetUniqueValuesController from './GetUniqueValuesController';

const getProperties = container.resolve(GetParticleFilterPropertiesController);
const preview = container.resolve(PreviewParticleFilterController);
const applyAction = container.resolve(ApplyParticleFilterActionController);
const get = container.resolve(GetFilteredModelController);
const getUniqueValues = container.resolve(GetUniqueValuesController);

export default { getProperties, preview, applyAction, get, getUniqueValues };
