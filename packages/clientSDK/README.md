# Ecommerce API SDK

TypeScript SDK for the Ecommerce API with full type safety.

## Installation

```bash
npm install @yourorg/ecommerce-sdk
```

## Usage

```typescript
import { EcommerceSDK } from '@yourorg/ecommerce-sdk';

const sdk = new EcommerceSDK({
  baseUrl: 'https://api.example.com',
  authToken: 'your-admin-token'  // Required for admin operations
});

// Execute a command
const result = await sdk.admin.commands.createProduct({
  id: 'product-id',
  correlationId: 'correlation-id',
  userId: 'user-id',
  title: 'My Product',
  slug: 'my-product',
  collectionIds: ['collection-1'],
  taxable: true
});

if (result.success) {
  console.log('Product created successfully');
} else {
  console.error('Error:', result.error.message);
}

// Execute a query
const products = await sdk.admin.queries.productListView({
  status: 'active',
  limit: 10
});

if (products.success) {
  console.log('Found products:', products.data);
}
```

## Public API

For public queries (no authentication required):

```typescript
const sdk = new EcommerceSDK({
  baseUrl: 'https://api.example.com'
  // No authToken needed
});

const products = await sdk.public.queries.productListView({
  status: 'active'
});
```

## API Reference

### Admin Commands (41 total)

- `sdk.admin.commands.addCollectionImage()`
- `sdk.admin.commands.addVariantImage()`
- `sdk.admin.commands.archiveCollection()`
- `sdk.admin.commands.archiveProduct()`
- `sdk.admin.commands.archiveVariant()`
- `sdk.admin.commands.attachVariantDigitalAsset()`
- `sdk.admin.commands.cancelSchedule()`
- `sdk.admin.commands.changeSlug()`
- `sdk.admin.commands.createCollection()`
- `sdk.admin.commands.createProduct()`
- `sdk.admin.commands.createSchedule()`
- `sdk.admin.commands.createVariant()`
- `sdk.admin.commands.detachVariantDigitalAsset()`
- `sdk.admin.commands.publishCollection()`
- `sdk.admin.commands.publishProduct()`
- `sdk.admin.commands.publishVariant()`
- `sdk.admin.commands.removeCollectionImage()`
- `sdk.admin.commands.removeVariantImage()`
- `sdk.admin.commands.reorderCollectionImages()`
- `sdk.admin.commands.reorderVariantImages()`
- `sdk.admin.commands.unpublishCollection()`
- `sdk.admin.commands.unpublishProduct()`
- `sdk.admin.commands.updateCollectionImage()`
- `sdk.admin.commands.updateCollectionImageAltText()`
- `sdk.admin.commands.updateCollectionMetadata()`
- `sdk.admin.commands.updateCollectionSeoMetadata()`
- `sdk.admin.commands.updateProductClassification()`
- `sdk.admin.commands.updateProductCollections()`
- `sdk.admin.commands.updateProductDetails()`
- `sdk.admin.commands.updateProductFulfillmentType()`
- `sdk.admin.commands.updateProductMetadata()`
- `sdk.admin.commands.updateProductOptions()`
- `sdk.admin.commands.updateProductPageLayout()`
- `sdk.admin.commands.updateProductShippingSettings()`
- `sdk.admin.commands.updateProductTags()`
- `sdk.admin.commands.updateSchedule()`
- `sdk.admin.commands.updateVariantDetails()`
- `sdk.admin.commands.updateVariantImageAltText()`
- `sdk.admin.commands.updateVariantInventory()`
- `sdk.admin.commands.updateVariantPrice()`
- `sdk.admin.commands.updateVariantSku()`

### Admin Queries (7 total)

- `sdk.admin.queries.collectionsView()`
- `sdk.admin.queries.productCollectionsView()`
- `sdk.admin.queries.productListView()`
- `sdk.admin.queries.productVariantsView()`
- `sdk.admin.queries.schedulesView()`
- `sdk.admin.queries.slugRedirectsView()`
- `sdk.admin.queries.variantsView()`

### Public Queries (4 total)

- `sdk.public.queries.productCollectionsView()`
- `sdk.public.queries.productListView()`
- `sdk.public.queries.productVariantsView()`
- `sdk.public.queries.slugRedirectsView()`

## Type Safety

All commands and queries are fully typed. Import types as needed:

```typescript
import type { CreateProductCommand, GetProductListQuery } from '@yourorg/ecommerce-sdk';
```

## Development

This SDK is auto-generated. Do not edit the files in `clientSDK/src` manually.

To regenerate:
```bash
bun run sdk:generate
```

## License

MIT
