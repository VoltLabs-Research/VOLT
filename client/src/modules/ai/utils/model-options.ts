import type { TeamAIModelListItem } from '@volt/contracts/modules/team/domain';

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
