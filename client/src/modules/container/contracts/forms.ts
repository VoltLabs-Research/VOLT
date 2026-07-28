export interface EnvVariableFormItem extends Record<string, unknown> {
    key: string;
    value: string;
}

export interface PortMappingFormItem extends Record<string, unknown> {
    private: number;
    public?: number;
}
