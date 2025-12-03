import { writable, derived, get } from 'svelte/store';
import { api } from '$lib/api/client';

export type FulfillmentType = 'digital' | 'dropship';
export type ProductStatus = 'draft' | 'active' | 'archived';

export type Product = {
  aggregateId: string;
  name: string;
  slug: string;
  vendor: string;
  description: string;
  tags: string[];
  createdAt: string;
  status: ProductStatus;
  correlationId: string;
  version: number;
  updatedAt: string;
  publishedAt: string | null;
  collections: Array<{ collectionId: string; position: number }>;
  metaTitle: string;
  metaDescription: string;
  richDescriptionUrl: string | null;
  productType: FulfillmentType;
  dropshipSafetyBuffer: number | null;
  fulfillmentProviderId: string | null;
  supplierCost: number | null;
  supplierSku: string | null;
  maxDownloads: number | null;
  accessDurationDays: number | null;
  defaultVariantId: string | null;
  variantOptions: Array<{
    name: string;
    values: string[];
  }>;
  taxable: number;
  taxId: string | null;
};

export type GetProductListQuery = {
  status?: ProductStatus;
  collectionId?: string;
  limit?: number;
  offset?: number;
};

interface ProductsState {
  products: Product[];
  loading: boolean;
  error: string | null;
}

function getProductCommandType(baseCommand: string, fulfillmentType: FulfillmentType): string {
  const prefix = fulfillmentType === 'digital' ? 'DigitalDownloadable' : 'Dropship';
  return baseCommand.replace('Product', `${prefix}Product`);
}

function createProductsStore() {
  const { subscribe, set, update } = writable<ProductsState>({
    products: [],
    loading: false,
    error: null
  });

  return {
    subscribe,

    async fetchProducts(params?: GetProductListQuery) {
      update(s => ({ ...s, loading: true, error: null }));

      try {
        const products = await api.query<Product[]>('getProducts', params || {});
        set({ products, loading: false, error: null });
        return products;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to fetch products';
        update(s => ({ ...s, loading: false, error }));
        throw err;
      }
    },

    getProductById(id: string): Product | undefined {
      const state = get({ subscribe });
      return state.products.find(p => p.aggregateId === id);
    },

    // Optimistic update helper
    updateProductInStore(productId: string, updates: Partial<Product>) {
      update(state => ({
        ...state,
        products: state.products.map(p =>
          p.aggregateId === productId ? { ...p, ...updates } : p
        )
      }));
    },

    // Command helpers
    async createProduct(payload: {
      id: string;
      correlationId: string;
      userId: string;
      name: string;
      description: string;
      slug: string;
      collections: string[];
      richDescriptionUrl: string;
      vendor: string;
      variantOptions: Array<{ name: string; values: string[] }>;
      metaTitle: string;
      metaDescription: string;
      tags: string[];
      taxable: boolean;
      taxId?: string;
      fulfillmentType: FulfillmentType;
      dropshipSafetyBuffer?: number;
    }) {
      const commandType = getProductCommandType('createProduct', payload.fulfillmentType);
      await api.command(commandType, payload);
    },

    async archiveProduct(payload: {
      id: string;
      userId: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) {
      const commandType = getProductCommandType('archiveProduct', payload.fulfillmentType);
      await api.command(commandType, payload);
    },

    async publishProduct(payload: {
      id: string;
      userId: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) {
      const commandType = getProductCommandType('publishProduct', payload.fulfillmentType);
      await api.command(commandType, payload);
    },

    async unpublishProduct(payload: {
      id: string;
      userId: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) {
      const commandType = getProductCommandType('unpublishProduct', payload.fulfillmentType);
      await api.command(commandType, payload);
    },

    async updateProductDetails(payload: {
      id: string;
      userId: string;
      name: string;
      description: string;
      richDescriptionUrl: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) {
      const commandType = getProductCommandType('updateProductDetails', payload.fulfillmentType);
      await api.command(commandType, payload);
    },

    async updateProductMetadata(payload: {
      id: string;
      userId: string;
      metaTitle: string;
      metaDescription: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) {
      const commandType = getProductCommandType('updateProductMetadata', payload.fulfillmentType);
      await api.command(commandType, payload);
    },

    async updateProductTags(payload: {
      id: string;
      userId: string;
      tags: string[];
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) {
      const commandType = getProductCommandType('updateProductTags', payload.fulfillmentType);
      await api.command(commandType, payload);
    },

    async updateProductCollections(payload: {
      id: string;
      userId: string;
      collections: string[];
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) {
      const commandType = getProductCommandType('updateProductCollections', payload.fulfillmentType);
      await api.command(commandType, payload);
    },

    async updateProductOptions(payload: {
      id: string;
      userId: string;
      variantOptions: Array<{ name: string; values: string[] }>;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) {
      const commandType = getProductCommandType('updateProductOptions', payload.fulfillmentType);
      await api.command(commandType, payload);
    },

    async changeProductSlug(payload: {
      id: string;
      userId: string;
      newSlug: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) {
      const commandType = getProductCommandType('changeProductSlug', payload.fulfillmentType);
      await api.command(commandType, payload);
    },

    async updateProductDownloadSettings(payload: {
      id: string;
      userId: string;
      maxDownloads: number | null;
      accessDurationDays: number | null;
      expectedVersion: number;
    }) {
      await api.command('updateDigitalDownloadableProductDownloadSettings', payload);
    },

    async updateDropshipProductSafetyBuffer(payload: {
      id: string;
      userId: string;
      safetyBuffer: number;
      expectedVersion: number;
    }) {
      await api.command('updateDropshipProductSafetyBuffer', payload);
    }
  };
}

export const productsStore = createProductsStore();
export const products = derived(productsStore, $store => $store.products);
export const productsLoading = derived(productsStore, $store => $store.loading);
export const productsError = derived(productsStore, $store => $store.error);
