import { describe, test, expect } from "bun:test";
import { randomUUIDv7 } from "bun";
import { ProductAggregate } from "../../../src/domain/product/aggregate";

describe("ProductAggregate - Fulfillment Type", () => {
    test("should create product with default fulfillment type as digital", () => {
        const id = randomUUIDv7();
        const correlationId = randomUUIDv7();
        const userId = randomUUIDv7();

        const product = ProductAggregate.create({
            id,
            correlationId,
            userId,
            title: "Test Product",
            shortDescription: "A test product",
            slug: "test-product",
            collectionIds: [],
            variantIds: [],
            richDescriptionUrl: "",
            productType: "Apparel",
            vendor: "TestVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            requiresShipping: true,
            taxable: true,
            pageLayoutId: null,
        });

        const state = product.toSnapshot();
        expect(state.fulfillmentType).toBe("digital");
    });

    test("should create product with digital fulfillment type", () => {
        const id = randomUUIDv7();
        const correlationId = randomUUIDv7();
        const userId = randomUUIDv7();

        const product = ProductAggregate.create({
            id,
            correlationId,
            userId,
            title: "Digital Product",
            shortDescription: "A digital product",
            slug: "digital-product",
            collectionIds: [],
            variantIds: [],
            richDescriptionUrl: "",
            productType: "Software",
            fulfillmentType: "digital",
            vendor: "DigitalVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            requiresShipping: false,
            taxable: true,
            pageLayoutId: null,
        });

        const state = product.toSnapshot();
        expect(state.fulfillmentType).toBe("digital");
    });

    test("should update fulfillment type to digital with asset URL", () => {
        const id = randomUUIDv7();
        const correlationId = randomUUIDv7();
        const userId = randomUUIDv7();

        const product = ProductAggregate.create({
            id,
            correlationId,
            userId,
            title: "Test Product",
            shortDescription: "A test product",
            slug: "test-product",
            collectionIds: [],
            variantIds: [],
            richDescriptionUrl: "",
            productType: "Software",
            vendor: "TestVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            requiresShipping: false,
            taxable: true,
            pageLayoutId: null,
        });

        product.updateFulfillmentType(
            "digital",
            {
                digitalAssetUrl: "https://example.com/download/product.zip",
                maxLicenses: 100,
            },
            userId,
        );

        const state = product.toSnapshot();
        expect(state.fulfillmentType).toBe("digital");
        expect(state.digitalAssetUrl).toBe("https://example.com/download/product.zip");
        expect(state.maxLicenses).toBe(100);
        expect(state.dropshipSafetyBuffer).toBeUndefined();
    });

    test("should update fulfillment type to dropship with safety buffer", () => {
        const id = randomUUIDv7();
        const correlationId = randomUUIDv7();
        const userId = randomUUIDv7();

        const product = ProductAggregate.create({
            id,
            correlationId,
            userId,
            title: "Test Product",
            shortDescription: "A test product",
            slug: "test-product",
            collectionIds: [],
            variantIds: [],
            richDescriptionUrl: "",
            productType: "Electronics",
            vendor: "TestVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            requiresShipping: true,
            taxable: true,
            pageLayoutId: null,
        });

        product.updateFulfillmentType(
            "dropship",
            {
                dropshipSafetyBuffer: 5,
            },
            userId,
        );

        const state = product.toSnapshot();
        expect(state.fulfillmentType).toBe("dropship");
        expect(state.dropshipSafetyBuffer).toBe(5);
        expect(state.digitalAssetUrl).toBeUndefined();
        expect(state.maxLicenses).toBeUndefined();
    });

    test("should clear digital fields when switching to dropship", () => {
        const id = randomUUIDv7();
        const correlationId = randomUUIDv7();
        const userId = randomUUIDv7();

        const product = ProductAggregate.create({
            id,
            correlationId,
            userId,
            title: "Test Product",
            shortDescription: "A test product",
            slug: "test-product",
            collectionIds: [],
            variantIds: [],
            richDescriptionUrl: "",
            productType: "Software",
            fulfillmentType: "digital",
            vendor: "TestVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            requiresShipping: false,
            taxable: true,
            pageLayoutId: null,
        });

        product.updateFulfillmentType(
            "digital",
            {
                digitalAssetUrl: "https://example.com/download.zip",
                maxLicenses: 50,
            },
            userId,
        );

        // Switch to dropship
        product.updateFulfillmentType("dropship", { dropshipSafetyBuffer: 5 }, userId);

        const state = product.toSnapshot();
        expect(state.fulfillmentType).toBe("dropship");
        expect(state.digitalAssetUrl).toBeUndefined();
        expect(state.maxLicenses).toBeUndefined();
        expect(state.dropshipSafetyBuffer).toBe(5);
    });

    test("should throw error when publishing digital product without asset URL", () => {
        const id = randomUUIDv7();
        const correlationId = randomUUIDv7();
        const userId = randomUUIDv7();
        const variantId = randomUUIDv7();

        const product = ProductAggregate.create({
            id,
            correlationId,
            userId,
            title: "Digital Product",
            shortDescription: "A digital product",
            slug: "digital-product",
            collectionIds: [],
            variantIds: [variantId],
            richDescriptionUrl: "",
            productType: "Software",
            fulfillmentType: "digital",
            vendor: "DigitalVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            requiresShipping: false,
            taxable: true,
            pageLayoutId: null,
        });

        expect(() => product.publish(userId)).toThrow(
            "Digital products must have a digital asset URL",
        );
    });

    test("should publish digital product with asset URL", () => {
        const id = randomUUIDv7();
        const correlationId = randomUUIDv7();
        const userId = randomUUIDv7();
        const variantId = randomUUIDv7();

        const product = ProductAggregate.create({
            id,
            correlationId,
            userId,
            title: "Digital Product",
            shortDescription: "A digital product",
            slug: "digital-product",
            collectionIds: [],
            variantIds: [variantId],
            richDescriptionUrl: "",
            productType: "Software",
            fulfillmentType: "digital",
            vendor: "DigitalVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            requiresShipping: false,
            taxable: true,
            pageLayoutId: null,
        });

        product.updateFulfillmentType(
            "digital",
            {
                digitalAssetUrl: "https://example.com/download.zip",
            },
            userId,
        );

        product.publish(userId);

        const state = product.toSnapshot();
        expect(state.status).toBe("active");
    });

    test("should throw error when publishing dropship product without safety buffer", () => {
        const id = randomUUIDv7();
        const correlationId = randomUUIDv7();
        const userId = randomUUIDv7();
        const variantId = randomUUIDv7();

        const product = ProductAggregate.create({
            id,
            correlationId,
            userId,
            title: "Dropship Product",
            shortDescription: "A dropship product",
            slug: "dropship-product",
            collectionIds: [],
            variantIds: [variantId],
            richDescriptionUrl: "",
            productType: "Electronics",
            fulfillmentType: "dropship",
            vendor: "DropshipVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            requiresShipping: true,
            taxable: true,
            pageLayoutId: null,
        });

        expect(() => product.publish(userId)).toThrow(
            "Dropship products must have a non-negative safety buffer",
        );
    });

    test("should publish dropship product with safety buffer", () => {
        const id = randomUUIDv7();
        const correlationId = randomUUIDv7();
        const userId = randomUUIDv7();
        const variantId = randomUUIDv7();

        const product = ProductAggregate.create({
            id,
            correlationId,
            userId,
            title: "Dropship Product",
            shortDescription: "A dropship product",
            slug: "dropship-product",
            collectionIds: [],
            variantIds: [variantId],
            richDescriptionUrl: "",
            productType: "Electronics",
            fulfillmentType: "dropship",
            vendor: "DropshipVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            requiresShipping: true,
            taxable: true,
            pageLayoutId: null,
        });

        product.updateFulfillmentType(
            "dropship",
            {
                dropshipSafetyBuffer: 10,
            },
            userId,
        );

        product.publish(userId);

        const state = product.toSnapshot();
        expect(state.status).toBe("active");
        expect(state.dropshipSafetyBuffer).toBe(10);
    });

    test("should emit ProductFulfillmentTypeUpdatedEvent when updating fulfillment type", () => {
        const id = randomUUIDv7();
        const correlationId = randomUUIDv7();
        const userId = randomUUIDv7();

        const product = ProductAggregate.create({
            id,
            correlationId,
            userId,
            title: "Test Product",
            shortDescription: "A test product",
            slug: "test-product",
            collectionIds: [],
            variantIds: [],
            richDescriptionUrl: "",
            productType: "Software",
            vendor: "TestVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            requiresShipping: false,
            taxable: true,
            pageLayoutId: null,
        });

        // Clear uncommitted events from creation
        product.uncommittedEvents.length = 0;

        product.updateFulfillmentType(
            "digital",
            {
                digitalAssetUrl: "https://example.com/download.zip",
                maxLicenses: null, // unlimited
            },
            userId,
        );

        expect(product.uncommittedEvents.length).toBe(1);
        expect(product.uncommittedEvents[0].eventName).toBe(
            "product.fulfillment_type_updated",
        );
        expect(product.uncommittedEvents[0].payload.newState.fulfillmentType).toBe(
            "digital",
        );
    });
});
