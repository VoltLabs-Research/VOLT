import { invalidateTeamAIIntegrationsQuery, useTeamAIIntegrationsQuery } from '@/modules/team/hooks/ai-integration/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import useCreateTeamAIIntegration from '@/modules/team/hooks/ai-integration/use-create-team-ai-integration';
import useDeleteTeamAIIntegration from '@/modules/team/hooks/ai-integration/use-delete-team-ai-integration';
import useTeamAIIntegrationsSocketSync from '@/modules/team/hooks/ai-integration/use-team-ai-integrations-socket-sync';
import useUpdateTeamAIIntegration from '@/modules/team/hooks/ai-integration/use-update-team-ai-integration';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import LiquidToggle from '@/shared/presentation/components/LiquidToggle';
import Modal, { openModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Select from '@/shared/presentation/components/Select';
import SettingsPage from '@/shared/presentation/components/SettingsPage';
import SettingsSection from '@/shared/presentation/components/SettingsSection';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import { runAction } from '@/shared/presentation/actions/run-action';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import { Skeleton } from '@mui/material';
import { Settings2, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { IoAddOutline } from 'react-icons/io5';
import { sileo } from 'sileo';
import useTip from '@/shared/tips/use-tip';
import { AIProvider } from '@/modules/ai/api/entities/ai-provider';
import type { CreateTeamAIIntegrationParams } from '@/modules/team/api/dtos/ai-integration/create-team-ai-integration';
import type { UpdateTeamAIIntegrationParams } from '@/modules/team/api/dtos/ai-integration/update-team-ai-integration';
import type {
    AIProviderCatalogItem,
    TeamAIIntegration,
    TeamAIModelMetadata
} from '@/modules/team/api/entities/ai-integration/team-ai-integration';
import type { SelectOption } from '@/shared/presentation/components/Select';
import type { FormEvent, KeyboardEvent } from 'react';
import './IntegrationsSettings.css';

interface IntegrationModalStatePreset {
    editingProvider?: AIProvider | null;
    provider?: AIProvider | null;
    apiKey?: string;
    endpoint?: string;
    defaultModel?: string | null;
    enabledModels?: TeamAIModelMetadata[];
    enabled?: boolean;
};

const TEAM_AI_INTEGRATION_MODAL_ID = 'team-ai-integration-modal';
const TEAM_AI_INTEGRATION_FORM_ID = 'team-ai-integration-form';
const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';
const AI_PROVIDER_VALUES = Object.values(AIProvider);

const toOptionalString = (value: string | null | undefined): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : undefined;
};

const isAIProvider = (value: string): value is AIProvider => {
    return AI_PROVIDER_VALUES.some((provider) => provider === value);
};

const resolveOllamaBaseUrl = (metadata?: Record<string, unknown>): string => {
    if (typeof metadata?.baseUrl === 'string') {
        return metadata.baseUrl;
    }
    return OLLAMA_DEFAULT_BASE_URL;
};

const getSaveIntegrationToastOptions = (integration?: TeamAIIntegration) => createPromiseToastOptions({
    loading: integration ? 'Updating provider...' : 'Creating provider...',
    success: integration ? 'Provider configuration updated' : 'Provider configuration created',
    error: integration ? 'Failed to update provider' : 'Failed to create provider'
});

const getRemoveIntegrationToastOptions = (integration: TeamAIIntegration) => createPromiseToastOptions({
    loading: `Removing ${integration.providerName}...`,
    success: `${integration.providerName} removed`,
    error: 'Failed to remove provider'
});

const getDefaultModelPlaceholder = (options: SelectOption[]): string => {
    if (options.length > 0) {
        return 'Select model';
    }

    return 'No models available';
};

export default function IntegrationsSettings() {
    useTip('team-integrations');

    const teamId = useSelectedTeamId() ?? '';

    const {
        data: integrationsData,
        isLoading,
        error: integrationsError
    } = useTeamAIIntegrationsQuery(teamId, { enabled: !!teamId });

    const createTeamAIIntegration = useCreateTeamAIIntegration();
    const updateTeamAIIntegration = useUpdateTeamAIIntegration();
    const deleteTeamAIIntegration = useDeleteTeamAIIntegration();

    const [isSaving, setIsSaving] = useState(false);
    const [busyProvider, setBusyProvider] = useState<AIProvider | null>(null);

    const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
    const [modalProvider, setModalProvider] = useState<AIProvider | null>(null);
    const [modalApiKey, setModalApiKey] = useState('');
    const [modalEndpoint, setModalEndpoint] = useState(OLLAMA_DEFAULT_BASE_URL);
    const [modalDefaultModel, setModalDefaultModel] = useState<string | null>(null);
    const [modalEnabledModels, setModalEnabledModels] = useState<TeamAIModelMetadata[]>([]);
    const [modalEnabled, setModalEnabled] = useState(true);
    const [newModelId, setNewModelId] = useState('');
    const [newModelName, setNewModelName] = useState('');

    const providerLabelId = useId();
    const defaultModelLabelId = useId();

    const integrations: TeamAIIntegration[] = integrationsData?.integrations ?? [];
    const providerCatalog: AIProviderCatalogItem[] = integrationsData?.providers ?? [];

    useEffect(() => {
        if (!integrationsError) return;
        reportError(integrationsError, {
            surface: ErrorSurface.Toast,
            fallbackTitle: 'Failed to load integrations'
        });
    }, [integrationsError]);

    const integrationsByProvider = useMemo(() => {
        return new Map(integrations.map((integration) => [integration.provider, integration]));
    }, [integrations]);

    const configuredIntegrations = useMemo(() => {
        return integrations.filter((integration) => integration.hasApiKey);
    }, [integrations]);

    const availableProviders = useMemo(() => {
        return providerCatalog.filter((provider) => {
            if (!isAIProvider(provider.id)) {
                return false;
            }

            const integration = integrationsByProvider.get(provider.id);
            return !integration?.hasApiKey;
        });
    }, [integrationsByProvider, providerCatalog]);

    const providerSelectOptions: SelectOption[] = useMemo(() => (
        availableProviders.map((provider) => ({
            value: provider.id,
            title: provider.name,
            description: provider.description
        }))
    ), [availableProviders]);

    const modalModelOptions: SelectOption[] = useMemo(() => {
        return modalEnabledModels.map((model) => ({
            value: model.id,
            title: model.name
        }));
    }, [modalEnabledModels]);

    useTeamAIIntegrationsSocketSync(teamId || null);

    const applyModalState = useCallback((preset: IntegrationModalStatePreset = {}) => {
        setEditingProvider(preset.editingProvider ?? null);
        setModalProvider(preset.provider ?? null);
        setModalApiKey(preset.apiKey ?? '');
        setModalEndpoint(preset.endpoint ?? OLLAMA_DEFAULT_BASE_URL);
        setModalDefaultModel(preset.defaultModel ?? null);
        setModalEnabledModels(preset.enabledModels ?? []);
        setModalEnabled(preset.enabled ?? true);
        setNewModelId('');
        setNewModelName('');
    }, []);

    const resetModalState = useCallback(() => {
        applyModalState();
    }, [applyModalState]);

    const openCreateProviderModal = () => {
        if (!teamId) {
            return;
        }

        const firstProviderId = availableProviders[0]?.id;
        if (!firstProviderId || !isAIProvider(firstProviderId)) {
            sileo.info({ title: 'All providers are already configured' });
            return;
        }

        applyModalState({ provider: firstProviderId });
        openModal(TEAM_AI_INTEGRATION_MODAL_ID);
    };

    const openEditProviderModal = (integration: TeamAIIntegration) => {
        const ollamaBaseUrl = integration.provider === 'ollama'
            ? resolveOllamaBaseUrl(integration.metadata)
            : OLLAMA_DEFAULT_BASE_URL;

        applyModalState({
            editingProvider: integration.provider,
            provider: integration.provider,
            endpoint: ollamaBaseUrl,
            enabled: integration.isEnabled,
            enabledModels: integration.enabledModels ?? [],
            defaultModel: integration.defaultModel ?? null
        });
        openModal(TEAM_AI_INTEGRATION_MODAL_ID);
    };

    const handleModalProviderChange = (provider: string) => {
        if (!providerCatalog.some((p) => p.id === provider) || !isAIProvider(provider)) {
            return;
        }

        const nextIntegration = integrationsByProvider.get(provider);
        const ollamaBaseUrl = provider === 'ollama'
            ? resolveOllamaBaseUrl(nextIntegration?.metadata)
            : OLLAMA_DEFAULT_BASE_URL;

        applyModalState({
            editingProvider,
            provider,
            endpoint: ollamaBaseUrl,
            enabled: modalEnabled,
            enabledModels: modalEnabledModels,
            defaultModel: modalDefaultModel
        });
    };

    const handleAddModel = () => {
        const id = newModelId.trim();
        const name = newModelName.trim() || id;
        if (!id) return;
        if (modalEnabledModels.some((m) => m.id === id)) return;

        setModalEnabledModels((prev) => [...prev, { id, name }]);
        setNewModelId('');
        setNewModelName('');

        if (!modalDefaultModel) {
            setModalDefaultModel(id);
        }
    };

    const handleAddModelKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAddModel();
        }
    };

    const handleRemoveModel = (modelId: string) => {
        setModalEnabledModels((prev) => prev.filter((m) => m.id !== modelId));
        if (modalDefaultModel === modelId) {
            setModalDefaultModel(null);
        }
    };

    const renderModelItem = useCallback((model: TeamAIModelMetadata) => {
        const isDefault = modalDefaultModel === model.id;
        const modelSummary = isDefault ? `${model.id} · default` : model.id;

        return (
            <Container
                key={model.id}
                className='integrations-model-item d-flex items-center content-between gap-05'
            >
                <Container className='d-flex column' style={{ minWidth: 0 }}>
                    <Paragraph className='font-size-2 color-primary text-truncate' title={model.name}>
                        {model.name}
                    </Paragraph>
                    <Paragraph className='font-size-1 color-muted text-truncate' title={modelSummary}>
                        {modelSummary}
                    </Paragraph>
                </Container>
                <Button
                    size='sm'
                    variant='ghost'
                    intent='neutral'
                    leftIcon={<X size={14} />}
                    onClick={() => handleRemoveModel(model.id)}
                    title={`Remove ${model.name}`}
                    aria-label={`Remove ${model.name}`}
                />
            </Container>
        );
    }, [modalDefaultModel]);

    const handleSaveIntegration = async () => {
        if (!modalProvider) {
            sileo.error({ title: 'Choose a provider' });
            return;
        }

        const integration = integrationsByProvider.get(modalProvider);
        const apiKey = modalApiKey.trim();
        if (!integration && modalProvider !== 'ollama' && !apiKey) {
            sileo.error({ title: 'API key is required for new providers' });
            return;
        }
        if (modalProvider === 'ollama' && !modalEndpoint.trim()) {
            sileo.error({ title: 'Endpoint URL is required for Ollama' });
            return;
        }

        const payload: CreateTeamAIIntegrationParams | UpdateTeamAIIntegrationParams = {
            isEnabled: modalEnabled,
            defaultModel: toOptionalString(modalDefaultModel),
            enabledModels: modalEnabledModels
        };

        if (apiKey) {
            payload.apiKey = apiKey;
        }

        if (modalProvider === 'ollama') {
            payload.metadata = {
                baseUrl: modalEndpoint.trim()
            };
        }

        setIsSaving(true);
        try {
            await runAction({
                action: integration
                    ? () => updateTeamAIIntegration(modalProvider, payload)
                    : () => createTeamAIIntegration(modalProvider, payload),
                toast: getSaveIntegrationToastOptions(integration),
                modalId: TEAM_AI_INTEGRATION_MODAL_ID,
                afterSuccess: async () => {
                    resetModalState();
                    if (teamId) {
                        await invalidateTeamAIIntegrationsQuery(teamId);
                    }
                }
            });
        } catch {
        } finally {
            setIsSaving(false);
        }
    };

    const handleIntegrationFormSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        handleSaveIntegration();
    }, [handleSaveIntegration]);

    const handleRemoveProvider = async (provider: AIProvider) => {
        const integration = integrationsByProvider.get(provider);
        if (!integration) {
            return;
        }

        const isConfirmed = await confirm({
            title: `Remove ${integration.providerName} from this team?`,
            description: 'This removes the shared provider configuration for every team member.',
            confirmText: 'Remove provider',
            cancelText: 'Keep provider',
            tone: ConfirmActionTone.Danger
        });

        if (!isConfirmed) {
            return;
        }

        setBusyProvider(provider);
        try {
            await runAction({
                action: () => deleteTeamAIIntegration(provider),
                toast: getRemoveIntegrationToastOptions(integration),
                afterSuccess: async () => {
                    if (teamId) {
                        await invalidateTeamAIIntegrationsQuery(teamId);
                    }
                }
            });
        } finally {
            setBusyProvider(null);
        }
    };

    const canAddProvider = Boolean(teamId && availableProviders.length > 0);

    return (
        <SettingsPage title='Integrations'>
            <SettingsSection>
                <SettingsSectionHeader
                    title='AI Providers'
                    description='Manage API keys and models shared across your team.'
                    action={(
                        <Button
                            size='sm'
                            variant='solid'
                            intent='white'
                            className='radius-full'
                            leftIcon={<IoAddOutline size={14} />}
                            onClick={openCreateProviderModal}
                            disabled={!canAddProvider}
                        >
                            Connect
                        </Button>
                    )}
                />

                {!teamId ? (
                    <Paragraph className='font-size-2 color-muted'>
                        Select a team to manage integrations.
                    </Paragraph>
                ) : isLoading ? (
                    <Container className='integrations-provider-list'>
                        {Array.from({ length: 3 }).map((_, index) => (
                            <Container key={index} className='integrations-provider-row d-flex items-center content-between gap-1'>
                                <Skeleton variant='text' width={100} height={20} />
                                <Container className='d-flex items-center gap-025'>
                                    <Skeleton variant='circular' width={24} height={24} />
                                    <Skeleton variant='circular' width={24} height={24} />
                                </Container>
                            </Container>
                        ))}
                    </Container>
                ) : !isLoading && integrationsError && configuredIntegrations.length === 0 ? (
                    <RecoveryState
                        title='Unable to load integrations'
                        description='Something went wrong while loading your AI provider integrations.'
                        tone={RecoveryStateTone.Error}
                        retryLabel='Try again'
                        onRetry={() => invalidateTeamAIIntegrationsQuery(teamId)}
                    />
                ) : configuredIntegrations.length === 0 ? (
                    <Container className='integrations-empty-state'>
                        <Paragraph className='font-size-2 color-muted'>
                            No providers configured yet.
                        </Paragraph>
                    </Container>
                ) : (
                    <Container className='integrations-provider-list'>
                        {configuredIntegrations.map((integration) => (
                            <Container
                                key={integration.provider}
                                className='integrations-provider-row d-flex items-center content-between gap-1'
                            >
                                <Container className='d-flex column gap-025' style={{ minWidth: 0 }}>
                                    <Paragraph className='font-size-2 font-weight-5 color-primary'>
                                        {integration.providerName}
                                    </Paragraph>
                                    <Paragraph className='font-size-1 color-muted text-truncate' title={integration.defaultModel ?? 'No default model selected'}>
                                        {integration.defaultModel
                                            ? `Default model: ${integration.defaultModel}`
                                            : 'No default model selected'}
                                    </Paragraph>
                                </Container>

                                <Container className='integrations-provider-row-actions d-flex items-center gap-025'>
                                    <Button
                                        size='sm'
                                        variant='ghost'
                                        intent='neutral'
                                        leftIcon={<Settings2 size={14} />}
                                        onClick={() => openEditProviderModal(integration)}
                                        disabled={isLoading}
                                        title={`Configure ${integration.providerName}`}
                                        aria-label={`Configure ${integration.providerName}`}
                                    />
                                    <Button
                                        size='sm'
                                        variant='ghost'
                                        intent='danger'
                                        leftIcon={<Trash2 size={14} />}
                                        onClick={() => handleRemoveProvider(integration.provider)}
                                        isLoading={busyProvider === integration.provider}
                                        disabled={isLoading}
                                        title={`Remove ${integration.providerName}`}
                                        aria-label={`Remove ${integration.providerName}`}
                                    />
                                </Container>
                            </Container>
                        ))}
                    </Container>
                )}
            </SettingsSection>

            <Modal
                id={TEAM_AI_INTEGRATION_MODAL_ID}
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
                            disabled={isSaving || !modalProvider}
                        >
                            Save
                        </Button>
                    </>
                )}
            >
                <form id={TEAM_AI_INTEGRATION_FORM_ID} className='p-1-5' onSubmit={handleIntegrationFormSubmit}>
                    <Container className='d-flex column gap-1'>
                        {!editingProvider ? (
                            <Container className='d-flex column gap-05'>
                                <label id={providerLabelId} className='font-size-2 font-weight-5 color-secondary'>Provider</label>
                                <Select
                                    options={providerSelectOptions}
                                    value={modalProvider}
                                    onChange={handleModalProviderChange}
                                    disabled={providerSelectOptions.length === 0}
                                    placeholder='Select provider'
                                    aria-labelledby={providerLabelId}
                                />
                            </Container>
                        ) : (
                            <Container className='d-flex column gap-025'>
                                <Paragraph className='font-size-1 color-muted'>Provider</Paragraph>
                                <Paragraph className='font-size-3 font-weight-5 color-primary'>
                                    {integrationsByProvider.get(editingProvider)?.providerName || editingProvider}
                                </Paragraph>
                            </Container>
                        )}

                        {modalProvider !== 'ollama' && (
                            <FormFieldRHF
                                label='API key'
                                type='password'
                                inputProps={{ autoComplete: 'off' }}
                                value={modalApiKey}
                                onChange={(event) => setModalApiKey(event.target.value)}
                                placeholder={editingProvider ? 'Leave empty to keep current key' : 'sk-...'}
                            />
                        )}

                        {modalProvider === 'ollama' && (
                            <FormFieldRHF
                                label='Endpoint'
                                type='text'
                                inputProps={{ autoComplete: 'off' }}
                                value={modalEndpoint}
                                onChange={(event) => setModalEndpoint(event.target.value)}
                                placeholder={OLLAMA_DEFAULT_BASE_URL}
                            />
                        )}

                        <Container className='d-flex column gap-05'>
                            <Paragraph className='font-size-2 font-weight-5 color-secondary'>
                                Models
                            </Paragraph>
                            <Container className='d-flex gap-05 integrations-add-model-row'>
                                <FormFieldRHF
                                    label='Model ID'
                                    placeholder='Model ID (e.g. gpt-4o)'
                                    value={newModelId}
                                    onChange={(event) => setNewModelId(event.target.value)}
                                    inputProps={{ onKeyDown: handleAddModelKeyDown }}
                                />
                                <FormFieldRHF
                                    label='Display name'
                                    placeholder='Display name'
                                    value={newModelName}
                                    onChange={(event) => setNewModelName(event.target.value)}
                                    inputProps={{ onKeyDown: handleAddModelKeyDown }}
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
                            </Container>
                            {modalEnabledModels.length > 0 && (
                                <Container className='integrations-model-checklist'>
                                    {modalEnabledModels.map(renderModelItem)}
                                </Container>
                            )}
                        </Container>
                        
                        <Container className='d-flex column gap-05'>
                            <label id={defaultModelLabelId} className='font-size-2 font-weight-5 color-secondary'>Default model</label>
                            <Select
                                options={modalModelOptions}
                                value={modalDefaultModel}
                                onChange={setModalDefaultModel}
                                disabled={modalModelOptions.length === 0}
                                placeholder={getDefaultModelPlaceholder(modalModelOptions)}
                                aria-labelledby={defaultModelLabelId}
                            />
                        </Container>

                        <Container className='d-flex items-center content-between gap-05 integrations-modal-toggle'>
                            <Paragraph className='font-size-2 color-muted'>Enabled</Paragraph>
                            <LiquidToggle pressed={modalEnabled} onChange={setModalEnabled} />
                        </Container>
                    </Container>
                </form>
            </Modal>
        </SettingsPage>
    );
}
