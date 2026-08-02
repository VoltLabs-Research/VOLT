import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
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
        {([
            ['Unable to load AI providers', providerCatalogError, loadProviderCatalog],
            ['Unable to load conversations', conversationsError, loadConversations]
        ] as const).map(([title, description, retry]) => description && (
            <Box key={title} className={className}>
                <RecoveryState
                    title={title}
                    description={description}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => {
                        retry().catch(() => undefined);
                    }}
                />
            </Box>
        ))}
    </>
);

export default AIConversationAlerts;
