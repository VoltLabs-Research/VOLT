import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import { Box } from '@voltstack/bravais';

interface AIConversationAlertsProps {
    className: string;
    providerCatalogError?: string | null;
    conversationsError?: string | null;
    loadProviderCatalog: () => Promise<unknown>;
    loadConversations: () => Promise<unknown>;
}

const AIConversationAlerts = ({
    className,
    providerCatalogError,
    conversationsError,
    loadProviderCatalog,
    loadConversations
}: AIConversationAlertsProps) => (
    <>
        {providerCatalogError && (
            <Box className={className}>
                <RecoveryState
                    title='Unable to load AI providers'
                    description={providerCatalogError}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => {
                        loadProviderCatalog().catch(() => undefined);
                    }}
                />
            </Box>
        )}
        {conversationsError && (
            <Box className={className}>
                <RecoveryState
                    title='Unable to load conversations'
                    description={conversationsError}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => {
                        loadConversations().catch(() => undefined);
                    }}
                />
            </Box>
        )}
    </>
);

export default AIConversationAlerts;
