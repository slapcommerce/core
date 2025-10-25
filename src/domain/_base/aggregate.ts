export interface DomainAggregate<Name extends string> {
  id: string;
  version: number;
  aggregateType: Name;
}
