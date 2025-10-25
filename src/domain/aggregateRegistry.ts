import { ProductAggregate } from "./product/aggregate";
import AggregateType from "./aggregateTypes";

export const aggregateRegistry: Record<string, any> = {
  [AggregateType.PRODUCT]: ProductAggregate,
};