import { getModelListingRoute } from './populated-model-routes';
import { isRecord } from '@/shared/utils/type-guards';
import Popover from '@/shared/presentation/primitives/Popover';
import './PopulatedCellPopover.css';
import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FC, MouseEvent, ReactNode } from 'react';

interface PopulatedCellPopoverProps {
    document: object | null;
    modelName: string;
    children: ReactNode;
    displayFields?: string[];
    labelMap?: Record<string, string>;
};

interface FieldEntry {
    key: string;
    label: string;
    value: string;
};

const numberFormatter = new Intl.NumberFormat();

/** Fields excluded from auto-detection by default. */
const EXCLUDED_FIELDS = new Set([
    '_id',
    '__v',
    'createdAt',
    'updatedAt',
    'password',
    'passwordChangedAt',
    '__t'
]);

/**
 * Resolves a display value from an arbitrary document field.
 * For nested objects, returns the object's `name` or `_id` as a string.
 */
const resolveFieldValue = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') return value;
    if (typeof value === 'number') return numberFormatter.format(value);
    if (typeof value === 'boolean') return value ? 'True' : 'False';

    if (Array.isArray(value)) {
        if (value.length === 0) return null;
        return `[${value.length} items]`;
    }

    if (isRecord(value)) {
        const obj = value;
        if (typeof obj.name === 'string') return obj.name;
        if (typeof obj._id === 'string') return obj._id;
        return null;
    }

    return null;
};

/**
 * Formats a raw field key into a human-readable label.
 * Converts camelCase to space-separated words with the first letter capitalized.
 */
const formatFieldLabel = (key: string): string => {
    const spaced = key.replace(/([A-Z])/g, ' $1');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/**
 * Generic popover wrapper for populated document cells.
 * Wraps its children in a clickable trigger that opens a popover
 * displaying the referenced document's key-value fields.
 *
 * @remarks
 * Uses `e.stopPropagation()` on click to prevent row-level event handlers
 * (selection, drag-and-drop, context menus) from firing.
 */
const PopulatedCellPopover: FC<PopulatedCellPopoverProps> = ({
    document: doc,
    modelName,
    children,
    displayFields,
    labelMap
}) => {
    const listingRoute = getModelListingRoute(modelName);
    const documentRecord = useMemo<Record<string, unknown> | null>(() => {
        if (!isRecord(doc)) {
            return null;
        }

        return doc;
    }, [doc]);

    const fields = useMemo<FieldEntry[]>(() => {
        if (!documentRecord) return [];

        const keys = displayFields ?? Object.keys(documentRecord).filter((k) => !EXCLUDED_FIELDS.has(k));

        const entries: FieldEntry[] = [];
        for (const key of keys) {
            const raw = documentRecord[key];
            const value = resolveFieldValue(raw);
            if (value === null) continue;

            const label = labelMap?.[key] ?? formatFieldLabel(key);
            entries.push({
                key,
                label,
                value
            });
        }

        return entries;
    }, [displayFields, documentRecord, labelMap]);

    if (!documentRecord) {
        return <>{children}</>;
    }

    const popoverId = `populated-cell-${modelName}-${String(documentRecord._id ?? 'unknown')}`;

    const trigger = (
        <button
            type='button'
            className='populated-cell-trigger d-inline-flex cursor-pointer'
            aria-haspopup='dialog'
            aria-controls={popoverId}
        >
            {children}
        </button>
    );

    const handleStopPropagation = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    const renderHeader = (close: () => void) => {
        const handleNavigate = (event: MouseEvent<HTMLAnchorElement>) => {
            event.stopPropagation();
            close();
        };

        return (
            <div className='populated-cell-popover-header d-flex items-center content-between p-05 gap-1'>
                <span className='font-size-1 color-secondary'>{modelName}</span>
                {listingRoute && (
                    <nav aria-label={`${modelName} links`}>
                        <Link
                            to={listingRoute}
                            className='populated-cell-popover-link d-flex items-center gap-025'
                            onClick={handleNavigate}
                        >
                            View in listing
                            <ArrowUpRight />
                        </Link>
                    </nav>
                )}
            </div>
        );
    };

    const renderField = (field: FieldEntry) => {
        return (
            <div key={field.key} className='populated-cell-popover-field d-flex items-start gap-05 p-025'>
                <dt className='populated-cell-popover-field-label'>{field.label}</dt>
                <dd className='populated-cell-popover-field-value' title={field.value}>{field.value}</dd>
            </div>
        );
    };

    return (
        <div className='d-inline-flex' onClick={handleStopPropagation}>
            <Popover id={popoverId} trigger={trigger} placement='bottom-start'>
                {(close: () => void) => (
                    <div className='d-flex column' role='dialog' aria-label={`${modelName} details`}>
                        {renderHeader(close)}
                        <div className='populated-cell-popover-body d-flex column'>
                            {fields.length > 0
                                ? <dl className='populated-cell-popover-fields m-0'>{fields.map(renderField)}</dl>
                                : <span className='font-size-1 color-muted p-05'>No fields to display</span>
                            }
                        </div>
                    </div>
                )}
            </Popover>
        </div>
    );
};

export default PopulatedCellPopover;
