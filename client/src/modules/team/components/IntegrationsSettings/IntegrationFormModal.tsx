import { Button, LiquidToggle, Modal, Row, Select, Stack, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import IntegrationModelList from './IntegrationModelList';
import { OLLAMA_DEFAULT_BASE_URL, TEAM_AI_INTEGRATION_MODAL_ID } from '@/modules/team/hooks/ai-integration/use-team-ai-integrations-settings';
import type { IntegrationDraft } from '@/modules/team/hooks/ai-integration/use-team-ai-integrations-settings';
import { useId } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { AIProvider } from '@volt/contracts/modules/ai/domain';
import type { TeamAIIntegration, TeamAIModelMetadata, TeamAIProviderCatalogItem } from '@volt/contracts/modules/team/domain';

const TEAM_AI_INTEGRATION_FORM_ID = 'team-ai-integration-form';

interface IntegrationFormModalProps {
    draft: IntegrationDraft;
    setDraft: Dispatch<SetStateAction<IntegrationDraft>>;
    availableProviders: TeamAIProviderCatalogItem[];
    integrationsByProvider: Map<AIProvider, TeamAIIntegration>;
    isSaving: boolean;
    onProviderChange: (provider: string) => void;
    onSave: () => void;
}

const IntegrationFormModal = ({
    draft,
    setDraft,
    availableProviders,
    integrationsByProvider,
    isSaving,
    onProviderChange,
    onSave
}: IntegrationFormModalProps) => {
    const providerLabelId = useId();
    const defaultModelLabelId = useId();

    const { editingProvider, provider } = draft;

    const providerSelectOptions: SelectOption[] = availableProviders.map((catalogItem) => ({
        value: catalogItem.id,
        title: catalogItem.name,
        description: catalogItem.description
    }));

    const modelOptions: SelectOption[] = draft.enabledModels.map((model) => ({
        value: model.id,
        title: model.name
    }));

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSave();
    };

    const handleAddModel = (model: TeamAIModelMetadata) => {
        setDraft((current) => ({
            ...current,
            enabledModels: [...current.enabledModels, model],
            defaultModel: current.defaultModel ?? model.id
        }));
    };

    const handleRemoveModel = (modelId: string) => {
        setDraft((current) => ({
            ...current,
            enabledModels: current.enabledModels.filter((model) => model.id !== modelId),
            defaultModel: current.defaultModel === modelId ? null : current.defaultModel
        }));
    };

    return (
        <Modal
            id={TEAM_AI_INTEGRATION_MODAL_ID}
            lazyMount
            title={editingProvider ? 'Configure provider' : 'Add provider'}
            description='Set the API key and default model for this provider.'
            width='480px'
            footer={(
                <>
                    <Button
                        variant='outline'
                        intent='neutral'
                        command='close'
                        commandfor={TEAM_AI_INTEGRATION_MODAL_ID}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant='solid'
                        intent='brand'
                        form={TEAM_AI_INTEGRATION_FORM_ID}
                        type='submit'
                        isLoading={isSaving}
                        disabled={isSaving || !provider}
                    >
                        Save
                    </Button>
                </>
            )}
        >
            <form id={TEAM_AI_INTEGRATION_FORM_ID} className='p-1-5' onSubmit={handleSubmit}>
                <Stack gap='1'>
                    {!editingProvider ? (
                        <Stack gap='05'>
                            <Text as='label' id={providerLabelId} size='md' weight='medium' tone='secondary'>Provider</Text>
                            <Select
                                options={providerSelectOptions}
                                value={provider}
                                onChange={onProviderChange}
                                disabled={providerSelectOptions.length === 0}
                                placeholder='Select provider'
                                aria-labelledby={providerLabelId}
                            />
                        </Stack>
                    ) : (
                        <Stack gap='025'>
                            <Text as='p' size='sm' tone='muted'>Provider</Text>
                            <Text as='p' size='lg' weight='medium' tone='primary'>
                                {integrationsByProvider.get(editingProvider)?.providerName || editingProvider}
                            </Text>
                        </Stack>
                    )}

                    {provider !== 'ollama' && (
                        <FormFieldRHF
                            label='API key'
                            type='password'
                            inputProps={{ autoComplete: 'off' }}
                            value={draft.apiKey}
                            onChange={(event) => setDraft((current) => ({
                                ...current,
                                apiKey: event.target.value
                            }))}
                            placeholder={editingProvider ? 'Leave empty to keep current key' : 'sk-...'}
                        />
                    )}

                    <FormFieldRHF
                        label={provider === 'ollama' ? 'Endpoint' : 'Custom endpoint (optional)'}
                        type='text'
                        inputProps={{ autoComplete: 'off' }}
                        value={draft.endpoint}
                        onChange={(event) => setDraft((current) => ({
                            ...current,
                            endpoint: event.target.value
                        }))}
                        placeholder={provider === 'ollama'
                            ? OLLAMA_DEFAULT_BASE_URL
                            : 'Use a self-hosted gateway, e.g. https://my-gateway.example.com/v1'}
                    />

                    <IntegrationModelList
                        key={provider}
                        models={draft.enabledModels}
                        defaultModel={draft.defaultModel}
                        onAddModel={handleAddModel}
                        onRemoveModel={handleRemoveModel}
                    />

                    <Stack gap='05'>
                        <Text as='label' id={defaultModelLabelId} size='md' weight='medium' tone='secondary'>Default model</Text>
                        <Select
                            options={modelOptions}
                            value={draft.defaultModel}
                            onChange={(defaultModel) => setDraft((current) => ({
                                ...current,
                                defaultModel
                            }))}
                            disabled={modelOptions.length === 0}
                            placeholder={modelOptions.length > 0 ? 'Select model' : 'No models available'}
                            aria-labelledby={defaultModelLabelId}
                        />
                    </Stack>

                    <Row gap='05' justify='between' align='center' className='integrations-modal-toggle'>
                        <Text as='p' size='md' tone='muted'>Enabled</Text>
                        <LiquidToggle
                            pressed={draft.isEnabled}
                            onChange={(isEnabled) => setDraft((current) => ({
                                ...current,
                                isEnabled
                            }))}
                        />
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
};

export default IntegrationFormModal;
