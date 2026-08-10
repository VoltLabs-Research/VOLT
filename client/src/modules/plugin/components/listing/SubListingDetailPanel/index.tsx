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

// No column key can hold a NUL byte, so the whole record gets its own slot.
const RECORD_COPY_KEY = '\u0000record';

/*
 * `--glass-bg` / `--glass-border` were already flattened onto a solid surface with a
 * real border before this migration (spec §3a), and the shim resolves `--glass-blur`
 * to `none` — so this panel's `backdrop-filter` was already inert and is dropped
 * rather than translated. The one *live* blur in this component is the points
 * table's own literal `blur(12px)`, which survives as `backdrop-blur-md` in
 * `expandedRenderers`.
 */
const PANEL_CLASS = 'flex h-full min-h-0 flex-col bg-surface';
const HEADER_CLASS = 'flex shrink-0 flex-row items-center justify-between gap-2 border-b border-border px-3.5 py-2.5';
const BODY_CLASS = 'grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(140px,1fr))] content-start gap-x-5 gap-y-[1.1rem] overflow-y-auto overflow-x-hidden p-3.5';

/**
 * `group` is what replaces `.plugin-sub-listing-detail__field:hover
 * .plugin-sub-listing-detail__field-copy`: the reveal was a descendant selector off
 * the section, so it becomes a `group-hover:` on the button itself.
 */
const FIELD_CLASS = 'group flex min-w-0 flex-col gap-1';
const FIELD_COPY_CLASS = 'inline-flex size-4 shrink-0 cursor-pointer flex-row items-center justify-center rounded-[3px] border-0 bg-transparent p-0 text-muted opacity-0 transition-[opacity,color] duration-[120ms] ease-out hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100';
const FIELD_VALUE_CLASS = 'min-w-0 text-sm leading-[1.4] text-foreground [overflow-wrap:anywhere]';

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
        <aside className={PANEL_CLASS} aria-label='Row detail'>
            <header className={HEADER_CLASS}>
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
                <div className='flex shrink-0 flex-row gap-[0.15rem]'>
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
            <div className={BODY_CLASS}>
                {fields.map((field) => {
                    const copiedThisField = copiedKey === field.key;

                    return (
                        <section
                            key={field.key}
                            className={cn(FIELD_CLASS, field.isFullWidth ? 'col-span-full' : null)}
                        >
                            <div className='flex min-w-0 flex-row items-center justify-between gap-[0.35rem]'>
                                <div
                                    className='min-w-0 overflow-hidden whitespace-nowrap text-ellipsis text-[0.6875rem] font-medium text-muted'
                                    title={field.title}
                                >
                                    {field.title}
                                </div>
                                <button
                                    type='button'
                                    className={FIELD_COPY_CLASS}
                                    onClick={() => handleCopy(field.key, field.value)}
                                    aria-label={copiedThisField ? 'Copied' : `Copy ${field.title}`}
                                    title={copiedThisField ? 'Copied' : 'Copy value'}
                                >
                                    {copiedThisField ? <Check size={11} aria-hidden='true' /> : <Copy size={11} aria-hidden='true' />}
                                </button>
                            </div>
                            {/* `--compact` was the *non*-full-width branch: it added weight and a word break. */}
                            <div className={cn(FIELD_VALUE_CLASS, field.isFullWidth ? null : 'font-medium break-words')}>
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
