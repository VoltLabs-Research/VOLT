export interface BreadcrumbItem {
    name: string;
    relPath: string;
}

export class BreadcrumbService {
    private readonly root: BreadcrumbItem = { name: 'root', relPath: '.' };

    getRoot(): BreadcrumbItem {
        return this.root;
    }

    buildBreadcrumbs(cwd: string): BreadcrumbItem[] {
        const parts = cwd.split('/').filter(Boolean);
        const breadcrumbs: BreadcrumbItem[] = [this.root];
        let accumulatedPath = '.';
        for (const part of parts) {
            accumulatedPath = accumulatedPath === '.' ? part : `${accumulatedPath}/${part}`;
            breadcrumbs.push({ name: part, relPath: accumulatedPath });
        }
        return breadcrumbs;
    }
}
