import { Button, cn } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { SubItem } from '@/shared/contracts/sidebar';

interface NestedSubItemsProps {
    item: SubItem;
    childSelected: boolean;
};

/**
 * The nested header is a sub-item row that also spreads its label and chevron apart,
 * so `justify-between` follows the shared row and wins the merge.
 */
const SUB_ITEM = 'flex w-full min-h-10 items-center justify-start rounded-lg border border-transparent px-3 py-2 text-left text-[0.8rem] cursor-pointer transition-[all] duration-150 ease-out-fluid';
const SUB_ITEM_SELECTED = 'is-selected bg-accent-soft font-medium text-foreground hover:bg-accent-soft-hover focus-visible:bg-accent-soft-hover';
const SUB_ITEM_IDLE = 'text-muted hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:text-foreground';
const NESTED_HEADER = 'justify-between';

const NESTED_CHEVRON = 'ml-auto shrink-0 transition-transform duration-150 ease-out-fluid';
const NESTED_LIST = 'ml-3 mt-0.5 list-none border-l border-border py-0 pl-2';

const NESTED_ITEM = 'flex w-full min-h-10 items-center justify-start rounded-lg border border-transparent bg-transparent p-2 text-left text-sm cursor-pointer transition-[all] duration-150 ease-out-fluid';
const NESTED_ITEM_SELECTED = 'is-selected bg-accent-soft font-medium text-foreground hover:bg-accent-soft-hover focus-visible:bg-accent-soft-hover';
const NESTED_ITEM_IDLE = 'text-muted hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:text-foreground';

const NestedSubItems = ({ item, childSelected }: NestedSubItemsProps) => {
    const [expanded, setExpanded] = useState(childSelected);
    const nestedId = useId();
    const children = item.subItems || [];

    useEffect(() => {
        if (childSelected) {
            setExpanded(true);
        }
    }, [childSelected]);

    return (
        <div className='mb-0.5'>
            <Button
                variant='ghost'
                className={cn(SUB_ITEM, item.isSelected || childSelected ? SUB_ITEM_SELECTED : SUB_ITEM_IDLE, NESTED_HEADER)}
                onPress={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                aria-controls={nestedId}
                aria-current={item.isSelected ? 'page' : undefined}
            >
                <span className='truncate'>{item.label}</span>
                <ChevronDown
                    className={expanded ? `${NESTED_CHEVRON} rotate-180` : NESTED_CHEVRON}
                    size={12}
                    aria-hidden='true'
                />
            </Button>

            {expanded && (
                <ul id={nestedId} className={NESTED_LIST} role='list'>
                    {children.map((subItem, index) => (
                        <li key={`${item.label}-${subItem.label || index}`} className='list-none'>
                            <Button
                                variant='ghost'
                                className={cn(NESTED_ITEM, subItem.isSelected ? NESTED_ITEM_SELECTED : NESTED_ITEM_IDLE)}
                                onPress={subItem.onClick}
                                aria-current={subItem.isSelected ? 'page' : undefined}
                            >
                                <span className='truncate'>{subItem.label}</span>
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default NestedSubItems;
