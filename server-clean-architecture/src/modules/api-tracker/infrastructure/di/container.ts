import { container } from 'tsyringe';
import { ApiTrackerModel } from '../persistence/mongo/models/ApiTrackerModel';
import { ApiTrackerRepository } from '../persistence/mongo/repositories/ApiTrackerRepository';

export const registerApiTrackerDependencies = (): void => {
    container.register('ApiTrackerModel', { useValue: ApiTrackerModel });
    container.register('IApiTrackerRepository', { useClass: ApiTrackerRepository });
};
