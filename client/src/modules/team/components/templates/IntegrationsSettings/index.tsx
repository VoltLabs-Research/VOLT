import { invalidateTeamAIIntegrationsQuery, useTeamAIIntegrationsQuery } from '@/modules/team/hooks/ai-integration/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { handleActionError, runHandledAction } from '@/shared/errors/handled-action';
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
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import { runAction } from '@/shared/presentation/actions/run-action';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import { Skeleton } from '@mui/material';
import { Settings2, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoAddOutline } from 'react-icons/io5';
import { sileo } from 'sileo';
import type { AIProvider } from '@/modules/ai/api/entities/ai-provider';
import type { CreateTeamAIIntegrationParams } from '@/modules/team/api/dtos/ai-integration/create-team-ai-integration';
import type { UpdateTeamAIIntegrationParams } from '@/modules/team/api/dtos/ai-integration/update-team-ai-integration';
import type {
    AIProviderCatalogItem,
    TeamAIIntegration,
    TeamAIModelMetadata
} from '@/modules/team/api/entities/ai-integration/team-ai-integration';
import type { SelectOption } from '@/shared/presentation/components/Select';
import type { KeyboardEvent } from 'react';
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
const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';

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
    const teamId = useSelectedTeamId() ?? '';

    const {
        data: integrationsData,
        isLoading,
        error: integrationsError
    } = useTeamAIIntegrationsQuery(teamId, { enabled: !!teamId });

    const createTeamAIIntegration = useCreateTeamAIIntegration();
    const updateTeamAIIntegration = useUpdateTeamAIIntegration();
    const deleteTeamAIIntegration = useDeleteTeamAIIntegration();
    const { confirm } = useConfirm();

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

    const integrations: TeamAIIntegration[] = integrationsData?.integrations ?? [];
    const providerCatalog: AIProviderCatalogItem[] = integrationsData?.providers ?? [];

    useEffect(() => {
        if (!integrationsError) return;
        handleActionError(integrationsError, {
            accessDeniedTitle: 'You do not have permission to perform this action.',
            errorToast: { title: 'Failed to load integrations' }
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
            const integration = integrationsByProvider.get(provider.id as AIProvider);
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

        const firstProvider = availableProviders[0]?.id as AIProvider | undefined;
        if (!firstProvider) {
            sileo.info({ title: 'All providers are already configured' });
            return;
        }

        applyModalState({ provider: firstProvider });
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
        if (!providerCatalog.some((p) => p.id === provider)) {
            return;
        }

        const nextProvider = provider as AIProvider;
        const nextIntegration = integrationsByProvider.get(nextProvider);
        const ollamaBaseUrl = nextProvider === 'ollama'
            ? resolveOllamaBaseUrl(nextIntegration?.metadata)
            : OLLAMA_DEFAULT_BASE_URL;

        applyModalState({
            editingProvider,
            provider: nextProvider,
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

        return (
            <Container
                key={model.id}
                className='integrations-model-item d-flex items-center content-between gap-05'
            >
                <Container className='d-flex column' style={{ minWidth: 0 }}>
                    <Paragraph className='font-size-2 color-primary text-truncate'>
                        {model.name}
                    </Paragraph>
                    <Paragraph className='font-size-1 color-muted text-truncate'>
                        {model.id}
                        {isDefault && ' · default'}
                    </Paragraph>
                </Container>
                <Button
                    size='sm'
                    variant='ghost'
                    intent='neutral'
                    leftIcon={<X size={14} />}
                    onClick={() => handleRemoveModel(model.id)}
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
            defaultModel: modalDefaultModel || undefined,
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

    const handleRemoveProvider = async (provider: AIProvider) => {
        const integration = integrationsByProvider.get(provider);
        if (!integration) {
            return;
        }

        const isConfirmed = await confirm({
            title: `Remove ${integration.providerName} from this team?`,
            confirmText: 'Remove'
        });

        if (!isConfirmed) {
            return;
        }

        setBusyProvider(provider);
        try {
            await runHandledAction({
                action: () => deleteTeamAIIntegration(provider),
                toast: getRemoveIntegrationToastOptions(integration),
                afterSuccess: async () => {
                    if (teamId) {
                        await invalidateTeamAIIntegrationsQuery(teamId);
                    }
                },
                rethrow: false
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
                                <Paragraph className='font-size-2 font-weight-5 color-primary'>
                                    {integration.providerName}
                                </Paragraph>

                                <Container className='integrations-provider-row-actions d-flex items-center gap-025'>
                                    <Button
                                        size='sm'
                                        variant='ghost'
                                        intent='neutral'
                                        leftIcon={<Settings2 size={14} />}
                                        onClick={() => openEditProviderModal(integration)}
                                        disabled={isLoading}
                                    />
                                    <Button
                                        size='sm'
                                        variant='ghost'
                                        intent='danger'
                                        leftIcon={<Trash2 size={14} />}
                                        onClick={() => { handleRemoveProvider(integration.provider); }}
                                        isLoading={busyProvider === integration.provider}
                                        disabled={isLoading}
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
                            onClick={() => { handleSaveIntegration(); }}
                            isLoading={isSaving}
                            disabled={isSaving || !modalProvider}
                        >
                            Save
                        </Button>
                    </>
                )}
            >
                <Container className='p-1-5'>
                    <Container className='d-flex column gap-1'>
                        {!editingProvider ? (
                            <Container className='d-flex column gap-05'>
                                <Paragraph className='font-size-2 font-weight-5 color-secondary'>Provider</Paragraph>
                                <Select
                                    options={providerSelectOptions}
                                    value={modalProvider}
                                    onChange={handleModalProviderChange}
                                    disabled={providerSelectOptions.length === 0}
                                    placeholder='Select provider'
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
                                    placeholder='Model ID (e.g. gpt-4o)'
                                    value={newModelId}
                                    onChange={(event) => setNewModelId(event.target.value)}
                                    inputProps={{ onKeyDown: handleAddModelKeyDown }}
                                />
                                <FormFieldRHF
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
                            <Paragraph className='font-size-2 font-weight-5 color-secondary'>Default model</Paragraph>
                            <Select
                                options={modalModelOptions}
                                value={modalDefaultModel}
                                onChange={setModalDefaultModel}
                                disabled={modalModelOptions.length === 0}
                                placeholder={getDefaultModelPlaceholder(modalModelOptions)}
                            />
                        </Container>

                        <Container className='d-flex items-center content-between gap-05 integrations-modal-toggle'>
                            <Paragraph className='font-size-2 color-muted'>Enabled</Paragraph>
                            <LiquidToggle pressed={modalEnabled} onChange={setModalEnabled} />
                        </Container>
                    </Container>
                </Container>
            </Modal>
        </SettingsPage>
    );
}
