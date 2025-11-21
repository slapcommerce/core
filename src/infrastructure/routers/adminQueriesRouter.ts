import type { Database } from "bun:sqlite";
import {
  getProductListView,
} from "../../views/product/productListView";
import {
  GetProductListQuery,
  GetProductCollectionsQuery,
  GetProductVariantsQuery,
} from "../../views/product/queries";
import {
  getProductCollectionsView,
} from "../../views/product/productCollectionsView";
import {
  getProductVariantsView,
} from "../../views/product/productVariantsView";
import {
  getSlugRedirectsView,
  getSlugRedirectChain,
} from "../../views/slug/slugRedirectsView";
import { GetSlugRedirectsQuery } from "../../views/slug/queries";
import {
  getCollectionsView,
} from "../../views/collection/collectionsView";
import { GetCollectionsQuery } from "../../views/collection/queries";
import {
  getSchedulesView,
} from "../../views/schedule/schedulesView";
import { GetSchedulesQuery } from "../../views/schedule/queries";
import {
  getVariantsView,
} from "../../views/variant/variantsView";
import { GetVariantsQuery } from "../../views/variant/queries";

type Result<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: Error };

export function createAdminQueriesRouter(db: Database) {
  return async (type: string, params?: unknown): Promise<Result<unknown>> => {
    try {
      let data: unknown;
      switch (type) {
        case "productListView":
          data = getProductListView(db, params as GetProductListQuery);
          break;
        case "productCollectionsView":
          data = getProductCollectionsView(
            db,
            params as GetProductCollectionsQuery,
          );
          break;
        case "collectionsView":
          data = getCollectionsView(db, params as GetCollectionsQuery);
          break;
        case "productVariantsView":
          data = getProductVariantsView(
            db,
            params as GetProductVariantsQuery,
          );
          break;
        case "slugRedirectsView":
          data = getSlugRedirectsView(db, params as GetSlugRedirectsQuery);
          break;
        case "slugRedirectChain":
          data = getSlugRedirectChain(
            db,
            (
              params as {
                entityId: string;
                entityType: "product" | "collection";
              }
            ).entityId,
            (
              params as {
                entityId: string;
                entityType: "product" | "collection";
              }
            ).entityType,
          );
          break;
        case "schedulesView":
          data = getSchedulesView(db, params as GetSchedulesQuery);
          break;
        case "variantsView":
          data = getVariantsView(db, params as GetVariantsQuery);
          break;
        default:
          throw new Error(`Unknown query type: ${type}`);
      }
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };
}
