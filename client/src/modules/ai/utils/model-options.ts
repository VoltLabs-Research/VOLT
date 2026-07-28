import type { TeamAIModelListItem } from '@volt/contracts/modules/team/domain';
import type { SelectOption } from '@voltstack/bravais';

export const toAIModelSelectOptions = (models: TeamAIModelListItem[]): SelectOption[] => {
    return models.map((model) => ({
        value: `${model.provider}::${model.id}`,
        title: model.name,
        description: model.providerName
    }));
};
