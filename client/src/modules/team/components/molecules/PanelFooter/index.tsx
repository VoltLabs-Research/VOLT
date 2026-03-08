import React, { ReactNode } from 'react';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';

interface PanelAction {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    disabled?: boolean;
};

interface PanelFooterProps {
    actions?: PanelAction[];
};

const PanelFooter: React.FC<PanelFooterProps> = ({ actions }) => {
    if(!actions || actions.length === 0) return null;

    return (
        <Container className='panel-footer-bordered d-flex gap-05 content-between f-shrink-0' style={{ marginTop: 'auto' }}>
            {actions.map((action, index) => (
                <Button
                    key={index}
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    leftIcon={action.icon}
                    onClick={action.onClick}
                    disabled={action.disabled}
                >
                    {action.label}
                </Button>
            ))}
        </Container>
    );
};

export default PanelFooter;
