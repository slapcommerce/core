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
import { UpdateProductShippingSettingsService } from "../../app/product/updateProductShippingSettingsService";
import { UpdateProductPageLayoutService } from "../../app/product/updateProductPageLayoutService";
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
import { CreateScheduleService } from "../../app/schedule/createScheduleService";
import { UpdateScheduleService } from "../../app/schedule/updateScheduleService";
import { CancelScheduleService } from "../../app/schedule/cancelScheduleService";
import { CreateVariantService } from "../../app/variant/createVariantService";
import { ArchiveVariantService } from "../../app/variant/archiveVariantService";
import { PublishVariantService } from "../../app/variant/publishVariantService";
import { UpdateVariantDetailsService } from "../../app/variant/updateVariantDetailsService";
import { UpdateVariantInventoryService } from "../../app/variant/updateVariantInventoryService";
import { UpdateVariantPriceService } from "../../app/variant/updateVariantPriceService";
import { AddVariantImageService } from "../../app/variant/addVariantImageService";
import { RemoveVariantImageService } from "../../app/variant/removeVariantImageService";
import { ReorderVariantImagesService } from "../../app/variant/reorderVariantImagesService";
import { UpdateVariantImageAltTextService } from "../../app/variant/updateVariantImageAltTextService";
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
  UpdateProductShippingSettingsCommand,
  UpdateProductPageLayoutCommand,
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
  AddVariantImageCommand,
  RemoveVariantImageCommand,
  ReorderVariantImagesCommand,
  UpdateVariantImageAltTextCommand,
} from "../../app/variant/commands";
import {
  CreateScheduleCommand,
  UpdateScheduleCommand,
  CancelScheduleCommand,
} from "../../app/schedule/commands";

type Result<T> =
  | { readonly success: true; readonly data?: T }
  | { readonly success: false; readonly error: Error };

export function createAdminCommandsRouter(
  unitOfWork: UnitOfWork,
  projectionService: ProjectionService,
  imageUploadHelper?: ImageUploadHelper,
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
  const updateProductShippingSettingsService =
    new UpdateProductShippingSettingsService(unitOfWork, projectionService);
  const updateProductPageLayoutService = new UpdateProductPageLayoutService(
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
    imageUploadHelper,
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
    imageUploadHelper,
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
  const addVariantImageService = new AddVariantImageService(
    unitOfWork,
    projectionService,
    imageUploadHelper,
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

  return async (type: string, payload: unknown): Promise<Result<unknown>> => {
    if (!type) {
      return { success: false, error: new Error("Request must include type") };
    }

    try {
      switch (type) {
        case "createProduct": {
          const command = CreateProductCommand.parse(payload);
          await createProductService.execute(command);
          break;
        }
        case "archiveProduct": {
          const command = ArchiveProductCommand.parse(payload);
          await archiveProductService.execute(command);
          break;
        }
        case "publishProduct": {
          const command = PublishProductCommand.parse(payload);
          await publishProductService.execute(command);
          break;
        }
        case "unpublishProduct": {
          const command = UnpublishProductCommand.parse(payload);
          await unpublishProductService.execute(command);
          break;
        }
        case "changeSlug": {
          const command = ChangeSlugCommand.parse(payload);
          await changeSlugService.execute(command);
          break;
        }
        case "updateProductDetails": {
          const command = UpdateProductDetailsCommand.parse(payload);
          await updateProductDetailsService.execute(command);
          break;
        }
        case "updateProductMetadata": {
          const command = UpdateProductMetadataCommand.parse(payload);
          await updateProductMetadataService.execute(command);
          break;
        }
        case "updateProductClassification": {
          const command = UpdateProductClassificationCommand.parse(payload);
          await updateProductClassificationService.execute(command);
          break;
        }
        case "updateProductTags": {
          const command = UpdateProductTagsCommand.parse(payload);
          await updateProductTagsService.execute(command);
          break;
        }
        case "updateProductCollections": {
          const command = UpdateProductCollectionsCommand.parse(payload);
          await updateProductCollectionsService.execute(command);
          break;
        }
        case "updateProductShippingSettings": {
          const command = UpdateProductShippingSettingsCommand.parse(payload);
          await updateProductShippingSettingsService.execute(command);
          break;
        }
        case "updateProductPageLayout": {
          const command = UpdateProductPageLayoutCommand.parse(payload);
          await updateProductPageLayoutService.execute(command);
          break;
        }
        case "createCollection": {
          const command = CreateCollectionCommand.parse(payload);
          await createCollectionService.execute(command);
          break;
        }
        case "archiveCollection": {
          const command = ArchiveCollectionCommand.parse(payload);
          await archiveCollectionService.execute(command);
          break;
        }
        case "publishCollection": {
          const command = PublishCollectionCommand.parse(payload);
          await publishCollectionService.execute(command);
          break;
        }
        case "updateCollectionMetadata": {
          const command = UpdateCollectionMetadataCommand.parse(payload);
          await updateCollectionMetadataService.execute(command);
          break;
        }
        case "unpublishCollection": {
          const command = UnpublishCollectionCommand.parse(payload);
          await unpublishCollectionService.execute(command);
          break;
        }
        case "updateCollectionSeoMetadata": {
          const command = UpdateCollectionSeoMetadataCommand.parse(payload);
          await updateCollectionSeoMetadataService.execute(command);
          break;
        }
        case "addCollectionImage": {
          const command = AddCollectionImageCommand.parse(payload);
          const result = await addCollectionImageService.execute(command);
          return { success: true, data: result };
        }
        case "removeCollectionImage": {
          const command = RemoveCollectionImageCommand.parse(payload);
          await removeCollectionImageService.execute(command);
          break;
        }
        case "reorderCollectionImages": {
          const command = ReorderCollectionImagesCommand.parse(payload);
          await reorderCollectionImagesService.execute(command);
          break;
        }
        case "updateCollectionImageAltText": {
          const command = UpdateCollectionImageAltTextCommand.parse(payload);
          await updateCollectionImageAltTextService.execute(command);
          break;
        }
        case "updateCollectionImage": {
          const command = UpdateCollectionImageCommand.parse(payload);
          await updateCollectionImageService.execute(command);
          break;
        }
        case "createVariant": {
          const command = CreateVariantCommand.parse(payload);
          await createVariantService.execute(command);
          break;
        }
        case "archiveVariant": {
          const command = ArchiveVariantCommand.parse(payload);
          await archiveVariantService.execute(command);
          break;
        }
        case "publishVariant": {
          const command = PublishVariantCommand.parse(payload);
          await publishVariantService.execute(command);
          break;
        }
        case "updateVariantDetails": {
          const command = UpdateVariantDetailsCommand.parse(payload);
          await updateVariantDetailsService.execute(command);
          break;
        }
        case "updateVariantInventory": {
          const command = UpdateVariantInventoryCommand.parse(payload);
          await updateVariantInventoryService.execute(command);
          break;
        }
        case "updateVariantPrice": {
          const command = UpdateVariantPriceCommand.parse(payload);
          await updateVariantPriceService.execute(command);
          break;
        }
        case "addVariantImage": {
          const command = AddVariantImageCommand.parse(payload);
          const result = await addVariantImageService.execute(command);
          return { success: true, data: result };
        }
        case "removeVariantImage": {
          const command = RemoveVariantImageCommand.parse(payload);
          await removeVariantImageService.execute(command);
          break;
        }
        case "reorderVariantImages": {
          const command = ReorderVariantImagesCommand.parse(payload);
          await reorderVariantImagesService.execute(command);
          break;
        }
        case "updateVariantImageAltText": {
          const command = UpdateVariantImageAltTextCommand.parse(payload);
          await updateVariantImageAltTextService.execute(command);
          break;
        }
        case "createSchedule": {
          const command = CreateScheduleCommand.parse(payload);
          await createScheduleService.execute(command);
          break;
        }
        case "updateSchedule": {
          const command = UpdateScheduleCommand.parse(payload);
          await updateScheduleService.execute(command);
          break;
        }
        case "cancelSchedule": {
          const command = CancelScheduleCommand.parse(payload);
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
