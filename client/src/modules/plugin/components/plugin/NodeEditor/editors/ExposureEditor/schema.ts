import { z } from 'zod/v4';

export const exposureEditorSchema = z.object({
    name: z.string().default(''),
    icon: z.string().default(''),
    results: z.string().default('')
}).strict();

export type ExposureEditorFormValues = z.infer<typeof exposureEditorSchema>;

export const EXPOSURE_EDITOR_DEFAULT_VALUES = {
    name: '',
    icon: '',
    results: ''
} satisfies ExposureEditorFormValues;
