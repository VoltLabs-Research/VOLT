import type { AIProvider } from '@volt/contracts/modules/ai/domain';
import type { EnabledModel } from '@volt/contracts/modules/team/domain';

export type TeamAIProvider = AIProvider;

export const dedupeEnabledModels = (models: EnabledModel[] = []): EnabledModel[] => {
    const byId = new Map<string, EnabledModel>();

    for(const { id, name } of models){
        const model = {
            id: id.trim(),
            name: name.trim()
        };
        if(model.id.length > 0 && model.name.length > 0) byId.set(model.id, model);
    }

    return [...byId.values()];
};
