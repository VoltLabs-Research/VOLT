import type { ReactNode } from 'react';
import {
    Upload,
    Download, 
    LogOut,
    Undo2, 
    Redo2, 
    Settings,
    Maximize, 
    PanelBottom, 
    Camera,
    BookOpen, 
    FileText, 
    Bug,
    Check
} from 'lucide-react';

export interface MenuItem {
    type: 'item' | 'separator';
    label?: string;
    icon?: ReactNode;
    shortcut?: string;
    checked?: boolean;
    action?: () => void;
}

export interface MenuConfig {
    label: string;
    items: MenuItem[];
}

const ICON_SIZE = 16;

const buildMenus = ({
    showStatusBar,
    onToggleFullscreen,
    onToggleStatusBar,
    onScreenshot,
    onImport
}: {
    showStatusBar: boolean;
    onToggleFullscreen: () => void;
    onToggleStatusBar: () => void;
    onScreenshot: () => void;
    onImport: () => void;
}): MenuConfig[] => [
    {
        label: 'File',
        items: [
            { type: 'item', label: 'Import', icon: <Upload size={ICON_SIZE} />, shortcut: 'Ctrl+I', action: onImport },
            { type: 'item', label: 'Export', icon: <Download size={ICON_SIZE} />, shortcut: 'Ctrl+E' },
            { type: 'separator' },
            { type: 'item', label: 'Quit', icon: <LogOut size={ICON_SIZE} /> }
        ]
    },
    {
        label: 'Edit',
        items: [
            { type: 'item', label: 'Undo', icon: <Undo2 size={ICON_SIZE} />, shortcut: 'Ctrl+Z' },
            { type: 'item', label: 'Redo', icon: <Redo2 size={ICON_SIZE} />, shortcut: 'Ctrl+Shift+Z' },
            { type: 'separator' },
            { type: 'item', label: 'Preferences', icon: <Settings size={ICON_SIZE} /> }
        ]
    },
    {
        label: 'Window',
        items: [
            { type: 'item', label: 'Toggle Fullscreen', icon: <Maximize size={ICON_SIZE} />, shortcut: 'F11', action: onToggleFullscreen },
            {
                type: 'item',
                label: 'Show Status Bar',
                icon: showStatusBar ? <Check size={ICON_SIZE} /> : <PanelBottom size={ICON_SIZE} />,
                checked: showStatusBar,
                action: onToggleStatusBar
            },
            { type: 'item', label: 'Screenshot', icon: <Camera size={ICON_SIZE} />, shortcut: 'Ctrl+S', action: onScreenshot }
        ]
    },
    {
        label: 'Help',
        items: [
            { type: 'item', label: 'Manual', icon: <BookOpen size={ICON_SIZE} /> },
            { type: 'item', label: 'Release Notes', icon: <FileText size={ICON_SIZE} /> },
            { type: 'separator' },
            { type: 'item', label: 'Report a Bug', icon: <Bug size={ICON_SIZE} /> }
        ]
    }
];

export { buildMenus };
