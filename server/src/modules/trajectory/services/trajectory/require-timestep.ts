import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/errors/ApplicationError';

export const requireTimestep = (timestep: string): string => {
    const value = String(timestep ?? '').trim();
    if (!value || !Number.isFinite(Number(value))) {
        throw ApplicationError.badRequest(
            ErrorCodes.TRAJECTORY_INVALID_TIMESTEP,
            'The "timestep" query parameter is required and must be numeric.'
        );
    }

    return value;
};
