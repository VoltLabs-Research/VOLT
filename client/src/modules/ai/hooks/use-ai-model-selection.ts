import { useTeamAIIntegrationModelsQuery, useTeamAIIntegrationsQuery } from '@/modules/team/hooks/ai-integration/queries';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIModelSelection } from '@/modules/ai/api/service';
import type { AIProvider } from '@/modules/ai/api/entities/ai-provider';
import type { TeamAIModelListItem, TeamAIProviderModelsCatalog } from '@/modules/team/api/entities/ai-integration/team-ai-integration';

const createModelSelectionKey = (provider: AIProvider, modelId: string): string => (
    `${provider}::${modelId}`
);

const useAIModelSelection = (teamId: string | null) => {
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const selectedModelRef = useRef<AIModelSelection>({});

    const teamAIIntegrationsQuery = useTeamAIIntegrationsQuery(teamId ?? '', {
        enabled: Boolean(teamId)
    });

    const teamAIIntegrationModelsQuery = useTeamAIIntegrationModelsQuery(teamId ?? '', {
        enabled: Boolean(teamId)
    });

    const integrations = teamAIIntegrationsQuery.data?.integrations.map((integration) => ({
        provider: integration.provider,
        isEnabled: integration.isEnabled,
        hasApiKey: integration.hasApiKey
    })) ?? [];

    const providerCatalog: TeamAIProviderModelsCatalog[] = teamAIIntegrationModelsQuery.data?.providers ?? [];
    const isProviderCatalogLoading = teamAIIntegrationsQuery.isLoading || teamAIIntegrationModelsQuery.isLoading;
    let providerCatalogError: string | null = null;
    if (teamAIIntegrationsQuery.error || teamAIIntegrationModelsQuery.error) {
        providerCatalogError = 'Failed to load provider catalog.';
    }

    const enabledProviders = useMemo(() => {
        return new Set(
            integrations
                .filter((integration) => integration.isEnabled && integration.hasApiKey)
                .map((integration) => integration.provider)
        );
    }, [integrations]);

    const configuredProviderCatalog = useMemo(() => {
        return providerCatalog.filter((provider) => (
            enabledProviders.has(provider.provider) && provider.models.length > 0
        ));
    }, [enabledProviders, providerCatalog]);

    const availableModelsForProvider = useMemo<TeamAIModelListItem[]>(() => {
        return configuredProviderCatalog
            .flatMap((provider) => (
                provider.models.map((model) => ({
                    ...model,
                    provider: provider.provider,
                    providerName: provider.providerName,
                    isDefault: provider.defaultModel === model.id
                }))
            ))
            .sort((left, right) => {
                if (left.isDefault !== right.isDefault) {
                    let sortOrder = 1;

                    if (left.isDefault) {
                        sortOrder = -1;
                    }

                    return sortOrder;
                }

                if (left.providerName !== right.providerName) {
                    return left.providerName.localeCompare(right.providerName);
                }
                return left.name.localeCompare(right.name);
            });
    }, [configuredProviderCatalog]);

    const selectedModelDefinition = useMemo(() => {
        if (!selectedModel) return null;

        return availableModelsForProvider.find((model) => (
            createModelSelectionKey(model.provider, model.id) === selectedModel
        )) || null;
    }, [availableModelsForProvider, selectedModel]);

    const selectedProvider = selectedModelDefinition?.provider || null;

    const noProviderConfigured = Boolean(
        teamId
        && !isProviderCatalogLoading
        && configuredProviderCatalog.length === 0
    );

    const canSendMessage = Boolean(
        teamId
        && selectedModelDefinition
        && !noProviderConfigured
    );

    useEffect(() => {
        selectedModelRef.current = {
            provider: selectedModelDefinition?.provider,
            model: selectedModelDefinition?.id
        };
    }, [selectedModelDefinition?.id, selectedModelDefinition?.provider]);

    useEffect(() => {
        if (!availableModelsForProvider.length) {
            setSelectedModel(null);
            return;
        }

        setSelectedModel((currentModel) => {
            if (currentModel && availableModelsForProvider.some((model) => (
                createModelSelectionKey(model.provider, model.id) === currentModel
            ))) {
                return currentModel;
            }

            const defaultModel = availableModelsForProvider.find((model) => model.isDefault) || availableModelsForProvider[0];
            if (!defaultModel) return null;

            return createModelSelectionKey(defaultModel.provider, defaultModel.id);
        });
    }, [availableModelsForProvider]);

    const setSelectedProvider = useCallback((provider: AIProvider) => {
        const providerModels = availableModelsForProvider.filter((model) => model.provider === provider);
        if (!providerModels.length) {
            setSelectedModel(null);
            return;
        }

        const defaultModel = providerModels.find((model) => model.isDefault) || providerModels[0];
        setSelectedModel(createModelSelectionKey(defaultModel.provider, defaultModel.id));
    }, [availableModelsForProvider]);

    return {
        selectedModel,
        selectedProvider,
        selectedModelDefinition,
        configuredProviderCatalog,
        availableModelsForProvider,
        noProviderConfigured,
        canSendMessage,
        isProviderCatalogLoading,
        providerCatalogError,
        loadProviderCatalog: async () => {
            await Promise.all([
                teamAIIntegrationsQuery.refetch(),
                teamAIIntegrationModelsQuery.refetch()
            ]);
        },
        selectedModelRef,
        setSelectedModel,
        setSelectedProvider
    };
};

export default useAIModelSelection;
