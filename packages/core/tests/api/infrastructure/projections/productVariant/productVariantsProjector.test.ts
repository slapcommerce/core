import { describe, test, expect } from "bun:test";
import { ProductVariantsProjector } from "../../../../../src/api/infrastructure/projections/productVariant/productVariantsProjector";
import {
  DropshipVariantCreatedEvent,
  DropshipVariantArchivedEvent,
  DropshipVariantPriceUpdatedEvent,
  type DropshipVariantState,
} from "../../../../../src/api/domain/dropshipVariant/events";
import {
  DigitalDownloadableVariantCreatedEvent,
  DigitalDownloadableVariantDigitalAssetAttachedEvent,
  type DigitalDownloadableVariantState,
} from "../../../../../src/api/domain/digitalDownloadableVariant/events";
import {
  DropshipProductCreatedEvent,
  DropshipProductDetailsUpdatedEvent,
  DropshipProductDefaultVariantSetEvent,
  type DropshipProductState,
} from "../../../../../src/api/domain/dropshipProduct/events";
import {
  DigitalDownloadableProductCreatedEvent,
  type DigitalDownloadableProductState,
} from "../../../../../src/api/domain/digitalDownloadableProduct/events";
import {
  VariantPositionsWithinProductCreatedEvent,
  VariantPositionsWithinProductReorderedEvent,
  type VariantPositionsWithinProductState,
} from "../../../../../src/api/domain/variantPositionsWithinProduct/events";
import { ImageCollection } from "../../../../../src/api/domain/_base/imageCollection";
import type { UnitOfWorkRepositories } from "../../../../../src/api/infrastructure/unitOfWork";
import type {
  ProductFieldsForVariant,
} from "../../../../../src/api/infrastructure/repositories/readModels/productVariantsReadModelRepository";

type AllVariantState = (DropshipVariantState | DigitalDownloadableVariantState) & { correlationId: string; version: number };

function createMockDropshipVariantState(
  overrides: Partial<DropshipVariantState> = {}
): DropshipVariantState {
  return {
    variantType: "dropship",
    productId: "product-123",
    sku: "SKU-001",
    listPrice: 29.99,
    saleType: null,
    saleValue: null,
    inventory: 100,
    options: { size: "M", color: "Blue" },
    status: "draft",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    publishedAt: null,
    images: ImageCollection.empty(),
    fulfillmentProviderId: null,
    supplierCost: null,
    supplierSku: null,
    saleSchedule: null,
    dropSchedule: null,
    ...overrides,
  };
}

function createMockDigitalVariantState(
  overrides: Partial<DigitalDownloadableVariantState> = {}
): DigitalDownloadableVariantState {
  return {
    variantType: "digital_downloadable",
    productId: "product-123",
    sku: "SKU-001",
    listPrice: 29.99,
    saleType: null,
    saleValue: null,
    inventory: -1 as const,
    options: { size: "M", color: "Blue" },
    status: "draft",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    publishedAt: null,
    images: ImageCollection.empty(),
    digitalAsset: null,
    maxDownloads: null,
    accessDurationDays: null,
    saleSchedule: null,
    dropSchedule: null,
    ...overrides,
  };
}

function createMockDropshipProductState(
  overrides: Partial<DropshipProductState> = {}
): DropshipProductState {
  return {
    productType: "dropship",
    name: "Test Product",
    description: "Test description",
    slug: "test-product",
    collections: ["collection-123"],
    variantPositionsAggregateId: "positions-123",
    defaultVariantId: null,
    richDescriptionUrl: "",
    vendor: "Test Vendor",
    variantOptions: [{ name: "Size", values: ["S", "M", "L"] }],
    metaTitle: "Test Meta Title",
    metaDescription: "Test Meta Description",
    tags: ["tag1", "tag2"],
    taxable: true,
    taxId: "tax-123",
    dropshipSafetyBuffer: 5,
    fulfillmentProviderId: null,
    supplierCost: null,
    supplierSku: null,
    status: "draft",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    publishedAt: null,
    dropSchedule: null,
    ...overrides,
  };
}

function createMockDigitalProductState(
  overrides: Partial<DigitalDownloadableProductState> = {}
): DigitalDownloadableProductState {
  return {
    productType: "digital_downloadable",
    name: "Test Digital Product",
    description: "Test description",
    slug: "test-digital-product",
    collections: ["collection-123"],
    variantPositionsAggregateId: "positions-123",
    defaultVariantId: null,
    richDescriptionUrl: "",
    vendor: "Test Vendor",
    variantOptions: [{ name: "Size", values: ["S", "M", "L"] }],
    metaTitle: "Test Meta Title",
    metaDescription: "Test Meta Description",
    tags: ["tag1", "tag2"],
    taxable: true,
    taxId: "tax-123",
    maxDownloads: null,
    accessDurationDays: null,
    status: "draft",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    publishedAt: null,
    dropSchedule: null,
    ...overrides,
  };
}

function createMockProductFields(): ProductFieldsForVariant {
  return {
    productName: "Test Product",
    productSlug: "test-product",
    productDescription: "Test description",
    productStatus: "draft",
    productVendor: "Test Vendor",
    productType: "digital",
    dropshipSafetyBuffer: undefined,
    fulfillmentProviderId: null,
    supplierCost: null,
    supplierSku: null,
    maxDownloads: null,
    accessDurationDays: null,
    defaultVariantId: null,
    variantOptions: [{ name: "Size", values: ["S", "M", "L"] }],
    collections: ["collection-123"],
    tags: ["tag1", "tag2"],
    taxable: true,
    taxId: "tax-123",
    metaTitle: "Test Meta Title",
    metaDescription: "Test Meta Description",
    richDescriptionUrl: "",
    productCreatedAt: new Date("2024-01-01"),
    productUpdatedAt: new Date("2024-01-01"),
    productPublishedAt: null,
  };
}

function createMockVariantPositionsState(
  overrides: Partial<VariantPositionsWithinProductState> = {}
): VariantPositionsWithinProductState {
  return {
    productId: "product-123",
    variantIds: ["variant-1", "variant-2"],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

type MockRepositories = {
  repositories: UnitOfWorkRepositories;
  savedVariants: Array<{
    variantId: string;
    variantState: AllVariantState;
    productFields: ProductFieldsForVariant;
  }>;
  updatedProductFields: Array<{
    productId: string;
    productFields: ProductFieldsForVariant;
  }>;
  updatedPositions: Array<{
    productId: string;
    positions: Array<{ variantId: string; position: number }>;
  }>;
  productFieldsLookup: Map<string, ProductFieldsForVariant>;
};

function createMockRepositories(): MockRepositories {
  const savedVariants: MockRepositories["savedVariants"] = [];
  const updatedProductFields: MockRepositories["updatedProductFields"] = [];
  const updatedPositions: MockRepositories["updatedPositions"] = [];
  const productFieldsLookup = new Map<string, ProductFieldsForVariant>();

  // Set up default product fields for lookups
  productFieldsLookup.set("product-123", createMockProductFields());

  const mockProductVariantsReadModelRepository = {
    saveFromVariantState: (
      variantId: string,
      variantState: AllVariantState,
      productFields: ProductFieldsForVariant
    ) => {
      savedVariants.push({ variantId, variantState, productFields });
    },
    updateProductFields: (
      productId: string,
      productFields: ProductFieldsForVariant
    ) => {
      updatedProductFields.push({ productId, productFields });
    },
    updatePositions: (
      productId: string,
      positions: Array<{ variantId: string; position: number }>
    ) => {
      updatedPositions.push({ productId, positions });
    },
    getProductFields: (productId: string): ProductFieldsForVariant | null => {
      return productFieldsLookup.get(productId) ?? null;
    },
  };

  const repositories = {
    productVariantsReadModelRepository: mockProductVariantsReadModelRepository,
  } as unknown as UnitOfWorkRepositories;

  return {
    repositories,
    savedVariants,
    updatedProductFields,
    updatedPositions,
    productFieldsLookup,
  };
}

describe("ProductVariantsProjector", () => {
  describe("Dropship variant events", () => {
    test("should handle dropship_variant.created event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockDropshipVariantState({ sku: "NEW-SKU" });
      const event = new DropshipVariantCreatedEvent({
        occurredAt: new Date(),
        aggregateId: "variant-123",
        correlationId: "correlation-123",
        version: 0,
        userId: "user-123",
        priorState: createMockDropshipVariantState(),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.savedVariants).toHaveLength(1);
      expect(mock.savedVariants[0]?.variantId).toBe("variant-123");
      expect(mock.savedVariants[0]?.variantState.sku).toBe("NEW-SKU");
      expect(mock.savedVariants[0]?.variantState.correlationId).toBe(
        "correlation-123"
      );
      expect(mock.savedVariants[0]?.variantState.version).toBe(0);
      expect(mock.savedVariants[0]?.productFields.productName).toBe(
        "Test Product"
      );
    });

    test("should handle dropship_variant.archived event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockDropshipVariantState({ status: "archived" });
      const event = new DropshipVariantArchivedEvent({
        occurredAt: new Date(),
        aggregateId: "variant-123",
        correlationId: "correlation-123",
        version: 1,
        userId: "user-123",
        priorState: createMockDropshipVariantState({ status: "draft" }),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.savedVariants).toHaveLength(1);
      expect(mock.savedVariants[0]?.variantState.status).toBe("archived");
    });

    test("should handle dropship_variant.price_updated event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockDropshipVariantState({ listPrice: 49.99 });
      const event = new DropshipVariantPriceUpdatedEvent({
        occurredAt: new Date(),
        aggregateId: "variant-123",
        correlationId: "correlation-123",
        version: 1,
        userId: "user-123",
        priorState: createMockDropshipVariantState({ listPrice: 29.99 }),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.savedVariants).toHaveLength(1);
      expect(mock.savedVariants[0]?.variantState.listPrice).toBe(49.99);
    });

    test("should not save variant if product not found", async () => {
      // Arrange
      const mock = createMockRepositories();
      mock.productFieldsLookup.clear(); // Remove product data
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockDropshipVariantState();
      const event = new DropshipVariantCreatedEvent({
        occurredAt: new Date(),
        aggregateId: "variant-123",
        correlationId: "correlation-123",
        version: 0,
        userId: "user-123",
        priorState: createMockDropshipVariantState(),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.savedVariants).toHaveLength(0);
    });
  });

  describe("Digital downloadable variant events", () => {
    test("should handle digital_downloadable_variant.created event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockDigitalVariantState({ sku: "DIGITAL-SKU" });
      const event = new DigitalDownloadableVariantCreatedEvent({
        occurredAt: new Date(),
        aggregateId: "variant-456",
        correlationId: "correlation-456",
        version: 0,
        userId: "user-123",
        priorState: createMockDigitalVariantState(),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.savedVariants).toHaveLength(1);
      expect(mock.savedVariants[0]?.variantId).toBe("variant-456");
      expect(mock.savedVariants[0]?.variantState.sku).toBe("DIGITAL-SKU");
      expect(mock.savedVariants[0]?.variantState.variantType).toBe("digital_downloadable");
    });

    test("should handle digital_downloadable_variant.digital_asset_attached event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const digitalAsset = {
        name: "test-file.pdf",
        fileKey: "files/test-file.pdf",
        mimeType: "application/pdf",
        size: 1024,
      };
      const newState = createMockDigitalVariantState({ digitalAsset });
      const event = new DigitalDownloadableVariantDigitalAssetAttachedEvent({
        occurredAt: new Date(),
        aggregateId: "variant-123",
        correlationId: "correlation-123",
        version: 1,
        userId: "user-123",
        priorState: createMockDigitalVariantState(),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.savedVariants).toHaveLength(1);
      const savedState = mock.savedVariants[0]?.variantState as DigitalDownloadableVariantState;
      expect(savedState.digitalAsset).toEqual(digitalAsset);
    });
  });

  describe("Dropship product events", () => {
    test("should handle dropship_product.created event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockDropshipProductState({ name: "New Product Name" });
      const event = new DropshipProductCreatedEvent({
        occurredAt: new Date(),
        aggregateId: "product-123",
        correlationId: "correlation-123",
        version: 0,
        userId: "user-123",
        priorState: createMockDropshipProductState(),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.updatedProductFields).toHaveLength(1);
      expect(mock.updatedProductFields[0]?.productId).toBe("product-123");
      expect(mock.updatedProductFields[0]?.productFields.productName).toBe(
        "New Product Name"
      );
      expect(mock.updatedProductFields[0]?.productFields.productType).toBe("dropship");
    });

    test("should handle dropship_product.details_updated event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockDropshipProductState({
        name: "Updated Name",
        description: "Updated description",
      });
      const event = new DropshipProductDetailsUpdatedEvent({
        occurredAt: new Date(),
        aggregateId: "product-123",
        correlationId: "correlation-123",
        version: 1,
        userId: "user-123",
        priorState: createMockDropshipProductState(),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.updatedProductFields).toHaveLength(1);
      expect(mock.updatedProductFields[0]?.productFields.productName).toBe(
        "Updated Name"
      );
      expect(
        mock.updatedProductFields[0]?.productFields.productDescription
      ).toBe("Updated description");
    });

    test("should handle dropship_product.default_variant_set event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockDropshipProductState({
        defaultVariantId: "variant-456",
      });
      const event = new DropshipProductDefaultVariantSetEvent({
        occurredAt: new Date(),
        aggregateId: "product-123",
        correlationId: "correlation-123",
        version: 1,
        userId: "user-123",
        priorState: createMockDropshipProductState({ defaultVariantId: null }),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.updatedProductFields).toHaveLength(1);
      expect(mock.updatedProductFields[0]?.productFields.defaultVariantId).toBe(
        "variant-456"
      );
    });
  });

  describe("Digital downloadable product events", () => {
    test("should handle digital_downloadable_product.created event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockDigitalProductState({ name: "New Digital Product" });
      const event = new DigitalDownloadableProductCreatedEvent({
        occurredAt: new Date(),
        aggregateId: "product-456",
        correlationId: "correlation-456",
        version: 0,
        userId: "user-123",
        priorState: createMockDigitalProductState(),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.updatedProductFields).toHaveLength(1);
      expect(mock.updatedProductFields[0]?.productId).toBe("product-456");
      expect(mock.updatedProductFields[0]?.productFields.productName).toBe(
        "New Digital Product"
      );
      expect(mock.updatedProductFields[0]?.productFields.productType).toBe("digital");
    });
  });

  describe("VariantPositionsWithinProduct events", () => {
    test("should handle variantPositionsWithinProduct.created event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockVariantPositionsState({
        variantIds: ["variant-1", "variant-2", "variant-3"],
      });
      const event = new VariantPositionsWithinProductCreatedEvent({
        occurredAt: new Date(),
        aggregateId: "positions-123",
        correlationId: "correlation-123",
        version: 0,
        userId: "user-123",
        priorState: {} as VariantPositionsWithinProductState,
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.updatedPositions).toHaveLength(1);
      expect(mock.updatedPositions[0]?.productId).toBe("product-123");
      expect(mock.updatedPositions[0]?.positions).toEqual([
        { variantId: "variant-1", position: 0 },
        { variantId: "variant-2", position: 1 },
        { variantId: "variant-3", position: 2 },
      ]);
    });

    test("should handle variantPositionsWithinProduct.reordered event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockVariantPositionsState({
        variantIds: ["variant-3", "variant-1", "variant-2"],
      });
      const event = new VariantPositionsWithinProductReorderedEvent({
        occurredAt: new Date(),
        aggregateId: "positions-123",
        correlationId: "correlation-123",
        version: 1,
        userId: "user-123",
        priorState: createMockVariantPositionsState(),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.updatedPositions).toHaveLength(1);
      expect(mock.updatedPositions[0]?.positions).toEqual([
        { variantId: "variant-3", position: 0 },
        { variantId: "variant-1", position: 1 },
        { variantId: "variant-2", position: 2 },
      ]);
    });
  });

  test("should ignore unhandled events", async () => {
    // Arrange
    const mock = createMockRepositories();
    const projector = new ProductVariantsProjector(mock.repositories);
    const unknownEvent = {
      eventName: "unknown.event",
      aggregateId: "test-123",
      correlationId: "correlation-123",
      version: 0,
      userId: "user-123",
      occurredAt: new Date(),
      payload: {},
    };

    // Act
    await projector.execute(unknownEvent as any);

    // Assert
    expect(mock.savedVariants).toHaveLength(0);
    expect(mock.updatedProductFields).toHaveLength(0);
    expect(mock.updatedPositions).toHaveLength(0);
  });
});
