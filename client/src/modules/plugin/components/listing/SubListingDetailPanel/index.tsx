import { X, Copy, Check } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button, cn } from '@heroui/react';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { renderExpandedValue } from '@/modules/plugin/components/listing/SubListingDetailPanel/expandedRenderers';
import { inferCellKind, type InferredCellKind } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';

interface SubListingDetailColumn {
    key?: string;
    title?: string;
    label?: string;
    path?: string;
}

interface SubListingDetailPanelProps {
    row: Record<string, unknown> | null;
    columns: SubListingDetailColumn[];
    onClose: () => void;
}

const FULL_WIDTH_KINDS: ReadonlySet<InferredCellKind> = new Set<InferredCellKind>([
    'vector', 'numberArray', 'points', 'matrix', 'object', 'mixed'
]);

const COPY_FEEDBACK_MS = 1400;

const RECORD_COPY_KEY = '\u0000record';

const resolveRowIdentifier = (row: Record<string, unknown>): string | null => {
    const candidate = row._id ?? row.id;
    if(typeof candidate === 'string' || typeof candidate === 'number'){
        return String(candidate);
    }
    return null;
};

const shortenIdentifier = (id: string): string => {
    if(id.includes(':')){
        const parts = id.split(':').filter(Boolean);
        if(parts.length >= 2){
            return `${parts[parts.length - 2]}:${parts[parts.length - 1]}`;
        }
    }
    if(id.length > 18){
        return `${id.slice(0, 6)}…${id.slice(-6)}`;
    }
    return id;
};

const SubListingDetailPanel = ({ row, columns, onClose }: SubListingDetailPanelProps) => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const handleCopy = useCallback(async (key: string, value: unknown) => {
        const ok = await copyTextToClipboard(JSON.stringify(value) ?? String(value));
        if(!ok) return;
        setCopiedKey(key);
        setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), COPY_FEEDBACK_MS);
    }, []);

    const fields = useMemo(() => {
        if(!row) return [];
        return columns.map((column) => {
            const key = column.key ?? column.path ?? '';
            const value = row[key];
            const kind = inferCellKind(value);
            return {
                key,
                title: column.title ?? column.label ?? key,
                value,
                kind,
                isFullWidth: FULL_WIDTH_KINDS.has(kind)
            };
        });
    }, [columns, row]);

    if(!row){
        return null;
    }

    const identifier = resolveRowIdentifier(row);
    const shortId = identifier ? shortenIdentifier(identifier) : null;
    const recordCopied = copiedKey === RECORD_COPY_KEY;

    return (
        <aside className='flex h-full min-h-0 flex-col bg-surface' aria-label='Row detail'>
            <header className='flex shrink-0 flex-row items-center justify-between gap-2 border-b border-border px-3.5 py-2.5'>
                {shortId ? (
                    <span
                        className='min-w-0 overflow-hidden whitespace-nowrap text-ellipsis text-xs font-medium text-foreground'
                        title={identifier ?? undefined}
                    >
                        {shortId}
                    </span>
                ) : (
                    <span className='text-xs font-medium text-muted'>Record</span>
                )}
                <div className='flex shrink-0 flex-row gap-0.5'>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='ghost'
                        onPress={() => handleCopy(RECORD_COPY_KEY, row)}
                        aria-label={recordCopied ? 'Copied JSON' : 'Copy record as JSON'}
                    >
                        {recordCopied ? <Check size={14} aria-hidden='true' /> : <Copy size={14} aria-hidden='true' />}
                    </Button>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='ghost'
                        onPress={onClose}
                        aria-label='Close detail panel'
                    >
                        <X size={14} aria-hidden='true' />
                    </Button>
                </div>
            </header>
            <div className='grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(140px,1fr))] content-start gap-x-5 gap-y-4 overflow-y-auto overflow-x-hidden p-3.5'>
                {fields.map((field) => {
                    const copiedThisField = copiedKey === field.key;

                    return (
                        <section
                            key={field.key}
                            className={cn('group flex min-w-0 flex-col gap-1', field.isFullWidth ? 'col-span-full' : null)}
                        >
                            <div className='flex min-w-0 flex-row items-center justify-between gap-1.5'>
                                <div
                                    className='min-w-0 overflow-hidden whitespace-nowrap text-ellipsis text-2xs font-medium text-muted'
                                    title={field.title}
                                >
                                    {field.title}
                                </div>
                                <button
                                    type='button'
                                    className='inline-flex size-4 shrink-0 cursor-pointer flex-row items-center justify-center rounded-sm border-0 bg-transparent p-0 text-muted opacity-0 transition-[opacity,color] duration-[120ms] ease-out hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100'
                                    onClick={() => handleCopy(field.key, field.value)}
                                    aria-label={copiedThisField ? 'Copied' : `Copy ${field.title}`}
                                    title={copiedThisField ? 'Copied' : 'Copy value'}
                                >
                                    {copiedThisField ? <Check size={11} aria-hidden='true' /> : <Copy size={11} aria-hidden='true' />}
                                </button>
                            </div>
                            <div className={cn('min-w-0 text-sm leading-[1.4] text-foreground [overflow-wrap:anywhere]', field.isFullWidth ? null : 'font-medium break-words')}>
                                {renderExpandedValue(field.value)}
                            </div>
                        </section>
                    );
                })}
            </div>
        </aside>
    );
};

export default SubListingDetailPanel;
