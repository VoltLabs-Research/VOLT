import { Button, LiquidToggle, Select } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { Modal, closeModal } from '@/shared/ui/modal';
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
                        onClick={() => closeModal(TEAM_AI_INTEGRATION_MODAL_ID)}
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
            <form id={TEAM_AI_INTEGRATION_FORM_ID} className='p-6' onSubmit={handleSubmit}>
                <div className='flex flex-col gap-4'>
                    {!editingProvider ? (
                        <div className='flex flex-col gap-2'>
                            <label className='text-sm font-medium text-muted' id={providerLabelId}>Provider</label>
                            <Select
                                options={providerSelectOptions}
                                value={provider}
                                onChange={onProviderChange}
                                disabled={providerSelectOptions.length === 0}
                                placeholder='Select provider'
                                aria-labelledby={providerLabelId}
                            />
                        </div>
                    ) : (
                        <div className='flex flex-col gap-1'>
                            <p className='text-xs text-muted'>Provider</p>
                            <p className='text-base font-medium text-foreground'>
                                {integrationsByProvider.get(editingProvider)?.providerName || editingProvider}
                            </p>
                        </div>
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

                    <div className='flex flex-col gap-2'>
                        <label className='text-sm font-medium text-muted' id={defaultModelLabelId}>Default model</label>
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
                    </div>

                    <div className='flex flex-row items-center justify-between gap-2 integrations-modal-toggle'>
                        <p className='text-sm text-muted'>Enabled</p>
                        <LiquidToggle
                            pressed={draft.isEnabled}
                            onChange={(isEnabled) => setDraft((current) => ({
                                ...current,
                                isEnabled
                            }))}
                        />
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default IntegrationFormModal;
