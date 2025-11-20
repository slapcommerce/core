import { describe, it, expect, mock } from "bun:test";
import { UpdateProductOptionsService } from "../../../src/app/product/updateProductOptionsService";
import { UnitOfWork } from "../../../src/infrastructure/unitOfWork";
import { TransactionBatcher } from "../../../src/infrastructure/transactionBatcher";
import { ProductAggregate } from "../../../src/domain/product/aggregate";
import { uuidv7 } from "uuidv7";
import { createTestDatabase, closeTestDatabase } from "../../helpers/database";
import type { ProjectionService } from "../../../src/infrastructure/projectionService";

describe("UpdateProductOptionsService", () => {
    const setup = () => {
        const db = createTestDatabase();
        const batcher = new TransactionBatcher(db, {
            flushIntervalMs: 10,
            batchSizeThreshold: 10,
            maxQueueDepth: 100,
        });
        batcher.start();
        const unitOfWork = new UnitOfWork(db, batcher);

        const projectionService = {
            handleEvent: mock(() => Promise.resolve()),
        } as unknown as ProjectionService;

        const service = new UpdateProductOptionsService(unitOfWork, projectionService);

        return { db, batcher, unitOfWork, service };
    };

    const cleanup = (db: any, batcher: any) => {
        batcher.stop();
        closeTestDatabase(db);
    };

    it("should successfully update product options", async () => {
        const { db, batcher, unitOfWork, service } = setup();
        try {
            const productId = uuidv7();
            const userId = uuidv7();

            // Create initial product
            const product = ProductAggregate.create({
                id: productId,
                userId,
                correlationId: uuidv7(),
                title: "Test Product",
                slug: "test-product",
                vendor: "Test Vendor",
                productType: "Test Type",
                shortDescription: "Test Description",
                fulfillmentType: "digital",
                collectionIds: ["collection-1"],
                variantIds: [],
                richDescriptionUrl: "",
                variantOptions: [],
                metaTitle: "",
                metaDescription: "",
                tags: [],
                requiresShipping: false,
                taxable: true,
                pageLayoutId: null,

                dropshipSafetyBuffer: 5,
            });

            // Save initial state
            await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
                await snapshotRepository.saveSnapshot({
                    aggregate_id: product.id,
                    correlation_id: uuidv7(),
                    version: product.version,
                    payload: product.toSnapshot(),
                });
            });

            // Verify initial snapshot
            let initialSnapshot;
            await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
                initialSnapshot = await snapshotRepository.getSnapshot(productId);
            });
            expect(initialSnapshot).not.toBeNull();

            const variantOptions = [
                { name: "Size", values: ["S", "M", "L"] },
                { name: "Color", values: ["Red", "Blue"] },
            ];

            await service.execute({
                id: productId,
                userId,
                variantOptions,
                expectedVersion: product.version,
            });

            // Verify update
            let updatedSnapshot;
            await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
                updatedSnapshot = await snapshotRepository.getSnapshot(productId);
            });

            expect(updatedSnapshot).toBeDefined();
            expect(updatedSnapshot).not.toBeNull();
            const updatedProduct = ProductAggregate.loadFromSnapshot(updatedSnapshot!);
            expect(updatedProduct.toSnapshot().variantOptions).toEqual(variantOptions);
            expect(updatedProduct.version).toBe(product.version + 1);
        } finally {
            cleanup(db, batcher);
        }
    });

    it("should throw error when product does not exist", async () => {
        const { db, batcher, service } = setup();
        try {
            const productId = uuidv7();
            const userId = uuidv7();

            const variantOptions = [{ name: "Size", values: ["S"] }];

            await expect(
                service.execute({
                    id: productId,
                    userId,
                    variantOptions,
                    expectedVersion: 1,
                })
            ).rejects.toThrow(/Product with id .* not found/);
        } finally {
            cleanup(db, batcher);
        }
    });

    it("should throw error when expected version does not match", async () => {
        const { db, batcher, unitOfWork, service } = setup();
        try {
            const productId = uuidv7();
            const userId = uuidv7();

            const product = ProductAggregate.create({
                id: productId,
                userId,
                correlationId: uuidv7(),
                title: "Test Product",
                slug: "test-product",
                vendor: "Test Vendor",
                productType: "Test Type",
                shortDescription: "Test Description",
                fulfillmentType: "digital",
                collectionIds: ["collection-1"],
                variantIds: [],
                richDescriptionUrl: "",
                variantOptions: [],
                metaTitle: "",
                metaDescription: "",
                tags: [],
                requiresShipping: false,
                taxable: true,
                pageLayoutId: null,

                dropshipSafetyBuffer: 5,
            });

            await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
                await snapshotRepository.saveSnapshot({
                    aggregate_id: product.id,
                    correlation_id: uuidv7(),
                    version: product.version,
                    payload: product.toSnapshot(),
                });
            });

            const variantOptions = [{ name: "Size", values: ["S"] }];

            await expect(
                service.execute({
                    id: productId,
                    userId,
                    variantOptions,
                    expectedVersion: product.version + 1, // Mismatch
                })
            ).rejects.toThrow("Optimistic concurrency error");
        } finally {
            cleanup(db, batcher);
        }
    });
});