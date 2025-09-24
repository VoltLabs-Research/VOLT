/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import type { ReactNode, MouseEvent, CSSProperties } from 'react';

export interface FloatingMenuOption {
    name: string;
    Icon: React.ComponentType<any>;
    onClick: () => void;
}

export type FloatingMenuTuple = [string, React.ComponentType<any>, () => void];

export interface FloatingMenuItemConfig {
    id?: string | number;
    label: string;
    icon: React.ComponentType<any>;
    onClick?: () => void;
    className?: string;
    danger?: boolean;
}

export type FloatingMenuOptions = Array<FloatingMenuTuple | FloatingMenuItemConfig>;

export interface ViewportDimensions {
    width: number;
    height: number;
}

export interface ElementRect {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

export interface PositionStyles extends CSSProperties {
    position: 'fixed';
    top: string;
    left: string;
    zIndex: number;
    opacity?: number;
}

export interface FloatingContainerProps {
    options: FloatingMenuOptions;
    children: ReactNode;
    className?: string;
    menuClassName?: string;
    portalTarget?: HTMLElement;
}

export interface FloatingMenuProps {
    isVisible: boolean;
    menuRef: React.RefObject<HTMLDivElement>;
    styles: PositionStyles;
    options: FloatingMenuOptions;
    onItemClick: (originalOnClick: () => void, event: MouseEvent) => void;
    className?: string;
    portalTarget?: HTMLElement;
}

export interface FloatingMenuItemProps {
    name: string;
    Icon: React.ComponentType<any>;
    onClick: () => void;
    onItemClick: (originalOnClick: () => void, event: MouseEvent) => void;
    className?: string;
    danger?: boolean;
}

export enum PositioningStrategy {
    BOTTOM = 'bottom',
    TOP = 'top',
    LEFT = 'left',
    RIGHT = 'right',
    CENTER = 'center'
}