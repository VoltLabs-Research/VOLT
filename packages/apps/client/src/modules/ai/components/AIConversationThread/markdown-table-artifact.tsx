import { parseTableFromChildren } from '@/modules/ai/utils/message-content';
import { Button, cn } from '@heroui/react';
import type { AITableArtifact } from '@/modules/ai/contracts/artifacts';
import type { ComponentPropsWithoutRef } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

type MarkdownTableProps = ComponentPropsWithoutRef<'table'>;

export const createTableArtifactComponents = (
    messageId: string,
    onOpenTableArtifact: (artifact: AITableArtifact) => void
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
                    title: 'Table',
                    columns: parsed.columns,
                    rows: parsed.rows
                });
            };

            return (
                <div className='my-2.5 overflow-hidden rounded-xl border border-foreground/8'>
                    <Scrollable orientation='horizontal'>
                        <table {...props} className={cn('m-0! rounded-none! border-0!', className)}>{children}</table>
                    </Scrollable>
                    {parsed && parsed.rows.length > 0 && (
                        <Button
                            type='button'
                            size='sm'
                            variant='ghost'
                            fullWidth
                            className='justify-start rounded-none border-t border-foreground/8 px-2.5 text-muted hover:text-foreground'
                            onPress={handleOpen}
                        >
                            Open spreadsheet
                        </Button>
                    )}
                </div>
            );
        }
    };
};
