import './SSHBreadcrumbs.css';

interface Breadcrumb {
    name: string;
    path: string;
};

interface SSHBreadcrumbsProps {
    cwd: string;
    onNavigate: (path: string) => void;
};

const MAX_BREADCRUMB_LABEL_LENGTH = 24;

const truncateBreadcrumbLabel = (label: string) => {
    if (label.length <= MAX_BREADCRUMB_LABEL_LENGTH) {
        return label;
    }

    return `${label.slice(0, MAX_BREADCRUMB_LABEL_LENGTH - 1)}…`;
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
        <nav className='ssh-breadcrumbs' aria-label='Current directory path' title={cwd}>
            <ol className='ssh-breadcrumbs-list d-flex items-center gap-025'>
                {breadcrumbs.map((crumb, index) => {
                    const isCurrentPage = index === breadcrumbs.length - 1;
                    const label = truncateBreadcrumbLabel(crumb.name);

                    return (
                        <li key={`${index}-${crumb.path}`} className='ssh-breadcrumbs-item d-flex items-center gap-025'>
                            {index > 0 && <span className='ssh-breadcrumbs-separator color-muted'>/</span>}
                            {isCurrentPage ? (
                                <span className='ssh-breadcrumbs-current font-weight-5' aria-current='page' title={crumb.name}>
                                    {label}
                                </span>
                            ) : (
                                <button
                                    type='button'
                                    className='ssh-breadcrumbs-trigger color-muted'
                                    onClick={() => onNavigate(crumb.path)}
                                    title={crumb.name}
                                    aria-label={`Open ${crumb.name}`}
                                >
                                    {label}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default SSHBreadcrumbs;
