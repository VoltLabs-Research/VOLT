import { Upload, Download, LogOut, Undo2, Redo2, Settings, Maximize, PanelBottom, Camera, BookOpen, FileText, Check } from 'lucide-react';

import type { ReactNode } from 'react';

interface BuildMenusParams {
    showStatusBar: boolean;
    allowStatusBarToggle?: boolean;
    onToggleFullscreen: () => void;
    onToggleStatusBar: () => void;
    onScreenshot: () => void;
    onImport: () => void;
    onExport?: () => void;
    onDownloadAnalyses?: () => void;
    canExport?: boolean;
    canDownloadAnalyses?: boolean;
};

export enum MenuItemType {
    Item = 'item',
    Separator = 'separator'
};

export interface MenuItem {
    type: MenuItemType;
    label?: string;
    icon?: ReactNode;
    shortcut?: string;
    checked?: boolean;
    action?: () => void;
    disabled?: boolean;
};

export interface MenuConfig {
    label: string;
    items: MenuItem[];
};

const ICON_SIZE = 16;
const openExternalUrl = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

export const buildMenus = ({
    showStatusBar,
    allowStatusBarToggle = true,
    onToggleFullscreen,
    onToggleStatusBar,
    onScreenshot,
    onImport,
    onExport,
    onDownloadAnalyses,
    canExport = false,
    canDownloadAnalyses = false
}: BuildMenusParams): MenuConfig[] => {
    let statusBarIcon = <PanelBottom size={ICON_SIZE} />;
    if (showStatusBar) {
        statusBarIcon = <Check size={ICON_SIZE} />;
    }

    return [
    {
        label: 'File',
        items: [
            {
                type: MenuItemType.Item,
                label: 'Import',
                icon: <Upload size={ICON_SIZE} />,
                shortcut: 'Ctrl+I',
                action: onImport
            },
            {
                type: MenuItemType.Item,
                label: 'Export',
                icon: <Download size={ICON_SIZE} />,
                shortcut: 'Ctrl+E',
                action: onExport,
                disabled: !canExport || !onExport
            },
            {
                type: MenuItemType.Item,
                label: 'Download Analyses',
                icon: <Download size={ICON_SIZE} />,
                action: onDownloadAnalyses,
                disabled: !canDownloadAnalyses || !onDownloadAnalyses
            },
            { type: MenuItemType.Separator },
            {
                type: MenuItemType.Item,
                label: 'Quit',
                icon: <LogOut size={ICON_SIZE} />,
                disabled: true
            }
        ]
    },
    {
        label: 'Edit',
        items: [
            {
                type: MenuItemType.Item,
                label: 'Undo',
                icon: <Undo2 size={ICON_SIZE} />,
                shortcut: 'Ctrl+Z',
                disabled: true
            },
            {
                type: MenuItemType.Item,
                label: 'Redo',
                icon: <Redo2 size={ICON_SIZE} />,
                shortcut: 'Ctrl+Shift+Z',
                disabled: true
            },
            { type: MenuItemType.Separator },
            {
                type: MenuItemType.Item,
                label: 'Preferences',
                icon: <Settings size={ICON_SIZE} />,
                disabled: true
            }
        ]
    },
    {
        label: 'Window',
        items: [
            {
                type: MenuItemType.Item,
                label: 'Toggle Fullscreen',
                icon: <Maximize size={ICON_SIZE} />,
                shortcut: 'F11',
                action: onToggleFullscreen
            },
            {
                type: MenuItemType.Item,
                label: 'Show Status Bar',
                icon: statusBarIcon,
                checked: showStatusBar,
                action: onToggleStatusBar,
                disabled: !allowStatusBarToggle
            },
            {
                type: MenuItemType.Item,
                label: 'Screenshot',
                icon: <Camera size={ICON_SIZE} />,
                shortcut: 'Ctrl+S',
                action: onScreenshot
            }
        ]
    },
    {
        label: 'Help',
        items: [
            {
                type: MenuItemType.Item,
                label: 'Read the docs',
                icon: <BookOpen size={ICON_SIZE} />,
                action: () => openExternalUrl('https://docs.voltcloud.dev')
            },
            {
                type: MenuItemType.Item,
                label: 'Release Notes',
                icon: <FileText size={ICON_SIZE} />,
                action: () => openExternalUrl('https://github.com/voltlabs-research')
            }
        ]
    }
    ];
};
