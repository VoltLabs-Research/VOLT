import { AIMessageArtifactKind } from '@volt/contracts/modules/ai/domain';
import { parseTableFromChildren } from '@/modules/ai/utils/message-content';
import {
    MD_TABLE,
    MD_TABLE_OPEN_BUTTON,
    MD_TABLE_SCROLL,
    MD_TABLE_WRAPPER
} from '@/modules/ai/components/AIConversationThread/thread-styles';
import { Button, cn } from '@heroui/react';
import { Expand } from 'lucide-react';
import type { AIMessageArtifact } from '@volt/contracts/modules/ai/domain';
import type { ComponentPropsWithoutRef } from 'react';

type MarkdownTableProps = ComponentPropsWithoutRef<'table'>;

/**
 * ReactMarkdown component overrides that turn every rendered markdown table into an
 * openable spreadsheet artifact. Table indices are per message, so a factory is needed.
 */
export const createTableArtifactComponents = (
    messageId: string,
    onOpenTableArtifact: (artifact: AIMessageArtifact) => void
) => {
    let tableIndex = 0;

    return {
        table: ({ children, className, ...props }: MarkdownTableProps) => {
            const parsed = children ? parseTableFromChildren(children) : null;
            const artifactId = `md-table:${messageId}:${tableIndex}`;
            tableIndex += 1;

            const handleOpen = () => {
                if (!parsed) return;

                onOpenTableArtifact({
                    id: artifactId,
                    messageId,
                    kind: AIMessageArtifactKind.Table,
                    title: 'Table',
                    payload: {
                        columns: parsed.columns,
                        rows: parsed.rows
                    }
                });
            };

            return (
                <div className={MD_TABLE_WRAPPER}>
                    <div className={MD_TABLE_SCROLL}>
                        <table {...props} className={cn(MD_TABLE, className)}>{children}</table>
                    </div>
                    {parsed && parsed.rows.length > 0 && (
                        <Button
                            type='button'
                            size='sm'
                            variant='secondary'
                            fullWidth
                            className={MD_TABLE_OPEN_BUTTON}
                            onPress={handleOpen}
                        >
                            <Expand size={13} />
                            Open spreadsheet
                        </Button>
                    )}
                </div>
            );
        }
    };
};
