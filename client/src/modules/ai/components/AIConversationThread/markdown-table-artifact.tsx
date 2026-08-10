import { AIMessageArtifactKind } from '@volt/contracts/modules/ai/domain';
import { parseTableFromChildren } from '@/modules/ai/utils/message-content';
import { Button } from '@voltstack/bravais';
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
        table: ({ children, ...props }: MarkdownTableProps) => {
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
                <div className='ai-md-table-wrapper'>
                    <div className='ai-md-table-scroll'>
                        <table {...props}>{children}</table>
                    </div>
                    {parsed && parsed.rows.length > 0 && (
                        <Button
                            type='button'
                            size='sm'
                            variant='soft'
                            intent='brand'
                            shape='square'
                            block
                            align='start'
                            className='ai-open-spreadsheet-btn'
                            leftIcon={<Expand size={13} />}
                            onClick={handleOpen}
                        >
                            Open spreadsheet
                        </Button>
                    )}
                </div>
            );
        }
    };
};
