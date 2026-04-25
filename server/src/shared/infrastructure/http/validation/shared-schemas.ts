import { z } from 'zod/v4';

interface PaginationQuerySchemaOptions {
    maxLimit: number;
    includeSearch?: boolean;
};

export const objectIdSchema = z.string().trim().regex(/^[a-fA-F0-9]{24}$/);
export const domainExposureIdSchema = z.string().trim().min(1);

export const paginationPageSchema = z.coerce.number().int().min(1).optional();

export const createPaginationLimitSchema = (max: number) => {
    return z.coerce.number().int().min(1).max(max).optional();
};

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
    const shape: Record<string, typeof objectIdSchema> = {};

    keys.forEach((key) => {
        shape[key] = objectIdSchema;
    });

    return z.object(shape).strict();
};

export const teamParamsSchema = createObjectIdParamsSchema(['teamId']);

export const createTeamScopedParamsSchema = <TKey extends string>(key: TKey) => {
    const shape = createObjectIdParamsSchema([key]).shape;
    return teamParamsSchema.extend(shape).strict();
};

export const createFolderValidationSchemas = () => {
    const folderParamsSchema = createTeamScopedParamsSchema('folderId');
    const titleBodySchema = z.object({
        title: z.string().trim().min(1).max(255)
    }).strict();

    return {
        createFolder: {
            params: teamParamsSchema,
            body: titleBodySchema.extend({
                parentId: objectIdSchema.nullable().optional()
            }).strict()
        },
        listFolders: {
            params: teamParamsSchema,
            query: createPaginationQuerySchema({ maxLimit: 500 }).extend({
                parentId: z.string().optional()
            })
        },
        getFolder: {
            params: folderParamsSchema
        },
        updateFolder: {
            params: folderParamsSchema,
            body: titleBodySchema
        },
        deleteFolder: {
            params: folderParamsSchema
        }
    };
};
