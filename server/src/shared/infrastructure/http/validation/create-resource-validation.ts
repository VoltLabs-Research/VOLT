import {
    createValidationMiddleware,
    type ValidationSchemaInput,
    ValidationTarget
} from '@shared/infrastructure/http/middleware/validation';

type ValidationMiddlewareConfig = ValidationSchemaInput | {
    schema: ValidationSchemaInput;
    target?: ValidationTarget;
};

type ValidationMiddlewareMap<T extends Record<string, ValidationMiddlewareConfig>> = {
    [K in keyof T]: ReturnType<typeof createValidationMiddleware>;
};

const isValidationMiddlewareTargetConfig = (
    value: ValidationMiddlewareConfig
): value is { schema: ValidationSchemaInput; target?: ValidationTarget } => {
    return typeof value === 'object' && value !== null && 'schema' in value;
};

export const createResourceValidation = <T extends Record<string, ValidationMiddlewareConfig>>(
    schemas: T
): ValidationMiddlewareMap<T> => {
    return Object.fromEntries(
        Object.entries(schemas).map(([key, value]) => {
            if (isValidationMiddlewareTargetConfig(value)) {
                return [key, createValidationMiddleware(value.schema, value.target)];
            }

            return [key, createValidationMiddleware(value)];
        })
    ) as ValidationMiddlewareMap<T>;
};
