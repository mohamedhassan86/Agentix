export interface IUnitOfWork {
  execute<T>(work: () => Promise<T>): Promise<T>;
}
