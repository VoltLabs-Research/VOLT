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

import { useRef, useCallback } from 'react';

interface UseDoubleTapProps {
    onDoubleTap: () => void;
    latency?: number;
}

const useDoubleTap = ({ onDoubleTap, latency = 300 }: UseDoubleTapProps) => {
    const tapTimeoutRef = useRef<number>(0);
    const tapCountRef = useRef(0);

    const handleInteraction = useCallback(() => {
        tapCountRef.current += 1;

        if(tapCountRef.current === 1){
            tapTimeoutRef.current = setTimeout(() => {
                tapCountRef.current = 0;
            }, latency);
        }else if(tapCountRef.current === 2){
            if(tapTimeoutRef.current){
                clearTimeout(tapTimeoutRef.current);
            }

            tapCountRef.current = 0;
            onDoubleTap();
        }
    }, [onDoubleTap, latency]);

    return { onMouseDown: handleInteraction };
};

export default useDoubleTap;