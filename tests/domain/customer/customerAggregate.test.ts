import { describe, expect, test } from "bun:test";
import { CustomerAggregate } from "../../../src/domain/customer/aggregate";
import { uuidv7 } from "uuidv7";

describe("CustomerAggregate", () => {
    const userId = uuidv7();
    const customerId = uuidv7();
    const correlationId = uuidv7();

    test("should create a new customer", () => {
        const customer = CustomerAggregate.create({
            id: customerId,
            correlationId,
            userId,
            email: "test@example.com",
            firstName: "John",
            lastName: "Doe",
            phone: "1234567890",
        });

        expect(customer.id).toBe(customerId);
        expect(customer.version).toBe(0);
        expect(customer.uncommittedEvents).toHaveLength(1);
        expect(customer.uncommittedEvents[0].eventName).toBe("customer.created");

        const state = customer.toSnapshot();
        expect(state.email).toBe("test@example.com");
        expect(state.firstName).toBe("John");
        expect(state.lastName).toBe("Doe");
        expect(state.phone).toBe("1234567890");
        expect(state.addresses).toHaveLength(0);
        expect(state.paymentProviderCustomerId).toBeNull();
        expect(state.authUserId).toBeNull();
    });

    test("should update profile", () => {
        const customer = CustomerAggregate.create({
            id: customerId,
            correlationId,
            userId,
            email: "test@example.com",
            firstName: "John",
            lastName: "Doe",
        });

        customer.uncommittedEvents = [];

        customer.updateProfile(
            "new@example.com",
            "Jane",
            "Doe",
            "0987654321",
            userId
        );

        expect(customer.version).toBe(1);
        expect(customer.uncommittedEvents).toHaveLength(1);
        expect(customer.uncommittedEvents[0].eventName).toBe(
            "customer.profile_updated"
        );

        const state = customer.toSnapshot();
        expect(state.email).toBe("new@example.com");
        expect(state.firstName).toBe("Jane");
        expect(state.phone).toBe("0987654321");
    });

    test("should add address", () => {
        const customer = CustomerAggregate.create({
            id: customerId,
            correlationId,
            userId,
            email: "test@example.com",
            firstName: "John",
            lastName: "Doe",
        });

        customer.uncommittedEvents = [];

        const address = {
            id: uuidv7(),
            firstName: "John",
            lastName: "Doe",
            address1: "123 Main St",
            city: "New York",
            province: "NY",
            postalCode: "10001",
            countryCode: "US",
            phone: "1234567890",
        };

        customer.addAddress(address, userId);

        expect(customer.version).toBe(1);
        expect(customer.uncommittedEvents).toHaveLength(1);
        expect(customer.uncommittedEvents[0].eventName).toBe(
            "customer.address_added"
        );

        const state = customer.toSnapshot();
        expect(state.addresses).toHaveLength(1);
        expect(state.addresses[0]).toEqual(address);
    });

    test("should update payment provider id", () => {
        const customer = CustomerAggregate.create({
            id: customerId,
            correlationId,
            userId,
            email: "test@example.com",
            firstName: "John",
            lastName: "Doe",
        });

        customer.uncommittedEvents = [];

        customer.updatePaymentProviderId("cus_123", userId);

        expect(customer.version).toBe(1);
        expect(customer.uncommittedEvents).toHaveLength(1);
        expect(customer.uncommittedEvents[0].eventName).toBe(
            "customer.payment_provider_id_updated"
        );

        const state = customer.toSnapshot();
        expect(state.paymentProviderCustomerId).toBe("cus_123");
    });

    test("should update auth user id", () => {
        const customer = CustomerAggregate.create({
            id: customerId,
            correlationId,
            userId,
            email: "test@example.com",
            firstName: "John",
            lastName: "Doe",
        });

        customer.uncommittedEvents = [];

        const authUserId = "user_123";
        customer.updateAuthUserId(authUserId, userId);

        expect(customer.version).toBe(1);
        expect(customer.uncommittedEvents).toHaveLength(1);
        expect(customer.uncommittedEvents[0].eventName).toBe(
            "customer.auth_user_id_updated"
        );

        const state = customer.toSnapshot();
        expect(state.authUserId).toBe(authUserId);
    });

    test("should load from snapshot", () => {
        const customer = CustomerAggregate.create({
            id: customerId,
            correlationId,
            userId,
            email: "test@example.com",
            firstName: "John",
            lastName: "Doe",
        });

        const snapshot = {
            aggregate_id: customer.id,
            correlation_id: correlationId,
            version: customer.version,
            payload: JSON.stringify(customer.toSnapshot()),
        };

        const loadedCustomer = CustomerAggregate.loadFromSnapshot(snapshot);

        expect(loadedCustomer.id).toBe(customer.id);
        expect(loadedCustomer.version).toBe(customer.version);
        expect(loadedCustomer.toSnapshot()).toEqual(customer.toSnapshot());
    });
});
