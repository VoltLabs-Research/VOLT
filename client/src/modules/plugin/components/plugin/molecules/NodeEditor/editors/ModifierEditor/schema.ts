import { z } from 'zod/v4';

export const modifierEditorSchema = z.object({
    name: z.string().default(''),
    icon: z.string().default(''),
    author: z.string().default(''),
    license: z.string().default(''),
    version: z.string().default(''),
    homepage: z.string().default(''),
    description: z.string().default('')
}).strict();

export type ModifierEditorFormValues = z.infer<typeof modifierEditorSchema>;

export const MODIFIER_EDITOR_DEFAULT_VALUES = {
    name: '',
    icon: '',
    author: '',
    license: '',
    version: '',
    homepage: '',
    description: ''
} satisfies ModifierEditorFormValues;
