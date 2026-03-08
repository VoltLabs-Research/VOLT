import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import './SidebarExpandableSection.css';
import '@/shared/presentation/components/SidebarSubItems/SidebarSubItems.css';
import { useEffect, useState, forwardRef } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import type { IconType } from 'react-icons';

export interface SubItem {
    label: string;
    isSelected?: boolean;
    onClick?: () => void;
    subItems?: SubItem[];
};

interface SidebarExpandableSectionProps {
    label: string;
    icon: IconType;
    isActive?: boolean;
    subItems: SubItem[];
    defaultExpanded?: boolean;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    disabled?: boolean;
};

const SidebarExpandableSection = forwardRef<HTMLDivElement, SidebarExpandableSectionProps>(({
    label,
    icon: Icon,
    isActive = false,
    subItems,
    defaultExpanded = false,
    expanded: controlledExpanded,
    onExpandedChange,
    disabled = false
}, ref) => {
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
    
    const isControlled = controlledExpanded !== undefined;
    const expanded = isControlled ? controlledExpanded : internalExpanded;

    const handleToggle = () => {
        if (disabled) return;
        const newExpanded = !expanded;
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

    const renderSubItem = (item: SubItem, index: number) => {
        const hasChildren = Boolean(item.subItems?.length);

        if (!hasChildren) {
            return (
                <Button
                    key={item.label || index}
                    variant='ghost'
                    intent='neutral'
                    align='start'
                    className={`sidebar-sub-item transition-fast ${item.isSelected ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                    onClick={item.onClick}
                >
                    <span className="text-truncate">{item.label}</span>
                </Button>
            );
        }

        const childSelected = Boolean(item.subItems?.some((subItem) => subItem.isSelected));

        return (
            <NestedSubItems
                key={item.label || index}
                item={item}
                childSelected={childSelected}
            />
        );
    };

    return (
        <Container ref={ref} className='sidebar-expandable-section'>
            <Button
                variant='ghost'
                intent='neutral'
                className={`sidebar-nav-item sidebar-section-header ${isActive ? 'is-selected' : ''} p-relative gap-075 w-max font-size-2 font-weight-4 color-secondary cursor-pointer`}
                onClick={handleToggle}
                disabled={disabled}
            >
                <Container className='sidebar-nav-icon font-size-4'>
                    <Icon />
                </Container>
                <span className='sidebar-nav-label text-truncate'>{label}</span>
                <IoChevronDown
                    className={`sidebar-section-chevron ${expanded ? 'is-expanded' : ''} color-muted`}
                    size={14}
                />
            </Button>

            {expanded && !disabled && (
                <Container className='sidebar-sub-items'>
                    {subItems.map(renderSubItem)}
                </Container>
            )}
        </Container>
    );
});

SidebarExpandableSection.displayName = 'SidebarExpandableSection';

interface NestedSubItemsProps {
    item: SubItem;
    childSelected: boolean;
};

const NestedSubItems = ({ item, childSelected }: NestedSubItemsProps) => {
    const [expanded, setExpanded] = useState(childSelected);
    const children = item.subItems || [];

    useEffect(() => {
        if (childSelected) {
            setExpanded(true);
        }
    }, [childSelected]);

    return (
        <Container className='sidebar-nested-section'>
            <Button
                variant='ghost'
                intent='neutral'
                align='start'
                className={`sidebar-sub-item sidebar-nested-header transition-fast ${item.isSelected || childSelected ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                onClick={() => setExpanded((value) => !value)}
            >
                <span className="text-truncate">{item.label}</span>
                <IoChevronDown
                    className={`sidebar-nested-chevron ${expanded ? 'is-expanded' : ''}`}
                    size={12}
                />
            </Button>

            {expanded && (
                <Container className='sidebar-nested-items'>
                    {children.map((subItem, index) => (
                        <Button
                            key={`${item.label}-${subItem.label || index}`}
                            variant='ghost'
                            intent='neutral'
                            align='start'
                            className={`sidebar-nested-item transition-fast ${subItem.isSelected ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                            onClick={subItem.onClick}
                        >
                            <span className="text-truncate">{subItem.label}</span>
                        </Button>
                    ))}
                </Container>
            )}
        </Container>
    );
};

export default SidebarExpandableSection;
