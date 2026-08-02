import {
    invalidateTeamAIIntegrationsQuery,
    useCreateTeamAIIntegrationMutation,
    useDeleteTeamAIIntegrationMutation,
    useTeamAIIntegrationsQuery,
    useUpdateTeamAIIntegrationMutation
} from '@/modules/team/hooks/ai-integration/queries';
import useTeamAIIntegrationsSocketSync from '@/modules/team/hooks/ai-integration/use-team-ai-integrations-socket-sync';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { runAction } from '@/shared/ui/actions/run-action';
import { confirm, ConfirmActionTone } from '@/shared/ui/hooks/use-confirm';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { AIProvider } from '@volt/contracts/modules/ai/domain';
import type { TeamAIIntegration, TeamAIModelMetadata } from '@volt/contracts/modules/team/domain';
import type { TeamAIIntegrationMutationInput } from '@volt/contracts/modules/team/http';
import { useEffect, useState } from 'react';
import { sileo } from 'sileo';

export const TEAM_AI_INTEGRATION_MODAL_ID = 'team-ai-integration-modal';
export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';

const AI_PROVIDER_VALUES = Object.values(AIProvider);

export interface IntegrationDraft {
    editingProvider: AIProvider | null;
    provider: AIProvider | null;
    apiKey: string;
    endpoint: string;
    defaultModel: string | null;
    enabledModels: TeamAIModelMetadata[];
    isEnabled: boolean;
}

const EMPTY_DRAFT: IntegrationDraft = {
    editingProvider: null,
    provider: null,
    apiKey: '',
    endpoint: '',
    defaultModel: null,
    enabledModels: [],
    isEnabled: true
};

const isAIProvider = (value: string): value is AIProvider => {
    return AI_PROVIDER_VALUES.some((provider) => provider === value);
};

// `TeamAIIntegration.metadata` is an untyped bag in the contract, so `baseUrl` has to be probed.
const resolveEndpoint = (provider: AIProvider | null, metadata?: Record<string, unknown>): string => {
    if (typeof metadata?.baseUrl === 'string') {
        return metadata.baseUrl;
    }
    return provider === 'ollama' ? OLLAMA_DEFAULT_BASE_URL : '';
};

const getSaveToastOptions = (isUpdate: boolean) => createPromiseToastOptions({
    loading: isUpdate ? 'Updating provider...' : 'Creating provider...',
    success: isUpdate ? 'Provider configuration updated' : 'Provider configuration created',
    error: isUpdate ? 'Failed to update provider' : 'Failed to create provider'
});

const getRemoveToastOptions = (providerName: string) => createPromiseToastOptions({
    loading: `Removing ${providerName}...`,
    success: `${providerName} removed`,
    error: 'Failed to remove provider'
});

export default function useTeamAIIntegrationsSettings() {
    const teamId = useSelectedTeamId() ?? '';

    const {
        data: integrationsData,
        isLoading,
        error: integrationsError
    } = useTeamAIIntegrationsQuery(teamId, { enabled: !!teamId });

    const createMutation = useCreateTeamAIIntegrationMutation();
    const updateMutation = useUpdateTeamAIIntegrationMutation();
    const deleteMutation = useDeleteTeamAIIntegrationMutation();

    const [isSaving, setIsSaving] = useState(false);
    const [busyProvider, setBusyProvider] = useState<AIProvider | null>(null);
    const [draft, setDraft] = useState<IntegrationDraft>(EMPTY_DRAFT);

    useTeamAIIntegrationsSocketSync(teamId || null);

    useEffect(() => {
        if (!integrationsError) return;
        reportError(integrationsError, {
            surface: ErrorSurface.Toast,
            fallbackTitle: 'Failed to load integrations'
        });
    }, [integrationsError]);

    const integrations: TeamAIIntegration[] = integrationsData?.integrations ?? [];
    const providerCatalog = integrationsData?.providers ?? [];

    const integrationsByProvider = new Map(integrations.map((integration) => [integration.provider, integration]));
    const configuredIntegrations = integrations.filter((integration) => integration.hasApiKey);

    const availableProviders = providerCatalog.filter((provider) => {
        if (!isAIProvider(provider.id)) {
            return false;
        }

        return !integrationsByProvider.get(provider.id)?.hasApiKey;
    });

    const openCreateDraft = () => {
        if (!teamId) {
            return;
        }

        const firstProviderId = availableProviders[0]?.id;
        if (!firstProviderId || !isAIProvider(firstProviderId)) {
            sileo.info({ title: 'All providers are already configured' });
            return;
        }

        setDraft({
            ...EMPTY_DRAFT,
            provider: firstProviderId,
            endpoint: resolveEndpoint(firstProviderId)
        });
    };

    const openEditDraft = (integration: TeamAIIntegration) => {
        setDraft({
            ...EMPTY_DRAFT,
            editingProvider: integration.provider,
            provider: integration.provider,
            endpoint: resolveEndpoint(integration.provider, integration.metadata),
            isEnabled: integration.isEnabled,
            enabledModels: integration.enabledModels ?? [],
            defaultModel: integration.defaultModel ?? null
        });
    };

    const changeDraftProvider = (provider: string) => {
        if (!isAIProvider(provider)) {
            return;
        }

        setDraft((current) => ({
            ...current,
            provider,
            apiKey: '',
            endpoint: resolveEndpoint(provider, integrationsByProvider.get(provider)?.metadata)
        }));
    };

    const saveDraft = async () => {
        if (!draft.provider) {
            sileo.error({ title: 'Choose a provider' });
            return;
        }

        const provider = draft.provider;
        const integration = integrationsByProvider.get(provider);
        const apiKey = draft.apiKey.trim();
        const endpoint = draft.endpoint.trim();

        if (!integration && provider !== 'ollama' && !apiKey) {
            sileo.error({ title: 'API key is required for new providers' });
            return;
        }
        if (provider === 'ollama' && !endpoint) {
            sileo.error({ title: 'Endpoint URL is required for Ollama' });
            return;
        }

        const payload: TeamAIIntegrationMutationInput = {
            isEnabled: draft.isEnabled,
            defaultModel: draft.defaultModel?.trim() || undefined,
            enabledModels: draft.enabledModels,
            metadata: endpoint ? { baseUrl: endpoint } : {}
        };

        if (apiKey) {
            payload.apiKey = apiKey;
        }

        setIsSaving(true);
        try {
            await runAction({
                action: () => (integration ? updateMutation : createMutation).mutateAsync({
                    teamId,
                    provider,
                    ...payload
                }),
                toast: getSaveToastOptions(!!integration),
                modalId: TEAM_AI_INTEGRATION_MODAL_ID,
                afterSuccess: async () => {
                    setDraft(EMPTY_DRAFT);
                    if (teamId) {
                        await invalidateTeamAIIntegrationsQuery(teamId);
                    }
                }
            });
        } finally {
            setIsSaving(false);
        }
    };

    const removeIntegration = async (provider: AIProvider) => {
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
                action: () => deleteMutation.mutateAsync({
                    teamId,
                    provider
                }),
                toast: getRemoveToastOptions(integration.providerName),
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

    return {
        teamId,
        isLoading,
        integrationsError,
        configuredIntegrations,
        availableProviders,
        integrationsByProvider,
        draft,
        setDraft,
        isSaving,
        busyProvider,
        openCreateDraft,
        openEditDraft,
        changeDraftProvider,
        saveDraft,
        removeIntegration
    };
}
