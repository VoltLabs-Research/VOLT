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

import React from 'react';
import { BsThreeDots } from 'react-icons/bs';
import './FileItem.css';
import Container from '@/components/primitives/Container';

interface FileItemProps {
    data: object;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

const FileItem: React.FC<FileItemProps> = ({
    data,
    isSelected,
    onSelect,
    onDelete
}) => {
    return(
        <Container
            className={`file-item cursor-pointer ${isSelected ? 'selected' : ''}`}
            onClick={onSelect}
        >
            <Container className='d-flex content-between items-center'>
                <h4>{data.name}</h4>
                <i className='file-delete-icon-container'>
                    <BsThreeDots
                        onClick={onDelete}
                        className='file-delete-icon'
                    />
                </i>
            </Container>
        </Container>
    );
};

export default FileItem;
