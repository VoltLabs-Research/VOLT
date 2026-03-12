import { z } from 'zod';

export const entrypointEditorSchema = z.object({
    binary: z.string().default(''),
    binaryObjectPath: z.string().optional(),
    binaryFileName: z.string().optional(),
    binaryHash: z.string().optional(),
    arguments: z.string().default(''),
    timeout: z.union([z.number(), z.string()]).optional()
}).strict();

export type EntrypointEditorFormValues = z.infer<typeof entrypointEditorSchema>;

export const ENTRYPOINT_EDITOR_DEFAULT_VALUES = {
    binary: '',
    arguments: ''
} satisfies EntrypointEditorFormValues;
