import Container from '@/shared/presentation/components/Container';

interface Breadcrumb {
    name: string;
    path: string;
};

interface SSHBreadcrumbsProps {
    cwd: string;
    onNavigate: (path: string) => void;
};

const buildBreadcrumbs = (cwd: string): Breadcrumb[] => {
    if (!cwd) return [];
    const parts = cwd.split('/').filter(Boolean);
    const crumbs: Breadcrumb[] = [{ name: '~', path: '.' }];

    let accumulated = '';
    for (const part of parts) {
        accumulated = accumulated ? `${accumulated}/${part}` : part;
        crumbs.push({ name: part, path: accumulated });
    }

    return crumbs;
};

const SSHBreadcrumbs = ({ cwd, onNavigate }: SSHBreadcrumbsProps) => {
    const breadcrumbs = buildBreadcrumbs(cwd);

    return (
        <Container className='d-flex items-center gap-025'>
            {breadcrumbs.map((crumb, index) => (
                <Container key={`${index}-${crumb.path}`} className='d-flex items-center gap-025'>
                    {index > 0 && <span className='color-muted'>/</span>}
                    <span
                        className={`cursor-pointer ${index === breadcrumbs.length - 1 ? 'font-weight-5' : 'color-muted'}`}
                        onClick={() => onNavigate(crumb.path)}
                    >
                        {crumb.name}
                    </span>
                </Container>
            ))}
        </Container>
    );
};

export default SSHBreadcrumbs;
