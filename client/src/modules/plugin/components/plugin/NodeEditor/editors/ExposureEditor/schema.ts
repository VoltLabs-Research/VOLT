export interface ExposureEditorFormValues {
    name: string;
    icon: string;
    id: string;
    results: string;
}

export const EXPOSURE_EDITOR_DEFAULT_VALUES = {
    name: '',
    icon: '',
    id: '',
    results: ''
} satisfies ExposureEditorFormValues;
