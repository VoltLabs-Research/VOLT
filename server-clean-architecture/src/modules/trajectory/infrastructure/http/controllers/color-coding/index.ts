import { container } from 'tsyringe';
import GetColorCodingPropertiesController from './GetColorCodingPropertiesController';
import GetColorCodingStatsController from './GetColorCodingStatsController';
import CreateColoredModelController from './CreateColoredModelController';
import GetColoredModelController from './GetColoredModelController';

const getProperties = container.resolve(GetColorCodingPropertiesController);
const getStats = container.resolve(GetColorCodingStatsController);
const create = container.resolve(CreateColoredModelController);
const get = container.resolve(GetColoredModelController);

export default { getProperties, getStats, create, get };
