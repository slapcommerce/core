export type CommandType =
    | "createProduct"
    | "archiveProduct"
    | "publishProduct"
    | "unpublishProduct"
    | "changeSlug"
    | "updateProductDetails"
    | "updateProductMetadata"
    | "updateProductClassification"
    | "updateProductTags"
    | "updateProductCollections"
    | "updateProductFulfillmentType"
    | "updateProductOptions"
    | "updateProductShippingSettings"
    | "updateProductPageLayout"
    | "createCollection"
    | "archiveCollection"
    | "publishCollection"
    | "updateCollectionMetadata"
    | "unpublishCollection"
    | "updateCollectionSeoMetadata"
    | "addCollectionImage"
    | "removeCollectionImage"
    | "reorderCollectionImages"
    | "updateCollectionImageAltText"
    | "updateCollectionImage"
    | "createVariant"
    | "archiveVariant"
    | "publishVariant"
    | "updateVariantDetails"
    | "updateVariantInventory"
    | "updateVariantPrice"
    | "updateVariantSku"
    | "addVariantImage"
    | "removeVariantImage"
    | "reorderVariantImages"
    | "updateVariantImageAltText"
    | "attachVariantDigitalAsset"
    | "detachVariantDigitalAsset"
    | "createSchedule"
    | "updateSchedule"
    | "cancelSchedule";

export abstract class Command {
    abstract id: string;
    abstract userId: string;
    abstract type: CommandType;
    correlationId?: string;
}
