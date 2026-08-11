import { Button } from '@heroui/react';
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
            <div className='flex flex-row items-end gap-2 [&>*:nth-child(-n+2)]:flex-1 [&>*:nth-child(-n+2)]:min-w-0'>
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
                    onPress={handleAddModel}
                    isDisabled={!newModelId.trim()}
                >
                    Add
                </Button>
            </div>
            {models.length > 0 && (
                <div className='max-h-[200px] overflow-y-auto border border-border rounded-lg'>
                    {models.map((model) => {
                        const modelSummary = defaultModel === model.id ? `${model.id} · default` : model.id;

                        return (
                            <div className='flex flex-row items-center justify-between gap-2 px-2.5 py-2 min-h-12 select-none border-b border-border last:border-b-0 transition-colors duration-[120ms] hover:bg-surface-hover' key={model.id}>
                                <div className='flex flex-col min-w-0'>
                                    <p className='text-sm text-foreground truncate' title={model.name}>
                                        {model.name}
                                    </p>
                                    <p className='text-xs text-muted truncate' title={modelSummary}>
                                        {modelSummary}
                                    </p>
                                </div>
                                <Button
                                    isIconOnly
                                    size='sm'
                                    variant='ghost'
                                    onPress={() => onRemoveModel(model.id)}
                                    aria-label={`Remove ${model.name}`}
                                >
                                    <span className='flex items-center justify-center' title={`Remove ${model.name}`}>
                                        <X size={14} aria-hidden='true' />
                                    </span>
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default IntegrationModelList;
