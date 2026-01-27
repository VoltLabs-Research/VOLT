/**
 * Breadcrumb item.
 */
export interface Breadcrumb {
    name: string;
    relPath: string;
}

/**
 * Service for path operations.
 * Pure domain logic - no external dependencies.
 */
export class PathService {
    /**
     * Joins path segments.
     *
     * @param base - Base path
     * @param name - Name to append
     * @returns Joined path
     */
    joinPath(base: string, name: string): string {
        if (!base) return name;
        return `${base}/${name}`;
    }

    /**
     * Gets the parent path.
     *
     * @param path - Current path
     * @returns Parent path
     */
    getParentPath(path: string): string {
        if (!path) return '';
        return path.split('/').slice(0, -1).join('/');
    }

    /**
     * Gets the file name from a path.
     *
     * @param path - Full path
     * @returns File name
     */
    getFileName(path: string): string {
        const parts = path.split('/');
        return parts[parts.length - 1] || 'file';
    }

    /**
     * Gets the file extension from a path.
     *
     * @param path - Full path
     * @returns File extension (without dot) or empty string
     */
    getExtension(path: string): string {
        const fileName = this.getFileName(path);
        const lastDot = fileName.lastIndexOf('.');
        if (lastDot === -1) return '';
        return fileName.slice(lastDot + 1);
    }

    /**
     * Builds breadcrumbs from a path.
     *
     * @param path - Current path
     * @returns Array of breadcrumb items
     */
    buildBreadcrumbs(path: string): Breadcrumb[] {
        const breadcrumbs: Breadcrumb[] = [{ name: 'root', relPath: '' }];

        if (!path) return breadcrumbs;

        const parts = path.split('/').filter(Boolean);
        let currentPath = '';

        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            breadcrumbs.push({ name: part, relPath: currentPath });
        }

        return breadcrumbs;
    }

    /**
     * Checks if a path is at root level.
     */
    isRoot(path: string): boolean {
        return !path || path === '';
    }

    /**
     * Normalizes a path (removes trailing slashes, etc.).
     */
    normalizePath(path: string): string {
        return path.replace(/\/+/g, '/').replace(/\/$/, '');
    }
}
