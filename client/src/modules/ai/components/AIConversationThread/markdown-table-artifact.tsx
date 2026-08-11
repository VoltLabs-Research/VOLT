import { AIMessageArtifactKind } from '@volt/contracts/modules/ai/domain';
import { parseTableFromChildren } from '@/modules/ai/utils/message-content';
import { Button, cn } from '@heroui/react';
import { Expand } from 'lucide-react';
import type { AIMessageArtifact } from '@volt/contracts/modules/ai/domain';
import type { ComponentPropsWithoutRef } from 'react';

type MarkdownTableProps = ComponentPropsWithoutRef<'table'>;

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
                <div className='my-[0.4rem] overflow-hidden rounded-lg border border-border'>
                    <div className='overflow-x-auto'>
                        <table {...props} className={cn('m-0! rounded-none! border-0!', className)}>{children}</table>
                    </div>
                    {parsed && parsed.rows.length > 0 && (
                        <Button
                            type='button'
                            size='sm'
                            variant='secondary'
                            fullWidth
                            className='w-full justify-start rounded-none border-0 border-t border-border'
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
