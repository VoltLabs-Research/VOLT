/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
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

export interface AggregatorClock{
    now(): Date;
};

export interface AggregatorConfig{
    weeks?: number;
    timezone?: string;
    metricKey?: string;
    clock?: AggregatorClock;
};

const defaultClock: AggregatorClock = {
    now(){
        return new Date();
    }
};

export default abstract class BaseListingAggregator{
    protected readonly weeks: number;
    protected readonly timezone: string;
    protected readonly metricKey: string;
    protected readonly clock: AggregatorClock;

    constructor(config: AggregatorConfig = {}){
        this.weeks = config.weeks ?? 12;
        this.timezone = config.timezone || 'UTC';
        this.metricKey = config.metricKey ?? 'documents';
        this.clock = config.clock ?? defaultClock;
    }

    abstract collect(): Promise<{
        totals: Record<string, number>;
        lastMonth: Record<string, number>;
        weekly: { labels: string[]; [series: string]: number[] | string[] };
    }>;

    protected get now(): Date{
        return this.clock.now();
    }

    protected get monthStart(): Date{
        const d = new Date(this.now);
        return new Date(d.getFullYear(), d.getMonth(), 1);
    }

    protected get prevMonthStart(): Date{
        const d = new Date(this.now);
        return new Date(d.getFullYear(), d.getMonth() - 1, 1);
    }

    protected get sinceDate(): Date{
        const d = new Date(this.now);
        d.setUTCDate(d.getUTCDate() - this.weeks * 7);
        d.setUTCHours(0, 0, 0, 0);
        return d;
    }

    protected pct(current: number, prev: number): number{
        if(prev === 0){
            return current > 0 ? 100 : 0;
        }
        return Math.round(((current - prev) / prev) * 100);
    }

    protected toWeekKey(date: Date): string{
        const monday = new Date(date);
        monday.setUTCHours(0, 0, 0, 0);
        const day = monday.getUTCDay();
        const diff = (day + 6) % 7;
        monday.setUTCDate(monday.getUTCDate() - diff);
        return monday.toISOString().slice(0, 10);
    }
};
