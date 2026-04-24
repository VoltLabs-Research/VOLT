import Button from '@/shared/presentation/primitives/Button';
import './SidebarExpandableSection.css';
import '@/shared/presentation/components/SidebarSubItems/SidebarSubItems.css';
import NestedSubItems from './NestedSubItems';
import { useEffect, useId, useState, forwardRef } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import type { IconType } from 'react-icons';
import type { SubItem } from './SidebarExpandableSection.types';

interface SidebarExpandableSectionProps {
    label: string;
    icon: IconType;
    isActive?: boolean;
    subItems: SubItem[];
    defaultExpanded?: boolean;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    disabled?: boolean;
    onRequestSidebarExpand?: () => void;
};

const SidebarExpandableSection = forwardRef<HTMLDivElement, SidebarExpandableSectionProps>(({
    label,
    icon: Icon,
    isActive = false,
    subItems,
    defaultExpanded = false,
    expanded: controlledExpanded,
    onExpandedChange,
    disabled = false,
    onRequestSidebarExpand
}, ref) => {
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
    const subItemsId = useId();
    
    const isControlled = controlledExpanded !== undefined;
    const expanded = isControlled ? controlledExpanded : internalExpanded;

    const handleToggle = () => {
        if (disabled) return;
        const newExpanded = !expanded;
        if (newExpanded) {
            onRequestSidebarExpand?.();
        }
        if (isControlled) {
            onExpandedChange?.(newExpanded);
        } else {
            setInternalExpanded(newExpanded);
        }
    };

    useEffect(() => {
        if (!isControlled && isActive) {
            setInternalExpanded(true);
        }
    }, [isActive, isControlled]);

    const renderSubItem = (item: SubItem) => {
        const hasChildren = Boolean(item.subItems?.length);

        if (!hasChildren) {
            return (
                <Button
                    variant='ghost'
                    intent='neutral'
                    align='start'
                    className={`sidebar-sub-item transition-fast ${item.isSelected ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                    onClick={item.onClick}
                    aria-current={item.isSelected ? 'page' : undefined}
                >
                    <span className="text-truncate">{item.label}</span>
                </Button>
            );
        }

        const childSelected = Boolean(item.subItems?.some((subItem) => subItem.isSelected));

        return (
            <NestedSubItems
                item={item}
                childSelected={childSelected}
            />
        );
    };

    return (
        <div ref={ref} className='sidebar-expandable-section'>
            <Button
                variant='ghost'
                intent='neutral'
                className={`sidebar-nav-item sidebar-section-header ${isActive ? 'is-selected' : ''} p-relative gap-075 w-max font-size-2 font-weight-4 color-secondary cursor-pointer`}
                onClick={handleToggle}
                disabled={disabled}
                aria-expanded={expanded}
                aria-controls={subItemsId}
            >
                <div className='sidebar-nav-icon font-size-4'>
                    <Icon />
                </div>
                <span className='sidebar-nav-label text-truncate'>{label}</span>
                <IoChevronDown
                    className={`sidebar-section-chevron ${expanded ? 'is-expanded' : ''} color-muted`}
                    size={14}
                    aria-hidden='true'
                />
            </Button>

            {expanded && !disabled && (
                <ul id={subItemsId} className='sidebar-sub-items' role='list'>
                    {subItems.map((item, index) => (
                        <li key={item.label || index} className='sidebar-sub-item-wrapper'>
                            {renderSubItem(item)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
});

SidebarExpandableSection.displayName = 'SidebarExpandableSection';

export default SidebarExpandableSection;
