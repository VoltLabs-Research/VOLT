import Loader from '@/shared/ui/components/Loader';
import { Button, Label, ListBox, Select, Switch } from '@heroui/react';
import { Modal } from '@/shared/ui/modal/Modal';
import { closeModal } from '@/shared/ui/modal/use-modal-store';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import IntegrationModelList from './IntegrationModelList';
import { OLLAMA_DEFAULT_BASE_URL, TEAM_AI_INTEGRATION_MODAL_ID } from '@/modules/team/hooks/ai-integration/use-team-ai-integrations-settings';
import type { IntegrationDraft } from '@/modules/team/hooks/ai-integration/use-team-ai-integrations-settings';
import { useId } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { Key } from 'react-aria-components';
import type { AIProvider } from '@volt/contracts/modules/ai/domain';
import type { TeamAIIntegration, TeamAIModelMetadata, TeamAIProviderCatalogItem } from '@volt/contracts/modules/team/domain';

const TEAM_AI_INTEGRATION_FORM_ID = 'team-ai-integration-form';

interface IntegrationSelectOption {
    value: string;
    title: string;
}

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
    const enabledLabelId = useId();

    const { editingProvider, provider } = draft;

    const providerSelectOptions: IntegrationSelectOption[] = availableProviders.map((catalogItem) => ({
        value: catalogItem.id,
        title: catalogItem.name
    }));

    const modelOptions: IntegrationSelectOption[] = draft.enabledModels.map((model) => ({
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

    const handleProviderSelectionChange = (key: Key | null) => {
        if (key === null) return;

        onProviderChange(String(key));
    };

    const handleDefaultModelSelectionChange = (key: Key | null) => {
        if (key === null) return;

        setDraft((current) => ({
            ...current,
            defaultModel: String(key)
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
                        onPress={() => closeModal(TEAM_AI_INTEGRATION_MODAL_ID)}
                        isDisabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant='primary'
                        form={TEAM_AI_INTEGRATION_FORM_ID}
                        type='submit'
                        isPending={isSaving}
                        isDisabled={isSaving || !provider}
                    >
                        {isSaving && <Loader size='sm' color='current' />}
                        Save
                    </Button>
                </>
            )}
        >
            <form id={TEAM_AI_INTEGRATION_FORM_ID} onSubmit={handleSubmit}>
                <div className='flex flex-col gap-4'>
                    {!editingProvider ? (
                        <div className='flex flex-col gap-2'>
                            <label className='text-sm font-medium text-muted' id={providerLabelId}>Provider</label>
                            <Select
                                selectedKey={provider}
                                onSelectionChange={handleProviderSelectionChange}
                                placeholder='Select provider'
                                isDisabled={providerSelectOptions.length === 0}
                                fullWidth
                                aria-labelledby={providerLabelId}
                            >
                                <Select.Trigger>
                                    <Select.Value>
                                        {({ isPlaceholder, selectedText, defaultChildren }) => (
                                            isPlaceholder ? defaultChildren : selectedText
                                        )}
                                    </Select.Value>
                                    <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                    <ListBox>
                                        {providerSelectOptions.map((option) => (
                                            <ListBox.Item key={option.value} id={option.value} textValue={option.title}>
                                                <ListBox.ItemIndicator />
                                                <Label>{option.title}</Label>
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Select.Popover>
                            </Select>
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
                            selectedKey={draft.defaultModel}
                            onSelectionChange={handleDefaultModelSelectionChange}
                            placeholder={modelOptions.length > 0 ? 'Select model' : 'No models available'}
                            isDisabled={modelOptions.length === 0}
                            fullWidth
                            aria-labelledby={defaultModelLabelId}
                        >
                            <Select.Trigger>
                                <Select.Value>
                                    {({ isPlaceholder, selectedText, defaultChildren }) => (
                                        isPlaceholder ? defaultChildren : selectedText
                                    )}
                                </Select.Value>
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {modelOptions.map((option) => (
                                        <ListBox.Item key={option.value} id={option.value} textValue={option.title}>
                                            <ListBox.ItemIndicator />
                                            <Label>{option.title}</Label>
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>
                    <div className='flex flex-row items-center justify-between gap-2 border-t border-border pt-3 mt-1'>
                        <p className='text-sm text-muted' id={enabledLabelId}>Enabled</p>
                        <Switch
                            isSelected={draft.isEnabled}
                            onChange={(isEnabled) => setDraft((current) => ({
                                ...current,
                                isEnabled
                            }))}
                            aria-labelledby={enabledLabelId}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default IntegrationFormModal;
