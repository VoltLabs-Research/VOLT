import { Button, Heading, Row, Stack, Text } from '@voltstack/bravais';
import './AccessDenied.css';
import { ShieldOff } from 'lucide-react';
import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
interface AccessDeniedProps {
    title?: string;
    description?: string;
    showBack?: boolean;
    className?: string;
    headingLevel?: 'h1' | 'h2' | 'h3';
    
    requiredPermissions?: string[];
    
    contactHint?: string;
    
    actions?: ReactNode;
};

const AccessDenied = ({
    title = 'Access Denied',
    description = 'You do not have permission to perform this action. Contact your team administrator to request access.',
    showBack = true,
    className,
    headingLevel = 'h2',
    requiredPermissions,
    contactHint,
    actions
}: AccessDeniedProps) => {
    const navigate = useNavigate();
    const headingId = useId();
    const level = Number(headingLevel.slice(1)) as 1 | 2 | 3;
    const hasPermissionHint = Boolean(requiredPermissions && requiredPermissions.length > 0);

    return (
        <Row as='section' aria-labelledby={headingId} justify='center' width='max' height='max' className={`access-denied-container ${className || ''}`}>
            <Stack align='center' gap='1-5' textAlign='center' className='access-denied-content'>
                <Row justify='center' className='access-denied-icon'>
                    <ShieldOff size={24} />
                </Row>

                <Stack gap='05' textAlign='center'>
                    <Heading level={level} id={headingId}>
                        {title}
                    </Heading>
                    <Text size='md' tone='secondary' lineHeight='5'>{description}</Text>
                    {hasPermissionHint && (
                        <Text size='sm' tone='secondary' lineHeight='5' className='access-denied-permissions'>
                            {`Permission${requiredPermissions!.length > 1 ? 's' : ''} needed: ${requiredPermissions!.join(', ')}.`}
                            {` Ask ${contactHint ?? 'a team administrator'} to grant access.`}
                        </Text>
                    )}
                </Stack>

                {(showBack || actions) && (
                    <Row justify='center' gap='075' className='mt-2'>
                        {showBack && (
                            <Button
                                variant='solid'
                                intent='brand'
                                size='sm'
                                onClick={() => navigate(-1)}
                            >
                                Go back
                            </Button>
                        )}
                        {actions}
                    </Row>
                )}
            </Stack>
        </Row>
    );
};

export default AccessDenied;
