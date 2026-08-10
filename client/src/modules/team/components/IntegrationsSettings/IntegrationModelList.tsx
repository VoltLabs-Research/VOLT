import { Button } from '@voltstack/bravais';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { X } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { TeamAIModelMetadata } from '@volt/contracts/modules/team/domain';

interface IntegrationModelListProps {
    models: TeamAIModelMetadata[];
    defaultModel: string | null;
    onAddModel: (model: TeamAIModelMetadata) => void;
    onRemoveModel: (modelId: string) => void;
}

/**
 * Editor for the models enabled on an integration. The in-progress "add model" inputs are
 * local state, so remounting this component (via `key`) clears them.
 */
const IntegrationModelList = ({
    models,
    defaultModel,
    onAddModel,
    onRemoveModel
}: IntegrationModelListProps) => {
    const [newModelId, setNewModelId] = useState('');
    const [newModelName, setNewModelName] = useState('');

    const handleAddModel = () => {
        const id = newModelId.trim();
        if (!id || models.some((model) => model.id === id)) return;

        onAddModel({
            id,
            name: newModelName.trim() || id
        });
        setNewModelId('');
        setNewModelName('');
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAddModel();
        }
    };

    return (
        <div className='flex flex-col gap-2'>
            <p className='text-sm font-medium text-muted'>
                Models
            </p>
            <div className='flex flex-row items-center gap-2 integrations-add-model-row'>
                <FormFieldRHF
                    label='Model ID'
                    placeholder='Model ID (e.g. gpt-4o)'
                    value={newModelId}
                    onChange={(event) => setNewModelId(event.target.value)}
                    inputProps={{ onKeyDown: handleKeyDown }}
                />
                <FormFieldRHF
                    label='Display name'
                    placeholder='Display name'
                    value={newModelName}
                    onChange={(event) => setNewModelName(event.target.value)}
                    inputProps={{ onKeyDown: handleKeyDown }}
                />
                <Button
                    size='sm'
                    variant='outline'
                    intent='neutral'
                    onClick={handleAddModel}
                    disabled={!newModelId.trim()}
                >
                    Add
                </Button>
            </div>
            {models.length > 0 && (
                <div className='integrations-model-checklist'>
                    {models.map((model) => {
                        const modelSummary = defaultModel === model.id ? `${model.id} · default` : model.id;

                        return (
                            <div className='flex flex-row items-center justify-between gap-2 integrations-model-item' key={model.id}>
                                <div className='flex flex-col' style={{ minWidth: 0 }}>
                                    <p className='text-sm text-foreground truncate' title={model.name}>
                                        {model.name}
                                    </p>
                                    <p className='text-xs text-muted truncate' title={modelSummary}>
                                        {modelSummary}
                                    </p>
                                </div>
                                <Button
                                    size='sm'
                                    variant='ghost'
                                    intent='neutral'
                                    leftIcon={<X size={14} />}
                                    onClick={() => onRemoveModel(model.id)}
                                    title={`Remove ${model.name}`}
                                    aria-label={`Remove ${model.name}`}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default IntegrationModelList;
