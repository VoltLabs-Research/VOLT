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
 * LIABILITY, WHETHER IN AN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import Container from '@/components/primitives/Container';
import '@/features/canvas/components/atoms/SidebarNavigationOption/SidebarNavigationOption.css';
import Title from '@/components/primitives/Title';

const SidebarNavigationOption = ({ name, Icon, onClick = null, to = null, isSelected = false }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        if(onClick !== null){
            onClick();
        }

        if(to !== null){
            navigate(to);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={'d-flex cursor-pointer items-center sidebar-nav-option-container '.concat(isSelected ? 'selected' : '')}
        >
            <i className='sidebar-nav-option-icon-container'>
                <Icon />
            </i>

            <Title className='font-size-3 sidebar-nav-option-name'>{name}</Title>
        </div>
    );
};

export default SidebarNavigationOption;
