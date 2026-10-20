import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';

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
            <div className={className} key={title}>
                <RecoveryState
                    title={title}
                    description={description}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => {
                        retry().catch(() => undefined);
                    }}
                />
            </div>
        ))}
    </>
);

export default AIConversationAlerts;
