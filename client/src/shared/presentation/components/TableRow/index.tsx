import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import EditableTag from '@/shared/presentation/components/EditableTag';
import Select from '@/shared/presentation/components/Select';
import { EditableType } from '@/shared/presentation/components/DocumentListingTable';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import type { ColumnConfig, Identifiable } from '@/shared/presentation/components/DocumentListingTable';
import type { MenuOption } from '@/shared/presentation/types/menu';
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
    droppableId = null
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

    const menuOptions = getMenuOptions ? getMenuOptions(item, selectedItems) : [];
    const itemRecord = item as Record<string, unknown>;
    const getColumnKey = (col: ColumnConfig<T>): string => String(col.key ?? col.path ?? '');
    const getColumnTitle = (col: ColumnConfig<T>): string => String(col.title ?? col.label ?? col.key ?? col.path ?? '');
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

    const rowClassName = [
        'document-listing-table-row-container',
        'cursor-pointer',
        isSelected ? 'is-selected' : '',
        draggableId ? 'has-drag-handle' : '',
        droppableId ? 'is-droppable' : '',
        isDragging ? 'is-dragging' : '',
        isOver ? 'is-drag-over' : ''
    ].filter(Boolean).join(' ');

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
                className='document-listing-row-drag-handle'
                aria-label='Drag row'
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
        const defaultContent = col.render ? col.render(cellValue, item) : formattedCellValue;

        if (!col.editable) return defaultContent;

        const { editable } = col;
        if (editable.canEdit && !editable.canEdit(item)) return defaultContent;

        if (editable.type === EditableType.Text || editable.type === EditableType.Number) {
            const handleSave = (newValue: string) => editable.onSave(item, newValue);
            return (
                <EditableTag as='span' onSave={handleSave}>
                    {formattedCellValue}
                </EditableTag>
            );
        }

        if (editable.type === EditableType.Select && editable.options) {
            const handleChange = (newValue: string) => editable.onSave(item, newValue);
            const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
            return (
                <span onClick={stopPropagation} onMouseDown={stopPropagation}>
                    <Select
                        options={editable.options}
                        value={String(cellValue ?? '')}
                        onChange={handleChange}
                    />
                </span>
            );
        }

        return defaultContent;
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

                const cellClassName = [
                    'document-listing-cell',
                    'overflow-hidden',
                    'd-flex',
                    'items-center',
                    'font-size-2',
                    'color-secondary',
                    col.numeric ? 'is-numeric' : ''
                ].filter(Boolean).join(' ');
                return (
                    <div className={`volt-container ${cellClassName}`} data-label={columnTitle} key={`cell-${columnTitle}-${colIdx}`} title={title} role='gridcell' aria-label={title ? `${columnTitle}: ${title}` : `${columnTitle}: no value`} style={columnStyles[colIdx]}>
                        {colIdx === 0 && draggableId ? (
                            <span className='document-listing-cell-content'>
                                {renderDragHandle()}
                                <span className='document-listing-cell-value'>
                                    {renderCellContent(col, cellValue)}
                                </span>
                            </span>
                        ) : (
                            <span className='document-listing-cell-value'>
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
