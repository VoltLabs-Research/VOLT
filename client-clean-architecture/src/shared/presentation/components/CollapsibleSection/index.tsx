import { useState, useRef, useEffect, type ReactNode, memo } from 'react';
import { ChevronDown, Trash2, Plus } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import IconButton from '@/shared/presentation/components/IconButton';
import './CollapsibleSection.css';

interface CollapsibleSectionProps {
    title: string;
    children: ReactNode;
    defaultExpanded?: boolean;
    className?: string;
    onDelete?: () => void;
    onAdd?: () => void;
    icon?: ReactNode;
};

const CollapsibleSection = ({
    title,
    children,
    defaultExpanded = false,
    className = '',
    onDelete,
    onAdd,
    icon
}: CollapsibleSectionProps) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [isHovered, setIsHovered] = useState(false);
    const [hasBeenExpanded, setHasBeenExpanded] = useState(defaultExpanded);
    const bodyRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | 'auto'>(defaultExpanded ? 'auto' : 0);

    useEffect(() => {
        if (isExpanded && !hasBeenExpanded) {
            setHasBeenExpanded(true);
        }
    }, [isExpanded, hasBeenExpanded]);

    useEffect(() => {
        if (!bodyRef.current) return;

        if (isExpanded) {
            const scrollHeight = bodyRef.current.scrollHeight;
            setHeight(scrollHeight);
            const timer = setTimeout(() => setHeight('auto'), 250);
            return () => clearTimeout(timer);
        } else {
            const scrollHeight = bodyRef.current.scrollHeight;
            setHeight(scrollHeight);
            requestAnimationFrame(() => {
                setHeight(0);
            });
        }
    }, [isExpanded]);

    const handleToggle = () => setIsExpanded(!isExpanded);

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.();
    };

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAdd?.();
    };

    return (
        <Container className={`d-flex column mb-1-5 ${className}`}>
            <Container
                className='collapsible-section-header d-flex content-between items-center cursor-pointer u-select-none'
                onClick={handleToggle}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <Container className='d-flex items-center gap-05'>
                    {icon && <span className='d-flex items-center'>{icon}</span>}
                    <Title className='font-size-3 font-weight-6 color-primary'>{title}</Title>
                </Container>
                <Container className='d-flex items-center gap-025'>
                    {onAdd && (
                        <IconButton
                            size='sm'
                            variant='ghost'
                            onClick={handleAdd}
                            className='collapsible-section-action--add'
                        >
                            <Plus size={16} />
                        </IconButton>
                    )}
                    {onDelete && isHovered && (
                        <IconButton
                            size='sm'
                            variant='ghost'
                            onClick={handleDelete}
                            className='collapsible-section-action--delete'
                        >
                            <Trash2 size={16} />
                        </IconButton>
                    )}
                    <Container
                        className={`collapsible-section-arrow d-flex flex-center color-muted ${!isExpanded ? 'collapsible-section-arrow--collapsed' : ''}`}
                    >
                        <ChevronDown size={20} />
                    </Container>
                </Container>
            </Container>
            <div
                ref={bodyRef}
                className='collapsible-section-body'
                style={{ height }}
            >
                <Container className='collapsible-section-content d-flex column gap-1'>
                    {hasBeenExpanded ? children : null}
                </Container>
            </div>
        </Container>
    );
};

export default memo(CollapsibleSection);
