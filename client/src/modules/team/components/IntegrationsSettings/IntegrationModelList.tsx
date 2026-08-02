import { Button, Row, Stack, Text } from '@voltstack/bravais';
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
        <Stack gap='05'>
            <Text as='p' size='md' weight='medium' tone='secondary'>
                Models
            </Text>
            <Row gap='05' className='integrations-add-model-row'>
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
            </Row>
            {models.length > 0 && (
                <div className='integrations-model-checklist'>
                    {models.map((model) => {
                        const modelSummary = defaultModel === model.id ? `${model.id} · default` : model.id;

                        return (
                            <Row key={model.id} gap='05' justify='between' align='center' className='integrations-model-item'>
                                <Stack style={{ minWidth: 0 }}>
                                    <Text as='p' size='md' tone='primary' truncate title={model.name}>
                                        {model.name}
                                    </Text>
                                    <Text as='p' size='sm' tone='muted' truncate title={modelSummary}>
                                        {modelSummary}
                                    </Text>
                                </Stack>
                                <Button
                                    size='sm'
                                    variant='ghost'
                                    intent='neutral'
                                    leftIcon={<X size={14} />}
                                    onClick={() => onRemoveModel(model.id)}
                                    title={`Remove ${model.name}`}
                                    aria-label={`Remove ${model.name}`}
                                />
                            </Row>
                        );
                    })}
                </div>
            )}
        </Stack>
    );
};

export default IntegrationModelList;
