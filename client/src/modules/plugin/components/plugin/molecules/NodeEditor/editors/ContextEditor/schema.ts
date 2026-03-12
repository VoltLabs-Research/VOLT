import { z } from 'zod';
import { ModifierContext } from '@/modules/plugin/api/entities/plugin/workflow-enums';

export const contextEditorSchema = z.object({
    source: z.string().default(ModifierContext.TRAJECTORY_DUMPS)
}).strict();

export type ContextEditorFormValues = z.infer<typeof contextEditorSchema>;

export const CONTEXT_EDITOR_DEFAULT_VALUES = {
    source: ModifierContext.TRAJECTORY_DUMPS
} satisfies ContextEditorFormValues;
