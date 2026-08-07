import { Button, Stack, Text, openModal } from '@voltstack/bravais';
import { invalidateTeamAIIntegrationsQuery } from '@/modules/team/hooks/ai-integration/queries';
import useTeamAIIntegrationsSettings, { TEAM_AI_INTEGRATION_MODAL_ID } from '@/modules/team/hooks/ai-integration/use-team-ai-integrations-settings';
import IntegrationFormModal from './IntegrationFormModal';
import ProviderList from './ProviderList';
import SettingsPage from '@/shared/ui/components/SettingsPage';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import useTip from '@/shared/tips/use-tip';
import { IoAddOutline } from 'react-icons/io5';
import type { TeamAIIntegration } from '@volt/contracts/modules/team/domain';
import './IntegrationsSettings.css';

export default function IntegrationsSettings() {
    useTip('team-integrations');

    const {
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
    } = useTeamAIIntegrationsSettings();

    const handleCreateProvider = () => {
        openCreateDraft();
        openModal(TEAM_AI_INTEGRATION_MODAL_ID);
    };

    const handleConfigureProvider = (integration: TeamAIIntegration) => {
        openEditDraft(integration);
        openModal(TEAM_AI_INTEGRATION_MODAL_ID);
    };

    return (
        <SettingsPage title='Integrations'>
            <Stack border='soft' gap='1' p='1-5' radius='md'>
                <SettingsSectionHeader
                    title='AI Providers'
                    description='Manage API keys and models shared across your team.'
                    action={(
                        <Button
                            size='sm'
                            variant='solid'
                            intent='white'
                            className='rounded-full'
                            leftIcon={<IoAddOutline size={14} />}
                            onClick={handleCreateProvider}
                            disabled={!teamId || availableProviders.length === 0}
                        >
                            Connect
                        </Button>
                    )}
                />

                {!teamId ? (
                    <Text as='p' size='md' tone='muted'>
                        Select a team to manage integrations.
                    </Text>
                ) : (
                    <ProviderList
                        integrations={configuredIntegrations}
                        isLoading={isLoading}
                        hasError={!!integrationsError}
                        busyProvider={busyProvider}
                        onConfigure={handleConfigureProvider}
                        onRemove={removeIntegration}
                        onRetry={() => invalidateTeamAIIntegrationsQuery(teamId)}
                    />
                )}
            </Stack>

            <IntegrationFormModal
                draft={draft}
                setDraft={setDraft}
                availableProviders={availableProviders}
                integrationsByProvider={integrationsByProvider}
                isSaving={isSaving}
                onProviderChange={changeDraftProvider}
                onSave={saveDraft}
            />
        </SettingsPage>
    );
}
