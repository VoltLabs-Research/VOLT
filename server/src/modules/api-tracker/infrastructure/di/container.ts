import { container } from 'tsyringe';
import { ApiTrackerModel } from '@modules/api-tracker/infrastructure/persistence/mongo/models/ApiTrackerModel';
import { ApiTrackerRepository } from '@modules/api-tracker/infrastructure/persistence/mongo/repositories/ApiTrackerRepository';

export const registerApiTrackerDependencies = (): void => {
    container.register('ApiTrackerModel', { useValue: ApiTrackerModel });
    container.register('IApiTrackerRepository', { useClass: ApiTrackerRepository });
};
