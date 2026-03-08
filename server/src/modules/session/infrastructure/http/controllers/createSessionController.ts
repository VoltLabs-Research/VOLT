import type { InjectionToken } from 'tsyringe';
import { z } from 'zod/v4';
import type { UseCaseInstance } from '@shared/application/IUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

type SessionValidationSchema = Partial<Record<'body' | 'query' | 'params' | 'request', z.ZodType<unknown>>>;

interface ControllerOptions {
    statusCode?: HttpStatus;
    validationSchema?: SessionValidationSchema;
}

const getRequestContext = (request: AuthenticatedRequest) => {
    return {
        userId: request.userId,
        token: request.token,
        sessionId: request.sessionId
    };
};

export const createSessionController = <TUseCase extends UseCaseInstance>(
    useCaseToken: InjectionToken<TUseCase>,
    statusCodeOrOptions: HttpStatus | ControllerOptions = HttpStatus.OK
) => {
    const options = typeof statusCodeOrOptions === 'number'
        ? { statusCode: statusCodeOrOptions }
        : {
            statusCode: HttpStatus.OK,
            ...statusCodeOrOptions
        };

    return createController(useCaseToken, {
        statusCode: options.statusCode,
        validationSchema: options.validationSchema,
        getRequestValidationContext: getRequestContext
    });
};
