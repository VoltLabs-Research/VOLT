import './ThemeCard.css';
import { cn } from '@/shared/utils';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

interface ThemeCardProps {
    theme: 'light' | 'dark';
    label: string;
    icon: ReactNode;
    previewClassName: string;
    isSelected: boolean;
    onClick: () => void;
};

const ThemeCard = ({
    theme: _theme,
    label,
    icon,
    previewClassName,
    isSelected,
    onClick
}: ThemeCardProps) => {
    const cardClasses = cn(
        'theme-card',
        'transition-normal',
        'radius-md',
        'cursor-pointer',
        'overflow-hidden',
        isSelected && 'selected'
    );

    return (
        <Container className={cardClasses} onClick={onClick}>
            <Container className={`theme-preview ${previewClassName} d-flex items-center content-center p-relative`}>
                {icon}
            </Container>
            <Container className="d-flex column gap-025 p-1">
                <Container className="d-flex items-center content-between">
                    <Title className="font-size-2 font-weight-6">
                        {label}
                    </Title>
                    {isSelected && (
                        <Check size={18} className="theme-card-check" />
                    )}
                </Container>
            </Container>
        </Container>
    );
};

export default ThemeCard;
