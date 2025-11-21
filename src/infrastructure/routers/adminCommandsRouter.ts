import type { UnitOfWork } from "../unitOfWork";
import type { ProjectionService } from "../projectionService";
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
import { CreateCollectionService } from "../../app/collection/createCollectionService";
import { ArchiveCollectionService } from "../../app/collection/archiveCollectionService";
import { PublishCollectionService } from "../../app/collection/publishCollectionService";
import { UpdateCollectionMetadataService } from "../../app/collection/updateCollectionMetadataService";
import { UnpublishCollectionService } from "../../app/collection/unpublishCollectionService";
import { UpdateCollectionSeoMetadataService } from "../../app/collection/updateCollectionSeoMetadataService";
import { AddCollectionImageService } from "../../app/collection/addCollectionImageService";
import { RemoveCollectionImageService } from "../../app/collection/removeCollectionImageService";
import { ReorderCollectionImagesService } from "../../app/collection/reorderCollectionImagesService";
import { UpdateCollectionImageAltTextService } from "../../app/collection/updateCollectionImageAltTextService";
import { UpdateCollectionImageService } from "../../app/collection/updateCollectionImageService";
import type { ImageUploadHelper } from "../imageUploadHelper";
import type { DigitalAssetUploadHelper } from "../digitalAssetUploadHelper";
import { CreateScheduleService } from "../../app/schedule/createScheduleService";
import { UpdateScheduleService } from "../../app/schedule/updateScheduleService";
import { CancelScheduleService } from "../../app/schedule/cancelScheduleService";
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
} from "../../app/product/commands";
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
} from "../../app/collection/commands";
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
} from "../../app/schedule/commands";
import { type CommandType } from "@/app/command";

type Result<T> =
  | { readonly success: true; readonly data?: T }
  | { readonly success: false; readonly error: Error };

export function createAdminCommandsRouter(
  unitOfWork: UnitOfWork,
  projectionService: ProjectionService,
  imageUploadHelper?: ImageUploadHelper,
  digitalAssetUploadHelper?: DigitalAssetUploadHelper,
) {
  // Initialize all services
  const createProductService = new CreateProductService(
    unitOfWork,
    projectionService,
  );
  const archiveProductService = new ArchiveProductService(
    unitOfWork,
    projectionService,
  );
  const publishProductService = new PublishProductService(
    unitOfWork,
    projectionService,
  );
  const unpublishProductService = new UnpublishProductService(
    unitOfWork,
    projectionService,
  );
  const changeSlugService = new ChangeSlugService(
    unitOfWork,
    projectionService,
  );
  const updateProductDetailsService = new UpdateProductDetailsService(
    unitOfWork,
    projectionService,
  );
  const updateProductMetadataService = new UpdateProductMetadataService(
    unitOfWork,
    projectionService,
  );
  const updateProductClassificationService =
    new UpdateProductClassificationService(unitOfWork, projectionService);
  const updateProductTagsService = new UpdateProductTagsService(
    unitOfWork,
    projectionService,
  );
  const updateProductCollectionsService = new UpdateProductCollectionsService(
    unitOfWork,
    projectionService,
  );
  const updateProductFulfillmentTypeService =
    new UpdateProductFulfillmentTypeService(unitOfWork, projectionService);
  const updateProductOptionsService = new UpdateProductOptionsService(
    unitOfWork,
    projectionService,
  );
  const createCollectionService = new CreateCollectionService(
    unitOfWork,
    projectionService,
  );
  const archiveCollectionService = new ArchiveCollectionService(
    unitOfWork,
    projectionService,
  );
  const publishCollectionService = new PublishCollectionService(
    unitOfWork,
    projectionService,
  );
  const updateCollectionMetadataService = new UpdateCollectionMetadataService(
    unitOfWork,
    projectionService,
  );
  const unpublishCollectionService = new UnpublishCollectionService(
    unitOfWork,
    projectionService,
  );
  const updateCollectionSeoMetadataService =
    new UpdateCollectionSeoMetadataService(unitOfWork, projectionService);
  const addCollectionImageService = new AddCollectionImageService(
    unitOfWork,
    projectionService,
    imageUploadHelper!,
  );
  const removeCollectionImageService = new RemoveCollectionImageService(
    unitOfWork,
    projectionService,
  );
  const reorderCollectionImagesService = new ReorderCollectionImagesService(
    unitOfWork,
    projectionService,
  );
  const updateCollectionImageAltTextService = new UpdateCollectionImageAltTextService(
    unitOfWork,
    projectionService,
  );
  const updateCollectionImageService = new UpdateCollectionImageService(
    unitOfWork,
    projectionService,
    imageUploadHelper!,
  );
  const createScheduleService = new CreateScheduleService(
    unitOfWork,
    projectionService,
  );
  const updateScheduleService = new UpdateScheduleService(
    unitOfWork,
    projectionService,
  );
  const cancelScheduleService = new CancelScheduleService(
    unitOfWork,
    projectionService,
  );
  const createVariantService = new CreateVariantService(
    unitOfWork,
    projectionService,
  );
  const archiveVariantService = new ArchiveVariantService(
    unitOfWork,
    projectionService,
  );
  const publishVariantService = new PublishVariantService(
    unitOfWork,
    projectionService,
  );
  const updateVariantDetailsService = new UpdateVariantDetailsService(
    unitOfWork,
    projectionService,
  );
  const updateVariantInventoryService = new UpdateVariantInventoryService(
    unitOfWork,
    projectionService,
  );
  const updateVariantPriceService = new UpdateVariantPriceService(
    unitOfWork,
    projectionService,
  );
  const updateVariantSkuService = new UpdateVariantSkuService(
    unitOfWork,
    projectionService,
  );
  const addVariantImageService = new AddVariantImageService(
    unitOfWork,
    projectionService,
    imageUploadHelper!,
  );
  const removeVariantImageService = new RemoveVariantImageService(
    unitOfWork,
    projectionService,
  );
  const reorderVariantImagesService = new ReorderVariantImagesService(
    unitOfWork,
    projectionService,
  );
  const updateVariantImageAltTextService = new UpdateVariantImageAltTextService(
    unitOfWork,
    projectionService,
  );
  const attachVariantDigitalAssetService = new AttachVariantDigitalAssetService(
    unitOfWork,
    projectionService,
    digitalAssetUploadHelper!,
  );
  const detachVariantDigitalAssetService = new DetachVariantDigitalAssetService(
    unitOfWork,
    projectionService,
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
