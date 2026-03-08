import { z } from 'zod/v4';

export const objectIdSchema = z.string().trim().regex(/^[a-fA-F0-9]{24}$/);

export const paginationPageSchema = z.coerce.number().int().min(1).optional();

export const createPaginationLimitSchema = (max: number) => {
    return z.coerce.number().int().min(1).max(max).optional();
};

interface PaginationQuerySchemaOptions {
    maxLimit: number;
    includeSearch?: boolean;
}

export const createPaginationQuerySchema = ({
    maxLimit,
    includeSearch = false
}: PaginationQuerySchemaOptions) => {
    const baseShape = {
        page: paginationPageSchema,
        limit: createPaginationLimitSchema(maxLimit)
    };

    if (!includeSearch) {
        return z.object(baseShape).strict();
    }

    return z.object({
        ...baseShape,
        search: z.string().trim().min(1).optional()
    }).strict();
};

export const createObjectIdParamsSchema = <TKey extends string>(keys: readonly TKey[]) => {
    const shape = Object.fromEntries(keys.map((key) => [key, objectIdSchema])) as Record<TKey, typeof objectIdSchema>;
    return z.object(shape).strict();
};

export const teamParamsSchema = createObjectIdParamsSchema(['teamId']);

export const createTeamScopedParamsSchema = <TKey extends string>(key: TKey) => {
    return teamParamsSchema.extend({
        [key]: objectIdSchema
    } as Record<TKey, typeof objectIdSchema>).strict();
};
