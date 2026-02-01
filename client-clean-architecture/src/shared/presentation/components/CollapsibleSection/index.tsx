import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDown, Trash2, Plus } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import './CollapsibleSection.css';

interface CollapsibleSectionProps {
    title: string;
    children: ReactNode;
    defaultExpanded?: boolean;
    className?: string;
    onDelete?: () => void;
    onAdd?: () => void;
};

const CollapsibleSection = ({
    title,
    children,
    defaultExpanded = false,
    className = '',
    onDelete,
    onAdd
}: CollapsibleSectionProps) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [isHovered, setIsHovered] = useState(false);
    const bodyRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | 'auto'>(defaultExpanded ? 'auto' : 0);

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
                className='collapsible-section-header d-flex content-between items-center'
                onClick={handleToggle}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <Title className='font-size-3 font-weight-6 color-primary'>{title}</Title>
                <Container className='d-flex items-center gap-025'>
                    {onAdd && (
                        <button
                            type='button'
                            onClick={handleAdd}
                            className='collapsible-section-action collapsible-section-action--add'
                        >
                            <Plus size={16} />
                        </button>
                    )}
                    {onDelete && isHovered && (
                        <button
                            type='button'
                            onClick={handleDelete}
                            className='collapsible-section-action collapsible-section-action--delete'
                        >
                            <Trash2 size={16} />
                        </button>
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
                    {children}
                </Container>
            </div>
        </Container>
    );
};

export default CollapsibleSection;
