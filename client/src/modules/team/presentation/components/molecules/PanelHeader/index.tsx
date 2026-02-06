import React from 'react';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Title from '@/shared/presentation/components/Title';
import CloseButton from '@/shared/presentation/components/CloseButton';

interface PanelTab {
    label: string;
    active: boolean;
    disabled?: boolean;
    onClick?: () => void;
};

interface PanelHeaderProps {
    tabs?: PanelTab[];
    onClose?: () => void;
    title?: string;
};

const PanelHeader: React.FC<PanelHeaderProps> = ({
    tabs,
    onClose,
    title
}) => {
    return (
        <Container className='panel-header-bordered d-flex items-center content-between f-shrink-0'>
            {title ? (
                <Title className='font-size-4 font-weight-6 flex-1'>
                    {title}
                </Title>
            ) : tabs && tabs.length > 0 ? (
                <Container className='d-flex flex-1 gap-025'>
                    {tabs.map((tab, index) => (
                        <Button
                            key={index}
                            variant='ghost'
                            intent={tab.active ? 'brand' : 'neutral'}
                            size='sm'
                            onClick={tab.onClick}
                            disabled={tab.disabled}
                            style={tab.disabled ? { opacity: 0.5 } : undefined}
                        >
                            {tab.label}
                        </Button>
                    ))}
                </Container>
            ) : null}

            {onClose && <CloseButton onClick={onClose} />}
        </Container>
    );
};

export default PanelHeader;
