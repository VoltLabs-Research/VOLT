/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import '@/shared/presentation/components/atoms/form/Input/Input.css';
import Container from '@/shared/presentation/components/primitives/Container';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import Tooltip from '@/shared/presentation/components/atoms/common/Tooltip';

// Expression autocomplete types
interface AvailableExpression {
    nodeId: string;
    nodeName: string;
    nodeType: string;
    path: string;
    fullExpression: string;
    type: string;
    description?: string;
}

interface ExpressionAutocompleteProps {
    nodeId: string;
    getExpressions: (nodeId: string) => AvailableExpression[];
    getNodeConfig?: (nodeType: string) => { icon?: string; label?: string } | null;
}

interface InputProps {
    type?: 'text' | 'number' | 'email' | 'password';
    value: string | number;
    onChange: (value: string | number) => void;
    placeholder?: string;
    disabled?: boolean;
    step?: string | number;
    min?: string | number;
    max?: string | number;
    className?: string;
    autoFocus?: boolean;
    required?: boolean;
    multiline?: boolean;
    rows?: number;
    // Expression autocomplete support
    expressionAutocomplete?: ExpressionAutocompleteProps;
}

const containsExpression = (value: string): boolean => {
    return /\{\{.*?\}\}/.test(value);
};

const Input: React.FC<InputProps> = ({
    type = 'text',
    value,
    onChange,
    placeholder,
    disabled = false,
    step,
    min,
    max,
    className = '',
    autoFocus = false,
    required = false,
    multiline = false,
    rows = 3,
    expressionAutocomplete
}) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [filter, setFilter] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const isExpressionEnabled = !!expressionAutocomplete;

    const availableExpressions = useMemo(() => {
        if (!isExpressionEnabled) return [];
        return expressionAutocomplete.getExpressions(expressionAutocomplete.nodeId);
    }, [isExpressionEnabled, expressionAutocomplete]);

    const filteredExpressions = useMemo(() => {
        if (!filter) return availableExpressions;
        const lowerFilter = filter.toLowerCase();
        return availableExpressions.filter(expr =>
            expr.path.toLowerCase().includes(lowerFilter) ||
            expr.nodeName.toLowerCase().includes(lowerFilter) ||
            expr.description?.toLowerCase().includes(lowerFilter)
        );
    }, [availableExpressions, filter]);

    // Group expressions by node
    const groupedExpressions = useMemo(() => {
        const groups: Record<string, AvailableExpression[]> = {};
        for (const expr of filteredExpressions) {
            if (!groups[expr.nodeName]) {
                groups[expr.nodeName] = [];
            }
            groups[expr.nodeName].push(expr);
        }
        return groups;
    }, [filteredExpressions]);

    const flatExpressions = useMemo(() => {
        return Object.values(groupedExpressions).flat();
    }, [groupedExpressions]);

    const updateDropdownPosition = useCallback(() => {
        if (!inputRef.current) return;
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX
        });
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const newCursorPos = e.target.selectionStart || 0;

        // For number type without expression autocomplete, parse as number
        if (type === 'number' && !isExpressionEnabled) {
            onChange(parseFloat(newValue) || 0);
            return;
        }

        onChange(newValue);

        if (!isExpressionEnabled) return;

        setCursorPosition(newCursorPos);

        // Check if user just typed {{ to trigger dropdown
        const textBeforeCursor = newValue.slice(0, newCursorPos);
        const lastOpenBrace = textBeforeCursor.lastIndexOf('{{');
        const lastCloseBrace = textBeforeCursor.lastIndexOf('}}');

        if (lastOpenBrace !== -1 && lastOpenBrace > lastCloseBrace) {
            const filterText = textBeforeCursor.slice(lastOpenBrace + 2).trim();
            setFilter(filterText);
            setShowDropdown(true);
            setSelectedIndex(0);
            requestAnimationFrame(() => {
                updateDropdownPosition();
            });
        } else {
            setShowDropdown(false);
            setFilter('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showDropdown || !isExpressionEnabled) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, flatExpressions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
            case 'Tab':
                if (flatExpressions[selectedIndex]) {
                    e.preventDefault();
                    insertExpression(flatExpressions[selectedIndex]);
                }
                break;
            case 'Escape':
                setShowDropdown(false);
                break;
        }
    };

    const insertExpression = (expr: AvailableExpression) => {
        if (!inputRef.current) return;

        const stringValue = String(value);
        const textBeforeCursor = stringValue.slice(0, cursorPosition);
        const textAfterCursor = stringValue.slice(cursorPosition);

        const lastOpenBrace = textBeforeCursor.lastIndexOf('{{');

        const newValue = textBeforeCursor.slice(0, lastOpenBrace) +
            expr.fullExpression +
            textAfterCursor;

        onChange(newValue);
        setShowDropdown(false);
        setFilter('');

        const newCursorPos = lastOpenBrace + expr.fullExpression.length;
        setTimeout(() => {
            inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
            inputRef.current?.focus();
        }, 0);
    };

    const handleFocus = () => {
        if (isExpressionEnabled) {
            updateDropdownPosition();
        }
    };

    const handleBlur = () => {
        setTimeout(() => {
            if (!dropdownRef.current?.contains(document.activeElement)) {
                setShowDropdown(false);
            }
        }, 150);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!isExpressionEnabled) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                inputRef.current &&
                !inputRef.current.contains(e.target as Node) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isExpressionEnabled]);

    // Scroll selected item into view
    useEffect(() => {
        if (showDropdown && dropdownRef.current) {
            const selectedEl = dropdownRef.current.querySelector('.expression-item--selected');
            selectedEl?.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex, showDropdown]);

    // Update dropdown position when visible
    useEffect(() => {
        if (showDropdown) {
            updateDropdownPosition();
        }
    }, [showDropdown, updateDropdownPosition]);

    const hasExpression = isExpressionEnabled && containsExpression(String(value));

    const inputClassName = `${className} ${hasExpression ? 'input--has-expression' : ''}`.trim();

    const renderDropdown = () => {
        if (!showDropdown || !isExpressionEnabled) return null;

        return createPortal(
            <Container
                ref={dropdownRef}
                className="d-flex column overflow-hidden expression-dropdown"
                style={{
                    position: 'absolute',
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                    zIndex: 9999
                }}
            >
                <Container className="d-flex content-between items-center expression-dropdown-header">
                    <span className="expression-dropdown-title font-weight-6 color-muted">Available Data</span>
                    <span className="expression-dropdown-hint color-muted">↑↓ Navigate • Enter Select • Esc Close</span>
                </Container>
                <Container className="y-auto p-05">
                    {flatExpressions.length === 0 ? (
                        <Container className="d-flex column gap-05 text-center p-1">
                            <Paragraph className='font-size-2 font-weight-5'>No data available</Paragraph>
                            <Paragraph className='font-size-1'>Connect this node to upstream nodes to access their data.</Paragraph>
                        </Container>
                    ) : (
                        Object.entries(groupedExpressions).map(([nodeName, expressions]) => {
                            const nodeType = expressions[0]?.nodeType;
                            const config = expressionAutocomplete.getNodeConfig?.(nodeType);

                            return (
                                <Container key={nodeName} className="expression-group">
                                    <Container className="d-flex items-center gap-05 expression-group-header">
                                        <span className="expression-group-icon font-size-1">{config?.icon?.replace('Tb', '') || '📦'}</span>
                                        <span className="expression-group-name flex-1 font-size-1 font-weight-6 color-primary">{nodeName}</span>
                                        <span className="expression-group-type color-muted">{config?.label || nodeType}</span>
                                    </Container>
                                    {expressions.map((expr) => {
                                        const globalIndex = flatExpressions.indexOf(expr);
                                        return (
                                            <Container
                                                key={`${expr.nodeId}-${expr.path}`}
                                                className={`expression-item ${globalIndex === selectedIndex ? 'expression-item--selected' : ''} cursor-pointer`}
                                                onClick={() => insertExpression(expr)}
                                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                                            >
                                                <Container className="d-flex items-center gap-05">
                                                    <span className="expression-item-path font-weight-5">{expr.path}</span>
                                                    <span className={`expression-item-type expression-item-type--${expr.type} font-weight-5`}>
                                                        {expr.type}
                                                    </span>
                                                </Container>
                                                {expr.description && (
                                                    <span className="expression-item-description color-muted">{expr.description}</span>
                                                )}
                                            </Container>
                                        );
                                    })}
                                </Container>
                            );
                        })
                    )}
                </Container>
            </Container>,
            document.body
        );
    };

    if (multiline) {
        return (
            <Container className="p-relative w-max input-wrapper flex-1">
                <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    value={String(value)}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={inputClassName}
                    autoFocus={autoFocus}
                    required={required}
                    rows={rows}
                />
                {hasExpression && (
                    <Tooltip content="Contains dynamic expression" placement="left">
                        <Container className="expression-badge p-absolute font-weight-6">
                            <span>{'{ }'}</span>
                        </Container>
                    </Tooltip>
                )}
                {renderDropdown()}
            </Container>
        );
    }

    // If expression autocomplete is enabled, wrap in container
    if (isExpressionEnabled) {
        return (
            <Container className="p-relative w-max input-wrapper flex-1">
                <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type={type}
                    value={String(value)}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    step={step}
                    min={min}
                    max={max}
                    className={inputClassName}
                    autoFocus={autoFocus}
                    required={required}
                />
                {hasExpression && (
                    <Tooltip content="Contains dynamic expression" placement="left">
                        <div className="expression-badge p-absolute font-weight-6">
                            <span>{'{ }'}</span>
                        </div>
                    </Tooltip>
                )}
                {renderDropdown()}
            </Container>
        );
    }

    // Standard input without expression support
    return (
        <input
            type={type}
            value={value}
            onChange={(e) => {
                const newValue = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                onChange(newValue);
            }}
            placeholder={placeholder}
            disabled={disabled}
            step={step}
            min={min}
            max={max}
            className={className}
            autoFocus={autoFocus}
            required={required}
        />
    );
};

export default Input;
