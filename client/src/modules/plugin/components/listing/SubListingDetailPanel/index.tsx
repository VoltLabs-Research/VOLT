import { X, Copy, Check } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { IconButton } from '@voltstack/bravais';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { renderExpandedValue } from '@/modules/plugin/components/listing/SubListingDetailPanel/expandedRenderers';
import { inferCellKind, type InferredCellKind } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import './SubListingDetailPanel.css';

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
        <aside className='plugin-sub-listing-detail' aria-label='Row detail'>
            <header className='plugin-sub-listing-detail__header'>
                {shortId ? (
                    <span
                        className='plugin-sub-listing-detail__id-chip'
                        title={identifier ?? undefined}
                    >
                        {shortId}
                    </span>
                ) : (
                    <span className='plugin-sub-listing-detail__title-fallback'>Record</span>
                )}
                <div className='plugin-sub-listing-detail__actions'>
                    <IconButton
                        size='sm'
                        variant='ghost'
                        onClick={() => handleCopy(RECORD_COPY_KEY, row)}
                        aria-label={recordCopied ? 'Copied JSON' : 'Copy record as JSON'}
                        title={recordCopied ? 'Copied!' : 'Copy record JSON'}
                    >
                        {recordCopied ? <Check size={14} /> : <Copy size={14} />}
                    </IconButton>
                    <IconButton
                        size='sm'
                        variant='ghost'
                        onClick={onClose}
                        aria-label='Close detail panel'
                    >
                        <X size={14} />
                    </IconButton>
                </div>
            </header>
            <div className='plugin-sub-listing-detail__body'>
                {fields.map((field) => {
                    const fieldClassName = [
                        'plugin-sub-listing-detail__field',
                        field.isFullWidth
                            ? 'plugin-sub-listing-detail__field--full'
                            : 'plugin-sub-listing-detail__field--compact',
                        `plugin-sub-listing-detail__field--kind-${field.kind}`
                    ].join(' ');
                    const copiedThisField = copiedKey === field.key;

                    return (
                        <section key={field.key} className={fieldClassName}>
                            <div className='plugin-sub-listing-detail__field-head'>
                                <div className='plugin-sub-listing-detail__field-label' title={field.title}>
                                    {field.title}
                                </div>
                                <button
                                    type='button'
                                    className='plugin-sub-listing-detail__field-copy'
                                    onClick={() => handleCopy(field.key, field.value)}
                                    aria-label={copiedThisField ? 'Copied' : `Copy ${field.title}`}
                                    title={copiedThisField ? 'Copied' : 'Copy value'}
                                >
                                    {copiedThisField ? <Check size={11} /> : <Copy size={11} />}
                                </button>
                            </div>
                            <div className='plugin-sub-listing-detail__field-value'>
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
