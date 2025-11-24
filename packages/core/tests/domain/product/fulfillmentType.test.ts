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
            collectionIds: [randomUUIDv7()],
            variantIds: [],
            richDescriptionUrl: "",
            productType: "Apparel",
            vendor: "TestVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            taxable: true,
            taxId: "TAX001",
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
            collectionIds: [randomUUIDv7()],
            variantIds: [],
            richDescriptionUrl: "",
            productType: "Software",
            fulfillmentType: "digital",
            vendor: "DigitalVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            taxable: true,
            taxId: "TAX001",
        });

        const state = product.toSnapshot();
        expect(state.fulfillmentType).toBe("digital");
    });

    test("should update fulfillment type to digital", () => {
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
            collectionIds: [randomUUIDv7()],
            variantIds: [],
            richDescriptionUrl: "",
            productType: "Software",
            vendor: "TestVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            taxable: true,
            taxId: "TAX001",
        });

        product.updateFulfillmentType(
            "digital",
            {},
            userId,
        );

        const state = product.toSnapshot();
        expect(state.fulfillmentType).toBe("digital");
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
            collectionIds: [randomUUIDv7()],
            variantIds: [],
            richDescriptionUrl: "",
            productType: "Electronics",
            vendor: "TestVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            taxId: "TAX001",
            taxable: true,
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
    });

    test("should clear dropship fields when switching to digital", () => {
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
            collectionIds: [randomUUIDv7()],
            variantIds: [],
            richDescriptionUrl: "",
            productType: "Electronics",
            fulfillmentType: "dropship",
            dropshipSafetyBuffer: 5,
            vendor: "TestVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            taxable: true,
            taxId: "TAX001",
        });

        product.updateFulfillmentType(
            "digital",
            {},
            userId,
        );

        const state = product.toSnapshot();
        expect(state.fulfillmentType).toBe("digital");
        expect(state.dropshipSafetyBuffer).toBeUndefined();
    });

    test("should publish digital product (digital asset requirement removed from product)", () => {
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
            collectionIds: [randomUUIDv7()],
            variantIds: [variantId],
            richDescriptionUrl: "",
            productType: "Software",
            fulfillmentType: "digital",
            vendor: "DigitalVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            taxable: true,
            taxId: "TAX001",
        });

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
            collectionIds: [randomUUIDv7()],
            variantIds: [variantId],
            richDescriptionUrl: "",
            productType: "Electronics",
            fulfillmentType: "dropship",
            vendor: "DropshipVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            taxable: true,
            taxId: "TAX001",
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
            collectionIds: [randomUUIDv7()],
            variantIds: [variantId],
            richDescriptionUrl: "",
            productType: "Electronics",
            fulfillmentType: "dropship",
            vendor: "DropshipVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            taxable: true,
            taxId: "TAX001",
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
            collectionIds: [randomUUIDv7()],
            variantIds: [],
            richDescriptionUrl: "",
            productType: "Software",
            vendor: "TestVendor",
            variantOptions: [],
            metaTitle: "",
            metaDescription: "",
            tags: [],
            taxable: true,
            taxId: "TAX001",
        });

        // Clear uncommitted events from creation
        product.uncommittedEvents.length = 0;

        product.updateFulfillmentType(
            "digital",
            {},
            userId,
        );

        expect(product.uncommittedEvents.length).toBe(1);
        expect(product.uncommittedEvents[0]!.eventName).toBe(
            "product.fulfillment_type_updated",
        );
        expect(product.uncommittedEvents[0]!.payload.newState.fulfillmentType).toBe(
            "digital",
        );
    });
});