/**
 * Generated SDK client for Ecommerce API
 *
 * DO NOT EDIT MANUALLY - This file is auto-generated
 * Run: bun run sdk:generate
 *
 * Generated at: 2025-11-22T03:32:54.270Z
 */

import type * as Types from './types';

export interface SDKConfig {
  /** Base URL of the API (e.g., "https://api.example.com" or "http://localhost:3000") */
  baseUrl: string;

  /** Authentication token for admin endpoints */
  authToken?: string;
}

export class EcommerceSDK {
  constructor(private config: SDKConfig) {}

  /** Admin operations (requires authToken) */
  admin = {
    /** Admin commands */
    commands: {
      addCollectionImage: async (payload: Omit<Types.AddCollectionImageCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "addCollectionImage", payload);
      },

      addVariantImage: async (payload: Omit<Types.AddVariantImageCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "addVariantImage", payload);
      },

      archiveCollection: async (payload: Omit<Types.ArchiveCollectionCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "archiveCollection", payload);
      },

      archiveProduct: async (payload: Omit<Types.ArchiveProductCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "archiveProduct", payload);
      },

      archiveVariant: async (payload: Omit<Types.ArchiveVariantCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "archiveVariant", payload);
      },

      attachVariantDigitalAsset: async (payload: Omit<Types.AttachVariantDigitalAssetCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "attachVariantDigitalAsset", payload);
      },

      cancelSchedule: async (payload: Omit<Types.CancelScheduleCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "cancelSchedule", payload);
      },

      changeSlug: async (payload: Omit<Types.ChangeSlugCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "changeSlug", payload);
      },

      createCollection: async (payload: Omit<Types.CreateCollectionCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "createCollection", payload);
      },

      createProduct: async (payload: Omit<Types.CreateProductCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "createProduct", payload);
      },

      createSchedule: async (payload: Omit<Types.CreateScheduleCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "createSchedule", payload);
      },

      createVariant: async (payload: Omit<Types.CreateVariantCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "createVariant", payload);
      },

      detachVariantDigitalAsset: async (payload: Omit<Types.DetachVariantDigitalAssetCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "detachVariantDigitalAsset", payload);
      },

      publishCollection: async (payload: Omit<Types.PublishCollectionCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "publishCollection", payload);
      },

      publishProduct: async (payload: Omit<Types.PublishProductCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "publishProduct", payload);
      },

      publishVariant: async (payload: Omit<Types.PublishVariantCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "publishVariant", payload);
      },

      removeCollectionImage: async (payload: Omit<Types.RemoveCollectionImageCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "removeCollectionImage", payload);
      },

      removeVariantImage: async (payload: Omit<Types.RemoveVariantImageCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "removeVariantImage", payload);
      },

      reorderCollectionImages: async (payload: Omit<Types.ReorderCollectionImagesCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "reorderCollectionImages", payload);
      },

      reorderVariantImages: async (payload: Omit<Types.ReorderVariantImagesCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "reorderVariantImages", payload);
      },

      unpublishCollection: async (payload: Omit<Types.UnpublishCollectionCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "unpublishCollection", payload);
      },

      unpublishProduct: async (payload: Omit<Types.UnpublishProductCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "unpublishProduct", payload);
      },

      updateCollectionImage: async (payload: Omit<Types.UpdateCollectionImageCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateCollectionImage", payload);
      },

      updateCollectionImageAltText: async (payload: Omit<Types.UpdateCollectionImageAltTextCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateCollectionImageAltText", payload);
      },

      updateCollectionMetadata: async (payload: Omit<Types.UpdateCollectionMetadataCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateCollectionMetadata", payload);
      },

      updateCollectionSeoMetadata: async (payload: Omit<Types.UpdateCollectionSeoMetadataCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateCollectionSeoMetadata", payload);
      },

      updateProductClassification: async (payload: Omit<Types.UpdateProductClassificationCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateProductClassification", payload);
      },

      updateProductCollections: async (payload: Omit<Types.UpdateProductCollectionsCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateProductCollections", payload);
      },

      updateProductDetails: async (payload: Omit<Types.UpdateProductDetailsCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateProductDetails", payload);
      },

      updateProductFulfillmentType: async (payload: Omit<Types.UpdateProductFulfillmentTypeCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateProductFulfillmentType", payload);
      },

      updateProductMetadata: async (payload: Omit<Types.UpdateProductMetadataCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateProductMetadata", payload);
      },

      updateProductOptions: async (payload: Omit<Types.UpdateProductOptionsCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateProductOptions", payload);
      },

      updateProductPageLayout: async (payload: Omit<Types.UpdateProductPageLayoutCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateProductPageLayout", payload);
      },

      updateProductShippingSettings: async (payload: Omit<Types.UpdateProductShippingSettingsCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateProductShippingSettings", payload);
      },

      updateProductTags: async (payload: Omit<Types.UpdateProductTagsCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateProductTags", payload);
      },

      updateSchedule: async (payload: Omit<Types.UpdateScheduleCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateSchedule", payload);
      },

      updateVariantDetails: async (payload: Omit<Types.UpdateVariantDetailsCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateVariantDetails", payload);
      },

      updateVariantImageAltText: async (payload: Omit<Types.UpdateVariantImageAltTextCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateVariantImageAltText", payload);
      },

      updateVariantInventory: async (payload: Omit<Types.UpdateVariantInventoryCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateVariantInventory", payload);
      },

      updateVariantPrice: async (payload: Omit<Types.UpdateVariantPriceCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateVariantPrice", payload);
      },

      updateVariantSku: async (payload: Omit<Types.UpdateVariantSkuCommand, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "updateVariantSku", payload);
      },

    },

    /** Admin queries */
    queries: {
      collectionsView: async (params?: Types.GetCollectionsQuery): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/admin/api/queries", "collectionsView", params);
      },

      productCollectionsView: async (params?: Types.GetProductCollectionsQuery): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/admin/api/queries", "productCollectionsView", params);
      },

      productListView: async (params?: Types.GetProductListQuery): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/admin/api/queries", "productListView", params);
      },

      productVariantsView: async (params?: Types.GetProductVariantsQuery): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/admin/api/queries", "productVariantsView", params);
      },

      schedulesView: async (params?: Types.GetSchedulesQuery): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/admin/api/queries", "schedulesView", params);
      },

      slugRedirectsView: async (params?: Types.GetSlugRedirectsQuery): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/admin/api/queries", "slugRedirectsView", params);
      },

      variantsView: async (params?: Types.GetVariantsQuery): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/admin/api/queries", "variantsView", params);
      },

    }
  };

  /** Public operations (no auth required) */
  public = {
    /** Public queries */
    queries: {
      productCollectionsView: async (params?: Types.GetProductCollectionsQuery): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/api/queries", "productCollectionsView", params);
      },

      productListView: async (params?: Types.GetProductListQuery): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/api/queries", "productListView", params);
      },

      productVariantsView: async (params?: Types.GetProductVariantsQuery): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/api/queries", "productVariantsView", params);
      },

      slugRedirectsView: async (params?: Types.GetSlugRedirectsQuery): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/api/queries", "slugRedirectsView", params);
      },

    }
  };

  private async executeCommand(endpoint: string, type: string, payload: unknown): Promise<Types.CommandResult> {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.authToken && { "Authorization": `Bearer ${this.config.authToken}` })
      },
      body: JSON.stringify({ type, payload })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      return { success: false, error };
    }

    return await response.json();
  }

  private async executeQuery(endpoint: string, type: string, params?: unknown): Promise<Types.Result<unknown>> {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.authToken && { "Authorization": `Bearer ${this.config.authToken}` })
      },
      body: JSON.stringify({ type, params })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      return { success: false, error };
    }

    return await response.json();
  }
}
