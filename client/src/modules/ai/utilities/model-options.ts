import type { TeamAIModelListItem } from '@/modules/team/api/types/ai-integration/team-ai-integration';
import type { SelectOption } from '@voltstack/bravais';

export const toAIModelSelectOptions = (models: TeamAIModelListItem[]): SelectOption[] => {
    return models.map((model) => ({
        value: `${model.provider}::${model.id}`,
        title: model.name,
        description: model.providerName
    }));
};
