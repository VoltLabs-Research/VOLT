import type { ActiveModifier } from '../entities/ActiveModifier';

export class ModifierSelectionService {
    toggleModifier(
        modifiers: ActiveModifier[],
        modifierKey: string,
        pluginId?: string,
        modifierId?: string
    ): ActiveModifier[] {
        const existingIndex = modifiers.findIndex((modifier) => modifier.key === modifierKey);
        if (existingIndex !== -1) {
            return modifiers.filter((_, index) => index !== existingIndex);
        }

        const newModifier: ActiveModifier = {
            key: modifierKey,
            pluginId,
            modifierId,
            type: pluginId && modifierId ? 'plugin' : 'legacy'
        };

        let nextModifiers = [...modifiers];
        if (newModifier.type === 'plugin') {
            nextModifiers = nextModifiers.filter((modifier) => modifier.type !== 'plugin');
        }

        return [...nextModifiers, newModifier];
    }
}
