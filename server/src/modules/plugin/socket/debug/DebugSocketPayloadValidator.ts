import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import type { DebugStartPayload } from './DebugSocketPayloads';

export const validateDebugStartPayload = (payload: DebugStartPayload): ApplicationError | null => {
    if (!payload.pluginId || !payload.trajectoryId) {
        return ApplicationError.badRequest(
            ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
            ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS
        );
    }

    if (typeof payload.timestep !== 'number' || !Number.isFinite(payload.timestep)) {
        return ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            ErrorCodes.VALIDATION_INVALID_INPUT
        );
    }

    return null;
};
