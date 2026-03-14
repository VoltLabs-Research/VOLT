import { Upload, Download, LogOut, Undo2, Redo2, Settings, Maximize, PanelBottom, Camera, BookOpen, FileText, Bug, Check } from 'lucide-react';

import type { ReactNode } from 'react';

interface BuildMenusParams {
    showStatusBar: boolean;
    onToggleFullscreen: () => void;
    onToggleStatusBar: () => void;
    onScreenshot: () => void;
    onImport: () => void;
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

export const buildMenus = ({
    showStatusBar,
    onToggleFullscreen,
    onToggleStatusBar,
    onScreenshot,
    onImport
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
                disabled: true
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
                action: onToggleStatusBar
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
                label: 'Manual',
                icon: <BookOpen size={ICON_SIZE} />,
                disabled: true
            },
            {
                type: MenuItemType.Item,
                label: 'Release Notes',
                icon: <FileText size={ICON_SIZE} />,
                disabled: true
            },
            { type: MenuItemType.Separator },
            {
                type: MenuItemType.Item,
                label: 'Report a Bug',
                icon: <Bug size={ICON_SIZE} />,
                disabled: true
            }
        ]
    }
    ];
};
