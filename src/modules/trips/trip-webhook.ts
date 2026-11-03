import { createHmac } from 'crypto';

export const SIGNATURE_HEADER = 'X-Telematics-Signature';
export const EVENT_HEADER = 'X-Telematics-Event';
export const POSITION_THROTTLE_MS = 2000;
export const DELIVERY_TIMEOUT_MS = 5000;
export const RETRY_DELAYS_MS = [1000, 5000, 15000];

export function signBody(rawBody: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

export class LatestWinsThrottle<T> {
  private readonly lastSent = new Map<number, number>();
  private readonly pending = new Map<number, T>();
  private readonly timers = new Map<number, NodeJS.Timeout>();

  constructor(
    private readonly windowMs: number,
    private readonly send: (value: T) => void,
    private readonly now: () => number = Date.now,
  ) {}

  push(key: number, value: T): void {
    const wait = (this.lastSent.get(key) ?? -Infinity) + this.windowMs - this.now();
    if (wait <= 0 && !this.timers.has(key)) {
      this.fire(key, value);
      return;
    }
    this.pending.set(key, value);
    if (!this.timers.has(key)) {
      const timer = setTimeout(() => this.flush(key), Math.max(wait, 0));
      timer.unref?.();
      this.timers.set(key, timer);
    }
  }

  forget(key: number): void {
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
    this.pending.delete(key);
    this.lastSent.delete(key);
  }

  private flush(key: number): void {
    this.timers.delete(key);
    const value = this.pending.get(key);
    this.pending.delete(key);
    if (value !== undefined) this.fire(key, value);
  }

  private fire(key: number, value: T): void {
    this.lastSent.set(key, this.now());
    this.send(value);
  }
}
