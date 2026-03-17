import { EntrypointType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { z } from 'zod/v4';

const timeoutSchema = z.preprocess((value) => {
    if (value === '' || value === null || typeof value === 'undefined') {
        return undefined;
    }

    return value;
}, z.coerce.number().optional());

export const entrypointEditorSchema = z.object({
    binary: z.string().default(''),
    binaryObjectPath: z.string().optional(),
    binaryFileName: z.string().optional(),
    binaryHash: z.string().optional(),
    type: z.enum([EntrypointType.EXECUTABLE, EntrypointType.PYTHON_SCRIPT]).default(EntrypointType.EXECUTABLE),
    arguments: z.string().default(''),
    requirementsFile: z.string().default(''),
    entrypointScript: z.string().default(''),
    timeout: timeoutSchema
}).strict();

export type EntrypointEditorFormValues = z.infer<typeof entrypointEditorSchema>;

export const ENTRYPOINT_EDITOR_DEFAULT_VALUES = {
    binary: '',
    type: EntrypointType.EXECUTABLE,
    arguments: '',
    requirementsFile: '',
    entrypointScript: ''
} satisfies EntrypointEditorFormValues;
