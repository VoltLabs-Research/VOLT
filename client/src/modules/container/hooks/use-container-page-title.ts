import { resolveConfiguredRouteTitle } from '@/app/routes/metadata';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import { useLocation } from 'react-router-dom';

const resolveSectionTitle = (pathname: string): string => {
    if (/^\/dashboard\/containers\/[^/]+\/?$/u.test(pathname)) {
        return 'Details';
    }

    const routeTitle = resolveConfiguredRouteTitle(pathname);

    if (!routeTitle || routeTitle === 'Container Details') {
        return 'Details';
    }

    return routeTitle.replace(/^Container\s+/u, '');
};

/**
 * Titles the container detail pages as "<name> - <section>", falling back to the
 * generic route title while the container is still loading.
 */
const useContainerPageTitle = (containerName: string | undefined) => {
    const { pathname } = useLocation();
    const sectionTitle = resolveSectionTitle(pathname);
    const isDetailsSection = sectionTitle === 'Details';

    usePageTitle(containerName
        ? (isDetailsSection ? containerName : `${containerName} - ${sectionTitle}`)
        : (isDetailsSection ? 'Container Details' : `Container ${sectionTitle}`));
};

export default useContainerPageTitle;
