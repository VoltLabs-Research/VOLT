import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { asRecord } from '@shared/infrastructure/utilities/type-guards';
import { validateRequest, ValidationTarget } from '@shared/infrastructure/http/middleware/validation';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { RequestValidationState, ValidationSchemaInput } from '@shared/infrastructure/http/middleware/validation';
import type { Response } from 'express';

/**
 * Internal helpers shared by the controller factories (`createController` and
 * `createReadController`). Co-locating them here keeps the two factories honest
 * about producing controllers with identical validation/param semantics.
 */

export const readUserAgent = (req: AuthenticatedRequest): string => {
    const userAgent = req.headers['user-agent'];

    return Array.isArray(userAgent) ? userAgent[0] ?? '' : userAgent ?? '';
};

export const buildRequestValidationContext = (req: AuthenticatedRequest): Record<string, unknown> => {
    return {
        userId: req.userId,
        token: req.token
    };
};

/**
 * Wraps `handle` with an inline validation pass. This is the single source of
 * truth for request validation now that `BaseController.validate()` has been
 * removed. The validation middleware previously exposed via
 * `createValidationMiddleware` is still supported for routes that mount it
 * explicitly; those routes will populate `req.validated` first, and this
 * wrapper will simply re-assert the schema (cheap) or be a no-op when the
 * controller has no `validationSchema`.
 */
export const wrapHandleWithValidation = <THandler extends (req: AuthenticatedRequest, res: Response) => Promise<void>>(
    handler: THandler,
    validationSchema: ValidationSchemaInput | undefined
): THandler => {
    if (!validationSchema) {
        return handler;
    }

    const wrapped = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const validationResult = validateRequest(
            req,
            validationSchema,
            ValidationTarget.Body,
            buildRequestValidationContext(req)
        );

        if (!validationResult.success) {
            BaseResponse.error(
                res,
                validationResult.message,
                HttpStatus.BadRequest,
                validationResult.code
            );
            return;
        }

        await handler(req, res);
    };

    return wrapped as THandler;
};

export const buildControllerParams = (
    req: AuthenticatedRequest,
    validationState: RequestValidationState,
    extendParams?: (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ) => Record<string, unknown>
): Record<string, unknown> => {
    const bodyPayload = asRecord(validationState.body ?? req.body) ?? {};
    const baseParams = {
        ...(asRecord(validationState.params ?? req.params) ?? {}),
        ...(asRecord(validationState.query ?? req.query) ?? {}),
        ...(asRecord(validationState.request) ?? {}),
        ...bodyPayload,
        data: bodyPayload,
        userId: req.userId,
        authenticatedUserId: req.userId,
        token: req.token,
        authType: req.authType,
        secretKeyId: req.secretKeyId,
        secretKeyTeamId: req.secretKeyTeamId,
        secretKeyRoleId: req.secretKeyRoleId,
        ip: req.ip || req.socket.remoteAddress || '',
        userAgent: readUserAgent(req),
        traceId: req.requestContext?.traceId,
        requestContext: req.requestContext,
        file: req.file,
        files: req.files
    };

    if (!extendParams) {
        return baseParams;
    }

    return extendParams(req, baseParams);
};
