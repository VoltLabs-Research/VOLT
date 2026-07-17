import {
    BookOpen,
    Box,
    Braces,
    Check,
    CircleDot,
    Database,
    Eye,
    File,
    FileOutput,
    FileText,
    GitBranch,
    Play,
    Plug,
    Repeat,
    Route,
    ScanSearch,
    Trash2,
    Unplug,
    Upload,
    X
} from 'lucide-react';
import type { ComponentType, CSSProperties } from 'react';

export interface DynamicIconRenderProps {
    size?: string | number;
    color?: string;
    className?: string;
    style?: CSSProperties;
    title?: string;
}

export type DynamicIconComponent = ComponentType<DynamicIconRenderProps>;

export const ICON_COMPONENTS: Record<string, DynamicIconComponent> = {
    TbBook: BookOpen,
    TbBrackets: Braces,
    TbCheck: Check,
    TbCube3dSphere: Box,
    TbDatabase: Database,
    TbEye: Eye,
    TbFile: File,
    TbFileExport: FileOutput,
    TbFileTypePdf: FileText,
    TbGitBranch: GitBranch,
    TbObjectScan: ScanSearch,
    TbPlayerPlay: Play,
    TbPlugConnected: Plug,
    TbPlugConnectedX: Unplug,
    TbPoint: CircleDot,
    TbRepeat: Repeat,
    TbRouteSquare: Route,
    TbTrash: Trash2,
    TbUpload: Upload,
    TbX: X
};

export const ICON_COMPONENT_ENTRIES = Object.entries(ICON_COMPONENTS)
    .sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
