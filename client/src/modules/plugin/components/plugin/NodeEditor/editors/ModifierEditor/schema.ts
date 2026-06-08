export interface ModifierEditorFormValues {
    key: string;
    name: string;
    author: string;
    license: string;
    version: string;
    homepage: string;
    description: string;
}

export const MODIFIER_EDITOR_DEFAULT_VALUES = {
    key: '',
    name: '',
    author: '',
    license: '',
    version: '',
    homepage: '',
    description: ''
} satisfies ModifierEditorFormValues;
