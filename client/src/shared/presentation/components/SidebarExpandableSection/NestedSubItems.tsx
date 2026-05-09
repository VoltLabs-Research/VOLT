import Button from '@/shared/presentation/primitives/Button';
import '@/shared/presentation/components/SidebarSubItems/SidebarSubItems.css';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { SubItem } from './SidebarExpandableSection.types';

interface NestedSubItemsProps {
    item: SubItem;
    childSelected: boolean;
};

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
        <div className='sidebar-nested-section'>
            <Button
                variant='ghost'
                intent='neutral'
                align='start'
                className={`sidebar-sub-item sidebar-nested-header transition-fast ${item.isSelected || childSelected ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                aria-controls={nestedId}
                aria-current={item.isSelected ? 'page' : undefined}
            >
                <span className='text-truncate'>{item.label}</span>
                <ChevronDown
                    className={`sidebar-nested-chevron ${expanded ? 'is-expanded' : ''}`}
                    size={12}
                    aria-hidden='true'
                />
            </Button>

            {expanded && (
                <ul id={nestedId} className='sidebar-nested-items' role='list'>
                    {children.map((subItem, index) => (
                        <li key={`${item.label}-${subItem.label || index}`} className='sidebar-nested-item-wrapper'>
                            <Button
                                variant='ghost'
                                intent='neutral'
                                align='start'
                                className={`sidebar-nested-item transition-fast ${subItem.isSelected ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                                onClick={subItem.onClick}
                                aria-current={subItem.isSelected ? 'page' : undefined}
                            >
                                <span className='text-truncate'>{subItem.label}</span>
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default NestedSubItems;
