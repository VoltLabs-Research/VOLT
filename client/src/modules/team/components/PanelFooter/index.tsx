import Button from '@/shared/presentation/primitives/Button';
import Row from '@/shared/presentation/primitives/Row';
import type { ReactNode } from 'react';

interface PanelAction {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    disabled?: boolean;
}

interface PanelFooterProps {
    actions?: PanelAction[];
}

export const PanelFooter = ({ actions }: PanelFooterProps) => {
    if(!actions || actions.length === 0) return null;

    return (
        <Row gap='05' justify='between' shrink='0' className='panel-footer-bordered' style={{ marginTop: 'auto' }}>
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
        </Row>
    );
};
