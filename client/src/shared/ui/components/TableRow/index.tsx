import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import {
    LISTING_CELL_CLASS_NAMES,
    LISTING_CELL_CONTENT,
    LISTING_CELL_NUMERIC,
    LISTING_CELL_VALUE_IN_CONTENT,
    LISTING_DRAG_HANDLE_CLASS_NAMES,
    LISTING_ROW_CLASS_NAMES,
    LISTING_ROW_DRAGGING,
    LISTING_ROW_DRAG_OVER,
    LISTING_ROW_SELECTED
} from '@/shared/ui/components/DocumentListingTable/listing-chrome';
import { cn } from '@heroui/react';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { Identifiable } from '@/shared/contracts/entity';
import type { MenuOption } from '@/shared/contracts/menu';
import { formatUnknownValue } from '@/shared/utils/format';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';

interface TableRowProps<T extends Identifiable> {
    item: T;
    columns: ColumnConfig<T>[];
    columnStyles: CSSProperties[];
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
    selectedItems: T[];
    isSelected: boolean;
    onClick: (event: MouseEvent | KeyboardEvent, item: T) => void;
    onItemClick?: (item: T, event: MouseEvent) => boolean;
    onContextMenu: (item: T) => void;
    columnGap?: number;
    draggableId?: string | null;
    droppableId?: string | null;

    /**
     * Density used to come from `.document-listing-table-container.is-compact`
     * matching every descendant; without a stylesheet the row has to be told.
     */
    compact?: boolean;
};

const TableRow = <T extends Identifiable>({
    item,
    columns,
    columnStyles,
    getMenuOptions,
    selectedItems,
    isSelected,
    onClick,
    onItemClick,
    onContextMenu,
    columnGap = 16,
    draggableId = null,
    droppableId = null,
    compact = false
}: TableRowProps<T>) => {
    const isInteractiveTarget = (event: MouseEvent<HTMLDivElement>): boolean => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return false;
        }

        return Boolean(target.closest(
            'button, a, input, textarea, select, option, summary, [role="button"], [role="menuitem"], [data-row-click-ignore="true"]'
        ));
    };

    const shouldRunPrimaryItemAction = (event: MouseEvent<HTMLDivElement>): boolean => {
        if (event.defaultPrevented || isInteractiveTarget(event)) {
            return false;
        }

        return event.button === 0
            && !event.ctrlKey
            && !event.metaKey
            && !event.shiftKey
            && !event.altKey;
    };

    const density = compact ? 'compact' : 'default';
    const menuOptions = getMenuOptions ? getMenuOptions(item, selectedItems) : [];
    const itemRecord = item as Record<string, unknown>;
    const getColumnKey = (col: ColumnConfig<T>): string => col.key ?? col.path ?? '';
    const getColumnTitle = (col: ColumnConfig<T>): string => col.title ?? col.label ?? col.key ?? col.path ?? '';
    const {
        attributes,
        listeners,
        setNodeRef: setDraggableNodeRef,
        setActivatorNodeRef,
        transform,
        isDragging
    } = useDraggable({
        id: draggableId ?? `document-listing-row-disabled-draggable:${item._id}`,
        disabled: !draggableId
    });
    const {
        setNodeRef: setDroppableNodeRef,
        isOver
    } = useDroppable({
        id: droppableId ?? `document-listing-row-disabled-droppable:${item._id}`,
        disabled: !droppableId
    });

    const rowStyle: CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: `${columnGap}px`,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 10 : undefined
    };

    const setRowNodeRef = (node: HTMLDivElement | null) => {
        setDraggableNodeRef(node);
        setDroppableNodeRef(node);
    };

    const rowClassName = cn(
        LISTING_ROW_CLASS_NAMES[density],
        isSelected && LISTING_ROW_SELECTED,
        isDragging && LISTING_ROW_DRAGGING,
        isOver && LISTING_ROW_DRAG_OVER
    );

    const dragListeners = draggableId ? listeners : undefined;
    const dragAttributes = draggableId ? attributes : undefined;

    const renderDragHandle = () => {
        if (!draggableId) {
            return null;
        }

        return (
            <button
                type='button'
                ref={setActivatorNodeRef}
                className={LISTING_DRAG_HANDLE_CLASS_NAMES[density]}
                aria-label='Drag flex-row'
                data-row-click-ignore='true'
                {...dragAttributes}
                {...dragListeners}
            >
                <GripVertical size={14} strokeWidth={1.8} aria-hidden='true' />
            </button>
        );
    };

    const renderCellContent = (col: ColumnConfig<T>, cellValue: unknown) => {
        const formattedCellValue = formatUnknownValue(cellValue);
        return col.render ? col.render(cellValue, item) : formattedCellValue;
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        onClick(event, item);
    };

    const content = (
        <motion.div
            role='row'
            tabIndex={0}
            ref={setRowNodeRef}
            style={rowStyle}
            className={rowClassName}
            transition={{ duration: 0.1 }}
            onClick={(event) => {
                if (isInteractiveTarget(event)) {
                    return;
                }

                const isHandled = shouldRunPrimaryItemAction(event)
                    ? onItemClick?.(item, event)
                    : false;

                if (isHandled) {
                    return;
                }

                onClick(event, item);
            }}
            onKeyDown={handleKeyDown}
            onContextMenu={() => onContextMenu(item)}
            aria-selected={isSelected}
        >
            {columns.map((col, colIdx) => {
                const columnKey = getColumnKey(col);
                const cellValue = itemRecord?.[columnKey];
                const title = formatUnknownValue(cellValue);
                const columnTitle = getColumnTitle(col);

                const cellClassName = cn(
                    LISTING_CELL_CLASS_NAMES[density],
                    col.numeric && LISTING_CELL_NUMERIC
                );
                return (
                    <div className={cellClassName} data-label={columnTitle} key={`cell-${columnTitle}-${colIdx}`} title={title} role='gridcell' aria-label={title ? `${columnTitle}: ${title}` : `${columnTitle}: no value`} style={columnStyles[colIdx]}>
                        {colIdx === 0 && draggableId ? (
                            <span className={LISTING_CELL_CONTENT}>
                                {renderDragHandle()}
                                <span className={LISTING_CELL_VALUE_IN_CONTENT}>
                                    {renderCellContent(col, cellValue)}
                                </span>
                            </span>
                        ) : (
                            <span>
                                {renderCellContent(col, cellValue)}
                            </span>
                        )}
                    </div>
                );
            })}
        </motion.div>
    );

    if (menuOptions.length === 0) return content;

    return (
        <ContextMenuPopover id={`row-menu-${item._id}`} trigger={content} options={menuOptions} />
    );
};

export default TableRow;
