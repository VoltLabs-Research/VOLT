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

import { HiPlus, HiArrowUp } from 'react-icons/hi';
import './AIPromptBox.css';

const AIPromptBox = () => {

    return (
        <div className='ai-prompt-container-wrapper'>
            <div className='ai-prompt-add-file-container'>
                <i className='ai-prompt-add-file-icon-container'>
                    <HiPlus />
                </i>
                <span className='ai-prompt-add-file-title'>Add files</span>
            </div>
            <div className='ai-prompt-container'>
                <input className='ai-prompt-input' placeholder="I'm here to help you, ask me for anything." />
                <i className='ai-prompt-icon-container'>
                    <HiArrowUp />
                </i>
            </div>
        </div>
    );
};

export default AIPromptBox;