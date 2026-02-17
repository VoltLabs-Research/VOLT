import { useNavigate } from 'react-router-dom';
import { GoArrowRight } from 'react-icons/go';
import { Upload, FlaskConical, Puzzle, Box } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import './DashboardQuickActions.css';

const actions = [
    {
        label: 'Upload Trajectory',
        description: 'Import simulation data',
        icon: <Upload size={16} strokeWidth={1.8} />,
        variant: 'upload' as const,
        path: '/dashboard/trajectories/list'
    },
    {
        label: 'New Analysis',
        description: 'Configure analysis run',
        icon: <FlaskConical size={16} strokeWidth={1.8} />,
        variant: 'analysis' as const,
        path: '/dashboard/analysis-configs/list'
    },
    {
        label: 'Browse Plugins',
        description: 'Extend your workflow',
        icon: <Puzzle size={16} strokeWidth={1.8} />,
        variant: 'plugin' as const,
        path: '/dashboard/plugins/catalog'
    },
    {
        label: 'Containers',
        description: 'Manage compute resources',
        icon: <Box size={16} strokeWidth={1.8} />,
        variant: 'container' as const,
        path: '/dashboard/containers'
    }
];

const DashboardQuickActions = () => {
    const navigate = useNavigate();

    return (
        <Container className='dashboard-actions-card'>
            <Title className='font-size-3 color-primary font-weight-5' style={{ marginBottom: '0.75rem' }}>
                Quick Actions
            </Title>

            <Container className='d-flex column gap-025'>
                {actions.map((action) => (
                    <Container
                        key={action.label}
                        className='dashboard-action-item'
                        onClick={() => navigate(action.path)}
                    >
                        <Container className={`dashboard-action-icon ${action.variant}`}>
                            {action.icon}
                        </Container>
                        <Container className='d-flex column gap-01'>
                            <span className='font-size-2 color-primary font-weight-5'>{action.label}</span>
                            <span className='font-size-1 color-muted'>{action.description}</span>
                        </Container>
                        <Container className='dashboard-action-arrow'>
                            <GoArrowRight size={14} />
                        </Container>
                    </Container>
                ))}
            </Container>
        </Container>
    );
};

export default DashboardQuickActions;
