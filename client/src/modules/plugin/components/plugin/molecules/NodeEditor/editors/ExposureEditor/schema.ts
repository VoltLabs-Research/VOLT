import { z } from 'zod/v4';

export const exposureEditorSchema = z.object({
    name: z.string().default(''),
    icon: z.string().default(''),
    results: z.string().default(''),
    iterable: z.string().default(''),
    iterableChunkSize: z.union([z.number(), z.string()]).default(''),
    canvas: z.boolean().default(false),
    raster: z.boolean().default(false)
}).strict();

export type ExposureEditorFormValues = z.infer<typeof exposureEditorSchema>;

export const EXPOSURE_EDITOR_DEFAULT_VALUES = {
    name: '',
    icon: '',
    results: '',
    iterable: '',
    iterableChunkSize: '',
    canvas: false,
    raster: false
} satisfies ExposureEditorFormValues;
