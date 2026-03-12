import { z } from 'zod';

export const forEachEditorSchema = z.object({
    iterableSource: z.string().default('')
}).strict();

export type ForEachEditorFormValues = z.infer<typeof forEachEditorSchema>;

export const FOR_EACH_EDITOR_DEFAULT_VALUES = {
    iterableSource: ''
} satisfies ForEachEditorFormValues;
