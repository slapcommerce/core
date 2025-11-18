import type { Database } from "bun:sqlite";
import {
  getProductListView,
  type ProductListViewParams,
} from "../../views/productListView";
import {
  getProductCollectionsView,
  type ProductCollectionsViewParams,
} from "../../views/productCollectionsView";
import {
  getProductVariantsView,
  type ProductVariantsViewParams,
} from "../../views/productVariantsView";
import {
  getSlugRedirectsView,
  getSlugRedirectChain,
  type SlugRedirectsViewParams,
} from "../../views/slugRedirectsView";
import {
  getCollectionsView,
  type CollectionsViewParams,
} from "../../views/collectionsView";
import {
  getSchedulesView,
  type SchedulesViewParams,
} from "../../views/schedulesView";
import {
  getVariantsView,
  type VariantsViewParams,
} from "../../views/variantsView";

type Result<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: Error };

export function createAdminQueriesRouter(db: Database) {
  return async (type: string, params?: unknown): Promise<Result<unknown>> => {
    try {
      let data: unknown;
      switch (type) {
        case "productListView":
          data = getProductListView(db, params as ProductListViewParams);
          break;
        case "productCollectionsView":
          data = getProductCollectionsView(
            db,
            params as ProductCollectionsViewParams,
          );
          break;
        case "collectionsView":
          data = getCollectionsView(db, params as CollectionsViewParams);
          break;
        case "productVariantsView":
          data = getProductVariantsView(
            db,
            params as ProductVariantsViewParams,
          );
          break;
        case "slugRedirectsView":
          data = getSlugRedirectsView(db, params as SlugRedirectsViewParams);
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
          data = getSchedulesView(db, params as SchedulesViewParams);
          break;
        case "variantsView":
          data = getVariantsView(db, params as VariantsViewParams);
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
