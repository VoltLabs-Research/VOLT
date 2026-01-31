import React from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import { Check } from 'lucide-react';
import { cn } from '@/shared/utils';
import './ThemeCard.css';

interface ThemeCardProps {
    theme: 'light' | 'dark';
    label: string;
    icon: React.ReactNode;
    previewClassName: string;
    isSelected: boolean;
    onClick: () => void;
}

const ThemeCard: React.FC<ThemeCardProps> = ({
    label,
    icon,
    previewClassName,
    isSelected,
    onClick
}) => {
    const cardClasses = cn(
        'theme-card',
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
