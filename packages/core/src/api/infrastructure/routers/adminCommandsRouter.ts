import type { UnitOfWork } from "../unitOfWork";
import { CreateProductService } from "../../app/product/createProductService";
import { ArchiveProductService } from "../../app/product/archiveProductService";
import { PublishProductService } from "../../app/product/publishProductService";
import { UnpublishProductService } from "../../app/product/unpublishProductService";
import { ChangeSlugService } from "../../app/product/changeSlugService";
import { UpdateProductDetailsService } from "../../app/product/updateProductDetailsService";
import { UpdateProductMetadataService } from "../../app/product/updateProductMetadataService";
import { UpdateProductClassificationService } from "../../app/product/updateProductClassificationService";
import { UpdateProductTagsService } from "../../app/product/updateProductTagsService";
import { UpdateProductCollectionsService } from "../../app/product/updateProductCollectionsService";
import { UpdateProductFulfillmentTypeService } from "../../app/product/updateProductFulfillmentTypeService";
import { CreateCollectionService } from "../../app/collection/commands/createCollectionService";
import { ArchiveCollectionService } from "../../app/collection/commands/archiveCollectionService";
import { PublishCollectionService } from "../../app/collection/commands/publishCollectionService";
import { UpdateCollectionMetadataService } from "../../app/collection/commands/updateCollectionMetadataService";
import { UnpublishCollectionService } from "../../app/collection/commands/unpublishCollectionService";
import { UpdateCollectionSeoMetadataService } from "../../app/collection/commands/updateCollectionSeoMetadataService";
import { AddCollectionImageService } from "../../app/collection/commands/addCollectionImageService";
import { RemoveCollectionImageService } from "../../app/collection/commands/removeCollectionImageService";
import { ReorderCollectionImagesService } from "../../app/collection/commands/reorderCollectionImagesService";
import { UpdateCollectionImageAltTextService } from "../../app/collection/commands/updateCollectionImageAltTextService";
import { UpdateCollectionImageService } from "../../app/collection/commands/updateCollectionImageService";
import type { ImageUploadHelper } from "../imageUploadHelper";
import type { DigitalAssetUploadHelper } from "../digitalAssetUploadHelper";
import { CreateScheduleService } from "../../app/schedule/createScheduleService";
import { UpdateScheduleService } from "../../app/schedule/updateScheduleService";
import { CancelScheduleService } from "../../app/schedule/commands/cancelScheduleService";
import { CreateVariantService } from "../../app/variant/createVariantService";
import { ArchiveVariantService } from "../../app/variant/archiveVariantService";
import { PublishVariantService } from "../../app/variant/publishVariantService";
import { UpdateVariantDetailsService } from "../../app/variant/updateVariantDetailsService";
import { UpdateVariantInventoryService } from "../../app/variant/updateVariantInventoryService";
import { UpdateVariantPriceService } from "../../app/variant/updateVariantPriceService";
import { UpdateVariantSkuService } from "../../app/variant/updateVariantSkuService";
import { AddVariantImageService } from "../../app/variant/addVariantImageService";
import { RemoveVariantImageService } from "../../app/variant/removeVariantImageService";
import { ReorderVariantImagesService } from "../../app/variant/reorderVariantImagesService";
import { UpdateVariantImageAltTextService } from "../../app/variant/updateVariantImageAltTextService";
import { AttachVariantDigitalAssetService } from "../../app/variant/attachVariantDigitalAssetService";
import { DetachVariantDigitalAssetService } from "../../app/variant/detachVariantDigitalAssetService";
import { UpdateProductOptionsService } from "../../app/product/updateProductOptionsService";
import { UpdateProductTaxDetailsService } from "../../app/product/updateProductTaxDetailsService";
import {
  CreateProductCommand,
  ArchiveProductCommand,
  PublishProductCommand,
  UnpublishProductCommand,
  ChangeSlugCommand,
  UpdateProductDetailsCommand,
  UpdateProductMetadataCommand,
  UpdateProductClassificationCommand,
  UpdateProductTagsCommand,
  UpdateProductCollectionsCommand,
  UpdateProductFulfillmentTypeCommand,
  UpdateProductOptionsCommand,
  UpdateProductTaxDetailsCommand,
} from "../../app/product/commands/commands";
import {
  CreateCollectionCommand,
  ArchiveCollectionCommand,
  PublishCollectionCommand,
  UpdateCollectionMetadataCommand,
  UnpublishCollectionCommand,
  UpdateCollectionSeoMetadataCommand,
  AddCollectionImageCommand,
  RemoveCollectionImageCommand,
  ReorderCollectionImagesCommand,
  UpdateCollectionImageAltTextCommand,
  UpdateCollectionImageCommand,
} from "../../app/collection/commands/commands";
import {
  CreateVariantCommand,
  ArchiveVariantCommand,
  PublishVariantCommand,
  UpdateVariantDetailsCommand,
  UpdateVariantInventoryCommand,
  UpdateVariantPriceCommand,
  UpdateVariantSkuCommand,
  AddVariantImageCommand,
  RemoveVariantImageCommand,
  ReorderVariantImagesCommand,
  UpdateVariantImageAltTextCommand,
  AttachVariantDigitalAssetCommand,
  DetachVariantDigitalAssetCommand,
} from "../../app/variant/commands";
import {
  CreateScheduleCommand,
  UpdateScheduleCommand,
  CancelScheduleCommand,
} from "../../app/schedule/commands/commands";
import { type CommandType } from "../../app/command";

type Result<T> =
  | { readonly success: true; readonly data?: T }
  | { readonly success: false; readonly error: Error };

export function createAdminCommandsRouter(
  unitOfWork: UnitOfWork,
  imageUploadHelper?: ImageUploadHelper,
  digitalAssetUploadHelper?: DigitalAssetUploadHelper,
) {
  // Initialize all services
  const createProductService = new CreateProductService(
    unitOfWork,

  );
  const archiveProductService = new ArchiveProductService(
    unitOfWork,

  );
  const publishProductService = new PublishProductService(
    unitOfWork,

  );
  const unpublishProductService = new UnpublishProductService(
    unitOfWork,

  );
  const changeSlugService = new ChangeSlugService(
    unitOfWork,

  );
  const updateProductDetailsService = new UpdateProductDetailsService(
    unitOfWork,

  );
  const updateProductMetadataService = new UpdateProductMetadataService(
    unitOfWork,

  );
  const updateProductClassificationService =
    new UpdateProductClassificationService(unitOfWork);
  const updateProductTagsService = new UpdateProductTagsService(
    unitOfWork,

  );
  const updateProductCollectionsService = new UpdateProductCollectionsService(
    unitOfWork,

  );
  const updateProductFulfillmentTypeService =
    new UpdateProductFulfillmentTypeService(unitOfWork);
  const updateProductOptionsService = new UpdateProductOptionsService(
    unitOfWork,

  );
  const createCollectionService = new CreateCollectionService(
    unitOfWork,

  );
  const archiveCollectionService = new ArchiveCollectionService(
    unitOfWork,

  );
  const publishCollectionService = new PublishCollectionService(
    unitOfWork,

  );
  const updateCollectionMetadataService = new UpdateCollectionMetadataService(
    unitOfWork,

  );
  const unpublishCollectionService = new UnpublishCollectionService(
    unitOfWork,

  );
  const updateCollectionSeoMetadataService =
    new UpdateCollectionSeoMetadataService(unitOfWork);
  const addCollectionImageService = new AddCollectionImageService(
    unitOfWork,

    imageUploadHelper!,
  );
  const removeCollectionImageService = new RemoveCollectionImageService(
    unitOfWork,

  );
  const reorderCollectionImagesService = new ReorderCollectionImagesService(
    unitOfWork,

  );
  const updateCollectionImageAltTextService = new UpdateCollectionImageAltTextService(
    unitOfWork,

  );
  const updateCollectionImageService = new UpdateCollectionImageService(
    unitOfWork,

    imageUploadHelper!,
  );
  const createScheduleService = new CreateScheduleService(
    unitOfWork,

  );
  const updateScheduleService = new UpdateScheduleService(
    unitOfWork,

  );
  const cancelScheduleService = new CancelScheduleService(
    unitOfWork,

  );
  const createVariantService = new CreateVariantService(
    unitOfWork,

  );
  const archiveVariantService = new ArchiveVariantService(
    unitOfWork,

  );
  const publishVariantService = new PublishVariantService(
    unitOfWork,

  );
  const updateVariantDetailsService = new UpdateVariantDetailsService(
    unitOfWork,

  );
  const updateVariantInventoryService = new UpdateVariantInventoryService(
    unitOfWork,

  );
  const updateVariantPriceService = new UpdateVariantPriceService(
    unitOfWork,

  );
  const updateVariantSkuService = new UpdateVariantSkuService(
    unitOfWork,

  );
  const addVariantImageService = new AddVariantImageService(
    unitOfWork,

    imageUploadHelper!,
  );
  const removeVariantImageService = new RemoveVariantImageService(
    unitOfWork,

  );
  const reorderVariantImagesService = new ReorderVariantImagesService(
    unitOfWork,

  );
  const updateVariantImageAltTextService = new UpdateVariantImageAltTextService(
    unitOfWork,

  );
  const attachVariantDigitalAssetService = new AttachVariantDigitalAssetService(
    unitOfWork,

    digitalAssetUploadHelper!,
  );
  const detachVariantDigitalAssetService = new DetachVariantDigitalAssetService(
    unitOfWork,

  );
  const updateProductTaxDetailsService = new UpdateProductTaxDetailsService(
    unitOfWork,
  );

  return async (type: CommandType, payload: unknown): Promise<Result<unknown>> => {
    if (!type) {
      return { success: false, error: new Error("Request must include type") };
    }

    try {
      switch (type) {
        case "createProduct": {
          const command = CreateProductCommand.parse({ ...(payload as any)});
          await createProductService.execute(command);
          break;
        }
        case "archiveProduct": {
          const command = ArchiveProductCommand.parse({ ...(payload as any)});
          await archiveProductService.execute(command);
          break;
        }
        case "publishProduct": {
          const command = PublishProductCommand.parse({ ...(payload as any) });
          await publishProductService.execute(command);
          break;
        }
        case "unpublishProduct": {
          const command = UnpublishProductCommand.parse({ ...(payload as any) });
          await unpublishProductService.execute(command);
          break;
        }
        case "changeSlug": {
          const command = ChangeSlugCommand.parse({ ...(payload as any) });
          await changeSlugService.execute(command);
          break;
        }
        case "updateProductDetails": {
          const command = UpdateProductDetailsCommand.parse({ ...(payload as any) });
          await updateProductDetailsService.execute(command);
          break;
        }
        case "updateProductMetadata": {
          const command = UpdateProductMetadataCommand.parse({ ...(payload as any) });
          await updateProductMetadataService.execute(command);
          break;
        }
        case "updateProductClassification": {
          const command = UpdateProductClassificationCommand.parse({ ...(payload as any) });
          await updateProductClassificationService.execute(command);
          break;
        }
        case "updateProductTags": {
          const command = UpdateProductTagsCommand.parse({ ...(payload as any) });
          await updateProductTagsService.execute(command);
          break;
        }
        case "updateProductCollections": {
          const command = UpdateProductCollectionsCommand.parse({ ...(payload as any) });
          await updateProductCollectionsService.execute(command);
          break;
        }
        case "updateProductFulfillmentType": {
          const command = UpdateProductFulfillmentTypeCommand.parse({ ...(payload as any) });
          await updateProductFulfillmentTypeService.execute(command);
          break;
        }
        case "updateProductOptions": {
          const command = UpdateProductOptionsCommand.parse({ ...(payload as any) });
          await updateProductOptionsService.execute(command);
          break;
        }
        case "createCollection": {
          const command = CreateCollectionCommand.parse({ ...(payload as any) });
          await createCollectionService.execute(command);
          break;
        }
        case "archiveCollection": {
          const command = ArchiveCollectionCommand.parse({ ...(payload as any) });
          await archiveCollectionService.execute(command);
          break;
        }
        case "publishCollection": {
          const command = PublishCollectionCommand.parse({ ...(payload as any) });
          await publishCollectionService.execute(command);
          break;
        }
        case "updateCollectionMetadata": {
          const command = UpdateCollectionMetadataCommand.parse({ ...(payload as any) });
          await updateCollectionMetadataService.execute(command);
          break;
        }
        case "unpublishCollection": {
          const command = UnpublishCollectionCommand.parse({ ...(payload as any) });
          await unpublishCollectionService.execute(command);
          break;
        }
        case "updateCollectionSeoMetadata": {
          const command = UpdateCollectionSeoMetadataCommand.parse({ ...(payload as any) });
          await updateCollectionSeoMetadataService.execute(command);
          break;
        }
        case "addCollectionImage": {
          const command = AddCollectionImageCommand.parse({ ...(payload as any) });
          const result = await addCollectionImageService.execute(command);
          return { success: true, data: result };
        }
        case "removeCollectionImage": {
          const command = RemoveCollectionImageCommand.parse({ ...(payload as any) });
          await removeCollectionImageService.execute(command);
          break;
        }
        case "reorderCollectionImages": {
          const command = ReorderCollectionImagesCommand.parse({ ...(payload as any) });
          await reorderCollectionImagesService.execute(command);
          break;
        }
        case "updateCollectionImageAltText": {
          const command = UpdateCollectionImageAltTextCommand.parse({ ...(payload as any) });
          await updateCollectionImageAltTextService.execute(command);
          break;
        }
        case "updateCollectionImage": {
          const command = UpdateCollectionImageCommand.parse({ ...(payload as any) });
          await updateCollectionImageService.execute(command);
          break;
        }
        case "createVariant": {
          const command = CreateVariantCommand.parse({ ...(payload as any) });
          await createVariantService.execute(command);
          break;
        }
        case "archiveVariant": {
          const command = ArchiveVariantCommand.parse({ ...(payload as any) });
          await archiveVariantService.execute(command);
          break;
        }
        case "publishVariant": {
          const command = PublishVariantCommand.parse({ ...(payload as any) });
          await publishVariantService.execute(command);
          break;
        }
        case "updateVariantDetails": {
          const command = UpdateVariantDetailsCommand.parse({ ...(payload as any) });
          await updateVariantDetailsService.execute(command);
          break;
        }
        case "updateVariantInventory": {
          const command = UpdateVariantInventoryCommand.parse({ ...(payload as any) });
          await updateVariantInventoryService.execute(command);
          break;
        }
        case "updateVariantPrice": {
          const command = UpdateVariantPriceCommand.parse({ ...(payload as any) });
          await updateVariantPriceService.execute(command);
          break;
        }
        case "updateVariantSku": {
          const command = UpdateVariantSkuCommand.parse({ ...(payload as any) });
          await updateVariantSkuService.execute(command);
          break;
        }
        case "addVariantImage": {
          const command = AddVariantImageCommand.parse({ ...(payload as any) });
          const result = await addVariantImageService.execute(command);
          return { success: true, data: result };
        }
        case "removeVariantImage": {
          const command = RemoveVariantImageCommand.parse({ ...(payload as any) });
          await removeVariantImageService.execute(command);
          break;
        }
        case "reorderVariantImages": {
          const command = ReorderVariantImagesCommand.parse({ ...(payload as any) });
          await reorderVariantImagesService.execute(command);
          break;
        }
        case "updateVariantImageAltText": {
          const command = UpdateVariantImageAltTextCommand.parse({ ...(payload as any) });
          await updateVariantImageAltTextService.execute(command);
          break;
        }
        case "attachVariantDigitalAsset": {
          const command = AttachVariantDigitalAssetCommand.parse({ ...(payload as any) });
          await attachVariantDigitalAssetService.execute(command);
          break;
        }
        case "detachVariantDigitalAsset": {
          const command = DetachVariantDigitalAssetCommand.parse({ ...(payload as any) });
          await detachVariantDigitalAssetService.execute(command);
          break;
        }
        case "createSchedule": {
          const command = CreateScheduleCommand.parse({ ...(payload as any) });
          await createScheduleService.execute(command);
          break;
        }
        case "updateSchedule": {
          const command = UpdateScheduleCommand.parse({ ...(payload as any) });
          await updateScheduleService.execute(command);
          break;
        }
        case "cancelSchedule": {
          const command = CancelScheduleCommand.parse({ ...(payload as any) });
          await cancelScheduleService.execute(command);
          break;
        }
        case "updateProductTaxDetails": {
          const command = UpdateProductTaxDetailsCommand.parse({ ...(payload as any)});
          await updateProductTaxDetailsService.execute(command);
          break;
        }
        default:
          throw new Error(`Unknown command type: ${type}`);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };
}
