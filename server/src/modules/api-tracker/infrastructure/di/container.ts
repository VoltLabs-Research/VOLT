import { container } from 'tsyringe';
import { ApiTrackerModel } from '@modules/api-tracker/infrastructure/persistence/mongo/models/ApiTrackerModel';
import { ApiTrackerRepository } from '@modules/api-tracker/infrastructure/persistence/mongo/repositories/ApiTrackerRepository';
import { API_TRACKER_TOKENS } from '@modules/api-tracker/infrastructure/di/ApiTrackerTokens';

export const registerApiTrackerDependencies = (): void => {
    container.register(API_TRACKER_TOKENS.ApiTrackerModel, { useValue: ApiTrackerModel });
    container.register(API_TRACKER_TOKENS.ApiTrackerRepository, { useClass: ApiTrackerRepository });
};
