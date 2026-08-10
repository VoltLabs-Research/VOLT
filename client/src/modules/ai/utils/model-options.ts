import type { TeamAIModelListItem } from '@volt/contracts/modules/team/domain';

/**
 * bravais's `SelectOption` was `{ value; title; description? }`. It is not one of the
 * symbols the migration relocated into the client, so the AI module declares the shape
 * it actually consumes next to the mapper that produces it. Identical field-for-field,
 * so nothing downstream changes.
 */
export interface AISelectOption {
    value: string;
    title: string;
    description?: string;
};

export const toAIModelSelectOptions = (models: TeamAIModelListItem[]): AISelectOption[] => {
    return models.map((model) => ({
        value: `${model.provider}::${model.id}`,
        title: model.name,
        description: model.providerName
    }));
};
