export interface ActiveModifier {
    key: string;
    pluginId?: string;
    modifierId?: string;
    type: 'legacy' | 'plugin';
}
