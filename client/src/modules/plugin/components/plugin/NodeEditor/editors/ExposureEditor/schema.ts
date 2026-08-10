export interface ExposureEditorFormValues {
    name: string;
    id: string;
    results: string;
}

export const EXPOSURE_EDITOR_DEFAULT_VALUES = {
    name: '',
    id: '',
    results: ''
} satisfies ExposureEditorFormValues;
