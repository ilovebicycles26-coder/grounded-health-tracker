import type { DomainError, Result, UserId } from '@grounded/domain';

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  create(): string;
}

export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Result<Output, DomainError>>;
}

export interface AuthenticatedActor {
  readonly userId: UserId;
}
