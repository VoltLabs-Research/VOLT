import { Upload, Download, Undo2, Redo2, Maximize, PanelBottom, Camera, BookOpen, FileText, Check } from 'lucide-react';

import type { ReactNode } from 'react';

interface BuildMenusParams {
    showStatusBar: boolean;
    allowStatusBarToggle?: boolean;
    onToggleFullscreen: () => void;
    onToggleStatusBar: () => void;
    onScreenshot: () => void;
    onImport: () => void;
    onDownloadAnalyses?: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canDownloadAnalyses?: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
}

export enum MenuItemType {
    Item = 'item',
    Separator = 'separator'
}

export interface MenuItem {
    type: MenuItemType;
    label?: string;
    icon?: ReactNode;
    shortcut?: string;
    checked?: boolean;
    action?: () => void;
    disabled?: boolean;
}

export interface MenuConfig {
    /** Also the trigger's visible text, so it has to read as a menu name on its own. */
    label: string;
    items: MenuItem[];
}

const ICON_SIZE = 16;
const openExternalUrl = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

export const buildMenus = ({
    showStatusBar,
    allowStatusBarToggle = true,
    onToggleFullscreen,
    onToggleStatusBar,
    onScreenshot,
    onImport,
    onDownloadAnalyses,
    onUndo,
    onRedo,
    canDownloadAnalyses = false,
    canUndo = false,
    canRedo = false
}: BuildMenusParams): MenuConfig[] => {
    let statusBarIcon = <PanelBottom size={ICON_SIZE} />;
    if (showStatusBar) {
        statusBarIcon = <Check size={ICON_SIZE} />;
    }

    /*
     * A menu bar, not one hamburger. Four named menus put the whole action set one
     * click away and let the label say which group an action is in, where a single
     * icon trigger said nothing about what was behind it. The separators that used
     * to divide these groups inside one long list are the menus themselves now.
     */
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
                    label: 'Download Analyses',
                    icon: <Download size={ICON_SIZE} />,
                    action: onDownloadAnalyses,
                    disabled: !canDownloadAnalyses || !onDownloadAnalyses
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
                    action: onUndo,
                    disabled: !canUndo
                },
                {
                    type: MenuItemType.Item,
                    label: 'Redo',
                    icon: <Redo2 size={ICON_SIZE} />,
                    shortcut: 'Ctrl+Shift+Z',
                    action: onRedo,
                    disabled: !canRedo
                }
            ]
        },
        {
            label: 'View',
            items: [
                {
                    type: MenuItemType.Item,
                    label: 'Screenshot',
                    icon: <Camera size={ICON_SIZE} />,
                    shortcut: 'Ctrl+S',
                    action: onScreenshot
                },
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
