import type { Clock, IdGenerator } from '@grounded/application';

export class FixedClock implements Clock {
  readonly #instant: Date;

  constructor(instant: Date) {
    this.#instant = new Date(instant);
  }

  now(): Date {
    return new Date(this.#instant);
  }
}

export class SequenceIdGenerator implements IdGenerator {
  #next = 0;

  create(): string {
    this.#next += 1;
    return `test-id-${this.#next}`;
  }
}
