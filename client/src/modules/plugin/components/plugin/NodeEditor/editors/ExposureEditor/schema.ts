export interface ExposureEditorFormValues {
    name: string;
    icon: string;
    results: string;
}

export const EXPOSURE_EDITOR_DEFAULT_VALUES = {
    name: '',
    icon: '',
    results: ''
} satisfies ExposureEditorFormValues;
