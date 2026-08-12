import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
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
                className={{
                    default: 'inline-flex size-6 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted cursor-grab active:cursor-grabbing hover:bg-surface-hover',
                    compact: 'inline-flex size-[1.125rem] shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted cursor-grab active:cursor-grabbing hover:bg-surface-hover'
                }[density]}
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
            className={cn(
                {
                    default: 'flex items-center cursor-pointer px-6 py-3.5 transition-[background-color,box-shadow,border-color,opacity] duration-150 hover:bg-surface-hover max-md:px-4 max-md:py-3',
                    compact: 'flex items-center cursor-pointer box-border h-7 max-h-7 px-2 py-0.5 transition-[background-color,box-shadow,border-color,opacity] duration-150 hover:bg-surface-hover'
                }[density],
                isSelected && 'bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]',
                isDragging && 'opacity-65 shadow-[inset_0_0_0_1px_var(--accent)]',
                isOver && 'bg-surface-hover shadow-[inset_0_0_0_1px_var(--accent)]'
            )}
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

                return (
                    <div className={cn(
                        {
                            default: 'flex items-center overflow-hidden text-ellipsis whitespace-nowrap text-left no-underline text-sm max-md:text-sm',
                            compact: 'flex items-center overflow-hidden text-ellipsis whitespace-nowrap text-left no-underline text-xs'
                        }[density],
                        // The first column identifies the row, so it reads as primary content;
                        // every other column is metadata about it. Without this split the whole
                        // row was muted and weight was the only hierarchy lever left.
                        colIdx === 0 ? 'text-foreground' : 'text-muted',
                        col.numeric && 'justify-end text-right tabular-nums'
                    )} data-label={columnTitle} key={`cell-${columnTitle}-${colIdx}`} title={title} role='gridcell' aria-label={title ? `${columnTitle}: ${title}` : `${columnTitle}: no value`} style={columnStyles[colIdx]}>
                        {colIdx === 0 && draggableId ? (
                            <span className='flex min-w-0 items-center gap-2'>
                                {renderDragHandle()}
                                <span className='min-w-0 flex-1'>
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
