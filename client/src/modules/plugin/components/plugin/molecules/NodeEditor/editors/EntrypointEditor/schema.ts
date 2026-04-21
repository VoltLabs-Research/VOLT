import { EntrypointType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { z } from 'zod/v4';

export const entrypointEditorSchema = z.object({
    binary: z.string().default(''),
    binaryObjectPath: z.string().optional(),
    binaryFileName: z.string().optional(),
    binaryHash: z.string().optional(),
    type: z.enum([
        EntrypointType.EXECUTABLE,
        EntrypointType.PYTHON_SCRIPT,
        EntrypointType.PACKAGED_EXECUTABLE
    ]).default(EntrypointType.EXECUTABLE),
    arguments: z.string().default(''),
    requirementsFile: z.string().default(''),
    entrypointScript: z.string().default('')
}).strict();

export type EntrypointEditorFormValues = z.infer<typeof entrypointEditorSchema>;

export const ENTRYPOINT_EDITOR_DEFAULT_VALUES = {
    binary: '',
    type: EntrypointType.EXECUTABLE,
    arguments: '',
    requirementsFile: '',
    entrypointScript: ''
} satisfies EntrypointEditorFormValues;
