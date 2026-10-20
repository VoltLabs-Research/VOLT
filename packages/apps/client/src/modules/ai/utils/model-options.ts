import type { TeamAIModelListItem } from '@volt/contracts/modules/team/domain';
import type { SelectOption } from '@/shared/contracts/form-field';

export const toAIModelSelectOptions = (models: TeamAIModelListItem[]): SelectOption[] => {
    return models.map((model) => ({
        value: `${model.provider}::${model.id}`,
        title: model.name,
        description: model.providerName
    }));
};
