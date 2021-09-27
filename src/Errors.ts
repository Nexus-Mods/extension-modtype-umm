import { ISchemaViolation } from './types';

export class NotPremiumError extends Error {
  constructor() {
    super('User is not premium');
    this.name = 'NotPremiumError';
  }
}

export class InvalidAPICallError extends Error {
  private mViolations: string[];
  constructor(violations: ISchemaViolation[]) {
    super('Invalid object received via API call');
    this.name = 'InvalidObjectError';
    this.mViolations = violations.map(vi => vi.message);
  }
}
