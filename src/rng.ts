export class Rng {
    private _state: number;
    private _useMath: boolean;

    constructor(seed?: number) {
        if (seed === undefined) {
            this._useMath = true;
            this._state = 0;
        } else {
            this._useMath = false;
            this._state = seed | 0;
        }
    }

    private _nextRaw(): number {
        this._state = (this._state + 0x6d2b79f5) | 0;
        let t = Math.imul(this._state ^ (this._state >>> 15), 1 | this._state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    private _gen(): number {
        if (this._useMath) return Math.random();
        return this._nextRaw();
    }

    next(min?: number, max?: number): number {
        if (min !== undefined && max !== undefined) {
            return min + this._gen() * (max - min);
        }
        return this._gen();
    }

    nextInteger(min: number, max: number): number {
        return min + Math.floor(this._gen() * (max - min + 1));
    }

    shuffle<T>(arr: T[]): T[] {
        const result = arr.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(this._gen() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    pick<T>(arr: T[]): T {
        return arr[Math.floor(this._gen() * arr.length)];
    }
}
