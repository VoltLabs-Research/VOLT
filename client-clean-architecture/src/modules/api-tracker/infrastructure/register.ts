import { registerApiTrackerDependencies } from '../application/registry';
import { apiTrackerRepository } from './repositories/ApiTrackerRepository';

export const registerApiTrackerInfrastructure = (): void => {
    registerApiTrackerDependencies({
        apiTrackerRepository
    });
};
