import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod/v4';

export enum ValidationTarget {
    Body = 'body',
    Query = 'query',
    Params = 'params',
    Request = 'request'
}

export type RequestValidationSchema = Partial<Record<ValidationTarget, z.ZodType<unknown>>>;
export type ValidationSchemaInput = z.ZodType<unknown> | RequestValidationSchema;

type RequestSectionTarget = Exclude<ValidationTarget, ValidationTarget.Request>;

export interface RequestValidationState {
    body?: unknown;
    query?: unknown;
    params?: unknown;
    request?: unknown;
}

export interface ValidatedRequest extends Request {
    validated?: RequestValidationState;
}

interface ValidationSuccess {
    success: true;
    data: RequestValidationState;
}

interface ValidationFailure {
    success: false;
    message: string;
    code: 'Validation::InvalidInput';
}

type ValidationResult = ValidationSuccess | ValidationFailure;

const REQUEST_SECTION_TARGETS: RequestSectionTarget[] = [ValidationTarget.Params, ValidationTarget.Query, ValidationTarget.Body];

const isZodSchema = (value: unknown): value is z.ZodType<unknown> => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    return 'safeParse' in value;
};

const getValidationSource = (
    request: Request,
    target: ValidationTarget,
    requestContext?: unknown
): unknown => {
    if (target === ValidationTarget.Request) {
        return requestContext ?? {
            body: request.body,
            query: request.query,
            params: request.params
        };
    }

    return request[target];
};

const assignParsedSource = (request: ValidatedRequest, target: RequestSectionTarget, parsedValue: unknown): void => {
    Reflect.set(request, target, parsedValue);
};

const ensureValidationState = (request: ValidatedRequest): RequestValidationState => {
    if (!request.validated) {
        request.validated = {};
    }

    return request.validated;
};

const setValidatedSource = (
    request: ValidatedRequest,
    target: ValidationTarget,
    parsedValue: unknown
): void => {
    const validationState = ensureValidationState(request);
    validationState[target] = parsedValue;
};

const formatValidationMessage = (target: ValidationTarget, error: z.ZodError): string => {
    const firstIssue = error.issues[0];
    const pathSegments = firstIssue.path.filter((segment) => segment !== '').map((segment) => String(segment));
    const issuePath = pathSegments.join('.');

    if (!issuePath) {
        return `${target}: ${firstIssue.message}`;
    }

    return `${target}.${issuePath}: ${firstIssue.message}`;
};

const getStructuredSchemas = (
    schema: ValidationSchemaInput,
    defaultTarget: ValidationTarget
): RequestValidationSchema => {
    if (isZodSchema(schema)) {
        return {
            [defaultTarget]: schema
        };
    }

    return schema;
};

const validateTarget = (
    request: ValidatedRequest,
    target: ValidationTarget,
    schema: z.ZodType<unknown>,
    requestContext?: unknown
): ValidationResult => {
    const result = schema.safeParse(getValidationSource(request, target, requestContext));

    if (!result.success) {
        return {
            success: false,
            message: formatValidationMessage(target, result.error),
            code: 'Validation::InvalidInput'
        };
    }

    setValidatedSource(request, target, result.data);

    if (target === ValidationTarget.Request) {
        return {
            success: true,
            data: {
                request: result.data
            }
        };
    }

    assignParsedSource(request, target, result.data);

    return {
        success: true,
        data: {
            [target]: result.data
        }
    };
};

export const createValidationMiddleware = (
    schema: ValidationSchemaInput,
    target: ValidationTarget = ValidationTarget.Body
) => {
    return (request: Request, response: Response, next: NextFunction): void => {
        const validatedRequest: ValidatedRequest = request;
        const validationResult = validateRequest(validatedRequest, schema, target);

        if (!validationResult.success) {
            BaseResponse.error(
                response,
                validationResult.message,
                400,
                validationResult.code
            );
            return;
        }

        next();
    };
};

export const validateRequest = (
    request: ValidatedRequest,
    schema: ValidationSchemaInput,
    defaultTarget: ValidationTarget = ValidationTarget.Body,
    requestContext?: unknown
): ValidationResult => {
    const schemas = getStructuredSchemas(schema, defaultTarget);
    const aggregatedData: RequestValidationState = {};

    for (const target of REQUEST_SECTION_TARGETS) {
        const targetSchema = schemas[target];

        if (!targetSchema) {
            continue;
        }

        const validationResult = validateTarget(request, target, targetSchema, requestContext);

        if (!validationResult.success) {
            return validationResult;
        }

        Object.assign(aggregatedData, validationResult.data);
    }

    const requestSchema = schemas.request;

    if (!requestSchema) {
        return {
            success: true,
            data: aggregatedData
        };
    }

    const requestValidationResult = validateTarget(request, ValidationTarget.Request, requestSchema, requestContext);

    if (!requestValidationResult.success) {
        return requestValidationResult;
    }

    Object.assign(aggregatedData, requestValidationResult.data);

    return {
        success: true,
        data: aggregatedData
    };
};
