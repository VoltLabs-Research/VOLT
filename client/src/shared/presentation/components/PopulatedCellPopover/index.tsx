import { getModelListingRoute } from './populated-model-routes';
import Popover from '@/shared/presentation/components/Popover';
import Container from '@/shared/presentation/components/Container';
import './PopulatedCellPopover.css';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import React from 'react';
import type { ReactNode } from 'react';

interface PopulatedCellPopoverProps {
    document: Record<string, unknown> | null;
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
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
        if (value.length === 0) return null;
        return `[${value.length} items]`;
    }

    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
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
const PopulatedCellPopover: React.FC<PopulatedCellPopoverProps> = ({
    document: doc,
    modelName,
    children,
    displayFields,
    labelMap
}) => {
    const navigate = useNavigate();
    const listingRoute = getModelListingRoute(modelName);

    const fields = useMemo<FieldEntry[]>(() => {
        if (!doc) return [];

        const keys = displayFields ?? Object.keys(doc).filter((k) => !EXCLUDED_FIELDS.has(k));

        const entries: FieldEntry[] = [];
        for (const key of keys) {
            const raw = doc[key];
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
    }, [doc, displayFields, labelMap]);

    if (!doc) {
        return <>{children}</>;
    }

    const popoverId = `populated-cell-${modelName}-${String(doc._id ?? 'unknown')}`;

    const trigger = (
        <span className='d-inline-flex'>{children}</span>
    );

    const handleStopPropagation = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const renderHeader = (close: () => void) => {
        const handleNavigate = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!listingRoute) return;
            close();
            navigate(listingRoute);
        };

        return (
            <Container className='populated-cell-popover-header d-flex items-center content-between p-05 gap-1'>
                <span className='font-size-1 color-secondary'>{modelName}</span>
                {listingRoute && (
                    <button
                        type='button'
                        className='populated-cell-popover-link d-flex items-center gap-025 cursor-pointer'
                        onClick={handleNavigate}
                    >
                        View in listing
                        <ArrowUpRight />
                    </button>
                )}
            </Container>
        );
    };

    const renderField = (field: FieldEntry) => {
        return (
            <Container key={field.key} className='d-flex items-center gap-05 p-025'>
                <span className='populated-cell-popover-field-label'>{field.label}</span>
                <span className='populated-cell-popover-field-value' title={field.value}>{field.value}</span>
            </Container>
        );
    };

    return (
        <Container className='populated-cell-trigger d-inline-flex cursor-pointer' onClick={handleStopPropagation}>
            <Popover id={popoverId} trigger={trigger} placement='bottom-start'>
                {(close: () => void) => (
                    <>
                        {renderHeader(close)}
                        <Container className='populated-cell-popover-body d-flex column'>
                            {fields.length > 0
                                ? fields.map(renderField)
                                : <span className='font-size-1 color-muted p-05'>No fields to display</span>
                            }
                        </Container>
                    </>
                )}
            </Popover>
        </Container>
    );
};

export default PopulatedCellPopover;
