export class NotPremiumError extends Error {
  constructor() {
    super('User is not premium');
    this.name = 'NotPremiumError';
  }
}
