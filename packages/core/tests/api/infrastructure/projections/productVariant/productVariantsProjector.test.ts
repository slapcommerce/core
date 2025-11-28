import { describe, test, expect } from "bun:test";
import { ProductVariantsProjector } from "../../../../../src/api/infrastructure/projections/productVariant/productVariantsProjector";
import {
  VariantCreatedEvent,
  VariantArchivedEvent,
  VariantPriceUpdatedEvent,
  type VariantState,
} from "../../../../../src/api/domain/variant/events";
import {
  ProductCreatedEvent,
  ProductDetailsUpdatedEvent,
  ProductDefaultVariantSetEvent,
  type ProductState,
} from "../../../../../src/api/domain/product/events";
import {
  VariantPositionsWithinProductCreatedEvent,
  VariantPositionsWithinProductReorderedEvent,
  type VariantPositionsWithinProductState,
} from "../../../../../src/api/domain/variantPositionsWithinProduct/events";
import { ImageCollection } from "../../../../../src/api/domain/_base/imageCollection";
import type { UnitOfWorkRepositories } from "../../../../../src/api/infrastructure/unitOfWork";
import type {
  ProductVariantEntry,
  ProductFieldsForVariant,
} from "../../../../../src/api/infrastructure/repositories/readModels/productVariantsReadModelRepository";

function createMockVariantState(
  overrides: Partial<VariantState> = {}
): VariantState {
  return {
    productId: "product-123",
    sku: "SKU-001",
    price: 29.99,
    inventory: 100,
    options: { size: "M", color: "Blue" },
    status: "draft",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    publishedAt: null,
    images: ImageCollection.empty(),
    digitalAsset: null,
    ...overrides,
  };
}

function createMockProductState(
  overrides: Partial<ProductState> = {}
): ProductState {
  return {
    name: "Test Product",
    description: "Test description",
    slug: "test-product",
    collections: ["collection-123"],
    variantPositionsAggregateId: "positions-123",
    defaultVariantId: null,
    richDescriptionUrl: "",
    fulfillmentType: "digital",
    vendor: "Test Vendor",
    variantOptions: [{ name: "Size", values: ["S", "M", "L"] }],
    metaTitle: "Test Meta Title",
    metaDescription: "Test Meta Description",
    tags: ["tag1", "tag2"],
    taxable: true,
    taxId: "tax-123",
    status: "draft",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    publishedAt: null,
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
    fulfillmentType: "digital",
    dropshipSafetyBuffer: undefined,
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
    variantState: VariantState & { correlationId: string; version: number };
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
      variantState: VariantState & { correlationId: string; version: number },
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
  describe("Variant events", () => {
    test("should handle variant.created event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockVariantState({ sku: "NEW-SKU" });
      const event = new VariantCreatedEvent({
        occurredAt: new Date(),
        aggregateId: "variant-123",
        correlationId: "correlation-123",
        version: 0,
        userId: "user-123",
        priorState: createMockVariantState(),
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

    test("should handle variant.archived event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockVariantState({ status: "archived" });
      const event = new VariantArchivedEvent({
        occurredAt: new Date(),
        aggregateId: "variant-123",
        correlationId: "correlation-123",
        version: 1,
        userId: "user-123",
        priorState: createMockVariantState({ status: "draft" }),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.savedVariants).toHaveLength(1);
      expect(mock.savedVariants[0]?.variantState.status).toBe("archived");
    });

    test("should handle variant.price_updated event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockVariantState({ price: 49.99 });
      const event = new VariantPriceUpdatedEvent({
        occurredAt: new Date(),
        aggregateId: "variant-123",
        correlationId: "correlation-123",
        version: 1,
        userId: "user-123",
        priorState: createMockVariantState({ price: 29.99 }),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.savedVariants).toHaveLength(1);
      expect(mock.savedVariants[0]?.variantState.price).toBe(49.99);
    });

    test("should not save variant if product not found", async () => {
      // Arrange
      const mock = createMockRepositories();
      mock.productFieldsLookup.clear(); // Remove product data
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockVariantState();
      const event = new VariantCreatedEvent({
        occurredAt: new Date(),
        aggregateId: "variant-123",
        correlationId: "correlation-123",
        version: 0,
        userId: "user-123",
        priorState: createMockVariantState(),
        newState,
      });

      // Act
      await projector.execute(event);

      // Assert
      expect(mock.savedVariants).toHaveLength(0);
    });
  });

  describe("Product events", () => {
    test("should handle product.created event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockProductState({ name: "New Product Name" });
      const event = new ProductCreatedEvent({
        occurredAt: new Date(),
        aggregateId: "product-123",
        correlationId: "correlation-123",
        version: 0,
        userId: "user-123",
        priorState: {} as ProductState,
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
    });

    test("should handle product.details_updated event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockProductState({
        name: "Updated Name",
        description: "Updated description",
      });
      const event = new ProductDetailsUpdatedEvent({
        occurredAt: new Date(),
        aggregateId: "product-123",
        correlationId: "correlation-123",
        version: 1,
        userId: "user-123",
        priorState: createMockProductState(),
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

    test("should handle product.default_variant_set event", async () => {
      // Arrange
      const mock = createMockRepositories();
      const projector = new ProductVariantsProjector(mock.repositories);
      const newState = createMockProductState({
        defaultVariantId: "variant-456",
      });
      const event = new ProductDefaultVariantSetEvent({
        occurredAt: new Date(),
        aggregateId: "product-123",
        correlationId: "correlation-123",
        version: 1,
        userId: "user-123",
        priorState: createMockProductState({ defaultVariantId: null }),
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
