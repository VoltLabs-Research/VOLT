import Container from '@/shared/presentation/components/Container';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import EditableTag from '@/shared/presentation/components/EditableTag';
import Select from '@/shared/presentation/components/Select';
import { EditableType } from '@/shared/presentation/components/DocumentListingTable';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import type { ColumnConfig, Identifiable } from '@/shared/presentation/components/DocumentListingTable';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';

interface TableRowProps<T extends Identifiable> {
    item: T;
    columns: ColumnConfig<T>[];
    columnWidths: number[];
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
    selectedItems: T[];
    isSelected: boolean;
    onClick: (event: MouseEvent | KeyboardEvent, item: T) => void;
    onItemClick?: (item: T, event: MouseEvent) => boolean;
    onContextMenu: (item: T) => void;
    useFlexDistribution: boolean;
    columnGap?: number;
    draggableId?: string | null;
    droppableId?: string | null;
};

const TableRow = <T extends Identifiable>({ 
    item, 
    columns, 
    columnWidths, 
    getMenuOptions, 
    selectedItems,
    isSelected,
    onClick,
    onItemClick,
    onContextMenu,
    useFlexDistribution,
    columnGap = 16,
    draggableId = null,
    droppableId = null
}: TableRowProps<T>) => {
    const menuOptions = getMenuOptions ? getMenuOptions(item, selectedItems) : [];
    const itemRecord = item as Record<string, unknown>;
    const getColumnKey = (col: ColumnConfig<T>): string => String(col.key ?? col.path ?? '');
    const getColumnTitle = (col: ColumnConfig<T>): string => String(col.title ?? col.label ?? col.key ?? col.path ?? '');
    const {
        attributes,
        listeners,
        setNodeRef: setDraggableNodeRef,
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
        justifyContent: useFlexDistribution ? 'space-between' : 'flex-start',
        gap: useFlexDistribution ? undefined : `${columnGap}px`,
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
        'w-max',
        isSelected ? 'is-selected' : '',
        draggableId ? 'is-draggable' : '',
        droppableId ? 'is-droppable' : '',
        isDragging ? 'is-dragging' : '',
        isOver ? 'is-drag-over' : ''
    ].filter(Boolean).join(' ');

    const dragListeners = draggableId ? listeners : undefined;
    const dragAttributes = draggableId ? attributes : undefined;

    const renderCellContent = (col: ColumnConfig<T>, cellValue: unknown) => {
        const defaultContent = col.render ? col.render(cellValue, item) : String(cellValue ?? '-');

        if (!col.editable) return defaultContent;

        const { editable } = col;
        if (editable.canEdit && !editable.canEdit(item)) return defaultContent;

        if (editable.type === EditableType.Text || editable.type === EditableType.Number) {
            const handleSave = (newValue: string) => editable.onSave(item, newValue);
            return (
                <EditableTag as='span' onSave={handleSave}>
                    {String(cellValue ?? '-')}
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
            {...dragAttributes}
            {...dragListeners}
            onClick={(event) => {
                const isHandled = onItemClick?.(item, event);

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
                const title = String(cellValue ?? '');
                const columnTitle = getColumnTitle(col);

                return (
                    <Container
                        className='document-listing-cell overflow-hidden d-flex items-center font-size-2 color-secondary'
                        data-label={columnTitle}
                        key={`cell-${columnTitle}-${colIdx}`}
                        title={title}
                        role='gridcell'
                        aria-label={title ? `${columnTitle}: ${title}` : `${columnTitle}: no value`}
                        style={
                            useFlexDistribution
                                ? { flex: 1, minWidth: 0 }
                                : { 
                                    width: columnWidths[colIdx], 
                                    minWidth: columnWidths[colIdx], 
                                    maxWidth: columnWidths[colIdx], 
                                    flexShrink: 0 
                                }
                        }
                    >
                        <span className='document-listing-cell-value'>
                            {renderCellContent(col, cellValue)}
                        </span>
                    </Container>
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
