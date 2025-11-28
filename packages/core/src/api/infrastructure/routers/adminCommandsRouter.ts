import type { UnitOfWork } from "../unitOfWork";
import { CreateProductService } from "../../app/product/commands/admin/createProductService";
import { ArchiveProductService } from "../../app/product/commands/admin/archiveProductService";
import { PublishProductService } from "../../app/product/commands/admin/publishProductService";
import { UnpublishProductService } from "../../app/product/commands/admin/unpublishProductService";
import { ChangeSlugService } from "../../app/product/commands/admin/changeSlugService";
import { UpdateProductDetailsService } from "../../app/product/commands/admin/updateProductDetailsService";
import { UpdateProductMetadataService } from "../../app/product/commands/admin/updateProductMetadataService";
import { UpdateProductClassificationService } from "../../app/product/commands/admin/updateProductClassificationService";
import { UpdateProductTagsService } from "../../app/product/commands/admin/updateProductTagsService";
import { UpdateProductCollectionsService } from "../../app/product/commands/admin/updateProductCollectionsService";
import { UpdateProductFulfillmentTypeService } from "../../app/product/commands/admin/updateProductFulfillmentTypeService";
import { CreateCollectionService } from "../../app/collection/commands/admin/createCollectionService";
import { ArchiveCollectionService } from "../../app/collection/commands/admin/archiveCollectionService";
import { PublishCollectionService } from "../../app/collection/commands/admin/publishCollectionService";
import { UpdateCollectionMetadataService } from "../../app/collection/commands/admin/updateCollectionMetadataService";
import { UnpublishCollectionService } from "../../app/collection/commands/admin/unpublishCollectionService";
import { UpdateCollectionSeoMetadataService } from "../../app/collection/commands/admin/updateCollectionSeoMetadataService";
import { AddCollectionImageService } from "../../app/collection/commands/admin/addCollectionImageService";
import { RemoveCollectionImageService } from "../../app/collection/commands/admin/removeCollectionImageService";
import { ReorderCollectionImagesService } from "../../app/collection/commands/admin/reorderCollectionImagesService";
import { UpdateCollectionImageAltTextService } from "../../app/collection/commands/admin/updateCollectionImageAltTextService";
import { UpdateCollectionImageService } from "../../app/collection/commands/admin/updateCollectionImageService";
import type { ImageUploadHelper } from "../imageUploadHelper";
import type { DigitalAssetUploadHelper } from "../digitalAssetUploadHelper";
import { CreateScheduleService } from "../../app/schedule/commands/admin/createScheduleService";
import { UpdateScheduleService } from "../../app/schedule/commands/admin/updateScheduleService";
import { CancelScheduleService } from "../../app/schedule/commands/admin/cancelScheduleService";
import { CreateVariantService } from "../../app/variant/commands/admin/createVariantService";
import { ArchiveVariantService } from "../../app/variant/commands/admin/archiveVariantService";
import { PublishVariantService } from "../../app/variant/commands/admin/publishVariantService";
import { UpdateVariantDetailsService } from "../../app/variant/commands/admin/updateVariantDetailsService";
import { UpdateVariantInventoryService } from "../../app/variant/commands/admin/updateVariantInventoryService";
import { UpdateVariantPriceService } from "../../app/variant/commands/admin/updateVariantPriceService";
import { UpdateVariantSkuService } from "../../app/variant/commands/admin/updateVariantSkuService";
import { AddVariantImageService } from "../../app/variant/commands/admin/addVariantImageService";
import { RemoveVariantImageService } from "../../app/variant/commands/admin/removeVariantImageService";
import { ReorderVariantImagesService } from "../../app/variant/commands/admin/reorderVariantImagesService";
import { UpdateVariantImageAltTextService } from "../../app/variant/commands/admin/updateVariantImageAltTextService";
import { AttachVariantDigitalAssetService } from "../../app/variant/commands/admin/attachVariantDigitalAssetService";
import { DetachVariantDigitalAssetService } from "../../app/variant/commands/admin/detachVariantDigitalAssetService";
import { ReorderVariantsInProductService } from "../../app/variant/commands/admin/reorderVariantsInProductService";
import { UpdateProductOptionsService } from "../../app/product/commands/admin/updateProductOptionsService";
import { UpdateProductTaxDetailsService } from "../../app/product/commands/admin/updateProductTaxDetailsService";
import { ReorderProductsInCollectionService } from "../../app/product/commands/admin/reorderProductsInCollectionService";
import { SetDefaultVariantService } from "../../app/product/commands/admin/setDefaultVariantService";
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
  ReorderProductsInCollectionCommand,
  SetDefaultVariantCommand,
} from "../../app/product/commands/admin/commands";
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
} from "../../app/collection/commands/admin/commands";
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
  ReorderVariantsInProductCommand,
} from "../../app/variant/commands/admin/commands";
import {
  CreateScheduleCommand,
  UpdateScheduleCommand,
  CancelScheduleCommand,
} from "../../app/schedule/commands/admin/commands";
import { type CommandType } from "../../app/command";

type Result<T> =
  | { readonly success: true; readonly data?: T }
  | { readonly success: false; readonly error: Error };

interface CommandHandler {
  parse: (payload: unknown) => unknown;
  execute: (command: unknown) => Promise<unknown>;
  returnsData?: boolean;
}

/**
 * AdminCommandsRouter routes admin commands to their corresponding services.
 * Uses a Map-based registry for command dispatch.
 */
export class AdminCommandsRouter {
  private readonly handlers: Map<CommandType, CommandHandler>;

  private constructor(
    unitOfWork: UnitOfWork,
    imageUploadHelper?: ImageUploadHelper,
    digitalAssetUploadHelper?: DigitalAssetUploadHelper,
  ) {
    this.handlers = new Map();
    this.initializeHandlers(unitOfWork, imageUploadHelper, digitalAssetUploadHelper);
  }

  /**
   * Creates a new AdminCommandsRouter instance
   */
  static create(
    unitOfWork: UnitOfWork,
    imageUploadHelper?: ImageUploadHelper,
    digitalAssetUploadHelper?: DigitalAssetUploadHelper,
  ): AdminCommandsRouter {
    return new AdminCommandsRouter(unitOfWork, imageUploadHelper, digitalAssetUploadHelper);
  }

  /**
   * Executes a command by type and payload
   */
  async execute(type: CommandType, payload: unknown): Promise<Result<unknown>> {
    if (!type) {
      return { success: false, error: new Error("Request must include type") };
    }

    const handler = this.handlers.get(type);
    if (!handler) {
      return { success: false, error: new Error(`Unknown command type: ${type}`) };
    }

    try {
      const command = handler.parse({ ...(payload as object) });
      const result = await handler.execute(command);

      if (handler.returnsData) {
        return { success: true, data: result };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private initializeHandlers(
    unitOfWork: UnitOfWork,
    imageUploadHelper?: ImageUploadHelper,
    digitalAssetUploadHelper?: DigitalAssetUploadHelper,
  ): void {
    // Product commands
    const createProductService = new CreateProductService(unitOfWork);
    this.handlers.set("createProduct", {
      parse: (p) => CreateProductCommand.parse(p),
      execute: (c) => createProductService.execute(c as CreateProductCommand),
    });

    const archiveProductService = new ArchiveProductService(unitOfWork);
    this.handlers.set("archiveProduct", {
      parse: (p) => ArchiveProductCommand.parse(p),
      execute: (c) => archiveProductService.execute(c as ArchiveProductCommand),
    });

    const publishProductService = new PublishProductService(unitOfWork);
    this.handlers.set("publishProduct", {
      parse: (p) => PublishProductCommand.parse(p),
      execute: (c) => publishProductService.execute(c as PublishProductCommand),
    });

    const unpublishProductService = new UnpublishProductService(unitOfWork);
    this.handlers.set("unpublishProduct", {
      parse: (p) => UnpublishProductCommand.parse(p),
      execute: (c) => unpublishProductService.execute(c as UnpublishProductCommand),
    });

    const changeSlugService = new ChangeSlugService(unitOfWork);
    this.handlers.set("changeSlug", {
      parse: (p) => ChangeSlugCommand.parse(p),
      execute: (c) => changeSlugService.execute(c as ChangeSlugCommand),
    });

    const updateProductDetailsService = new UpdateProductDetailsService(unitOfWork);
    this.handlers.set("updateProductDetails", {
      parse: (p) => UpdateProductDetailsCommand.parse(p),
      execute: (c) => updateProductDetailsService.execute(c as UpdateProductDetailsCommand),
    });

    const updateProductMetadataService = new UpdateProductMetadataService(unitOfWork);
    this.handlers.set("updateProductMetadata", {
      parse: (p) => UpdateProductMetadataCommand.parse(p),
      execute: (c) => updateProductMetadataService.execute(c as UpdateProductMetadataCommand),
    });

    const updateProductClassificationService = new UpdateProductClassificationService(unitOfWork);
    this.handlers.set("updateProductClassification", {
      parse: (p) => UpdateProductClassificationCommand.parse(p),
      execute: (c) => updateProductClassificationService.execute(c as UpdateProductClassificationCommand),
    });

    const updateProductTagsService = new UpdateProductTagsService(unitOfWork);
    this.handlers.set("updateProductTags", {
      parse: (p) => UpdateProductTagsCommand.parse(p),
      execute: (c) => updateProductTagsService.execute(c as UpdateProductTagsCommand),
    });

    const updateProductCollectionsService = new UpdateProductCollectionsService(unitOfWork);
    this.handlers.set("updateProductCollections", {
      parse: (p) => UpdateProductCollectionsCommand.parse(p),
      execute: (c) => updateProductCollectionsService.execute(c as UpdateProductCollectionsCommand),
    });

    const updateProductFulfillmentTypeService = new UpdateProductFulfillmentTypeService(unitOfWork);
    this.handlers.set("updateProductFulfillmentType", {
      parse: (p) => UpdateProductFulfillmentTypeCommand.parse(p),
      execute: (c) => updateProductFulfillmentTypeService.execute(c as UpdateProductFulfillmentTypeCommand),
    });

    const updateProductOptionsService = new UpdateProductOptionsService(unitOfWork);
    this.handlers.set("updateProductOptions", {
      parse: (p) => UpdateProductOptionsCommand.parse(p),
      execute: (c) => updateProductOptionsService.execute(c as UpdateProductOptionsCommand),
    });

    const updateProductTaxDetailsService = new UpdateProductTaxDetailsService(unitOfWork);
    this.handlers.set("updateProductTaxDetails", {
      parse: (p) => UpdateProductTaxDetailsCommand.parse(p),
      execute: (c) => updateProductTaxDetailsService.execute(c as UpdateProductTaxDetailsCommand),
    });

    const reorderProductsInCollectionService = new ReorderProductsInCollectionService(unitOfWork);
    this.handlers.set("reorderProductsInCollection", {
      parse: (p) => ReorderProductsInCollectionCommand.parse(p),
      execute: (c) => reorderProductsInCollectionService.execute(c as ReorderProductsInCollectionCommand),
    });

    // Collection commands
    const createCollectionService = new CreateCollectionService(unitOfWork);
    this.handlers.set("createCollection", {
      parse: (p) => CreateCollectionCommand.parse(p),
      execute: (c) => createCollectionService.execute(c as CreateCollectionCommand),
    });

    const archiveCollectionService = new ArchiveCollectionService(unitOfWork);
    this.handlers.set("archiveCollection", {
      parse: (p) => ArchiveCollectionCommand.parse(p),
      execute: (c) => archiveCollectionService.execute(c as ArchiveCollectionCommand),
    });

    const publishCollectionService = new PublishCollectionService(unitOfWork);
    this.handlers.set("publishCollection", {
      parse: (p) => PublishCollectionCommand.parse(p),
      execute: (c) => publishCollectionService.execute(c as PublishCollectionCommand),
    });

    const updateCollectionMetadataService = new UpdateCollectionMetadataService(unitOfWork);
    this.handlers.set("updateCollectionMetadata", {
      parse: (p) => UpdateCollectionMetadataCommand.parse(p),
      execute: (c) => updateCollectionMetadataService.execute(c as UpdateCollectionMetadataCommand),
    });

    const unpublishCollectionService = new UnpublishCollectionService(unitOfWork);
    this.handlers.set("unpublishCollection", {
      parse: (p) => UnpublishCollectionCommand.parse(p),
      execute: (c) => unpublishCollectionService.execute(c as UnpublishCollectionCommand),
    });

    const updateCollectionSeoMetadataService = new UpdateCollectionSeoMetadataService(unitOfWork);
    this.handlers.set("updateCollectionSeoMetadata", {
      parse: (p) => UpdateCollectionSeoMetadataCommand.parse(p),
      execute: (c) => updateCollectionSeoMetadataService.execute(c as UpdateCollectionSeoMetadataCommand),
    });

    const addCollectionImageService = new AddCollectionImageService(unitOfWork, imageUploadHelper!);
    this.handlers.set("addCollectionImage", {
      parse: (p) => AddCollectionImageCommand.parse(p),
      execute: (c) => addCollectionImageService.execute(c as AddCollectionImageCommand),
      returnsData: true,
    });

    const removeCollectionImageService = new RemoveCollectionImageService(unitOfWork);
    this.handlers.set("removeCollectionImage", {
      parse: (p) => RemoveCollectionImageCommand.parse(p),
      execute: (c) => removeCollectionImageService.execute(c as RemoveCollectionImageCommand),
    });

    const reorderCollectionImagesService = new ReorderCollectionImagesService(unitOfWork);
    this.handlers.set("reorderCollectionImages", {
      parse: (p) => ReorderCollectionImagesCommand.parse(p),
      execute: (c) => reorderCollectionImagesService.execute(c as ReorderCollectionImagesCommand),
    });

    const updateCollectionImageAltTextService = new UpdateCollectionImageAltTextService(unitOfWork);
    this.handlers.set("updateCollectionImageAltText", {
      parse: (p) => UpdateCollectionImageAltTextCommand.parse(p),
      execute: (c) => updateCollectionImageAltTextService.execute(c as UpdateCollectionImageAltTextCommand),
    });

    const updateCollectionImageService = new UpdateCollectionImageService(unitOfWork, imageUploadHelper!);
    this.handlers.set("updateCollectionImage", {
      parse: (p) => UpdateCollectionImageCommand.parse(p),
      execute: (c) => updateCollectionImageService.execute(c as UpdateCollectionImageCommand),
    });

    // Schedule commands
    const createScheduleService = new CreateScheduleService(unitOfWork);
    this.handlers.set("createSchedule", {
      parse: (p) => CreateScheduleCommand.parse(p),
      execute: (c) => createScheduleService.execute(c as CreateScheduleCommand),
    });

    const updateScheduleService = new UpdateScheduleService(unitOfWork);
    this.handlers.set("updateSchedule", {
      parse: (p) => UpdateScheduleCommand.parse(p),
      execute: (c) => updateScheduleService.execute(c as UpdateScheduleCommand),
    });

    const cancelScheduleService = new CancelScheduleService(unitOfWork);
    this.handlers.set("cancelSchedule", {
      parse: (p) => CancelScheduleCommand.parse(p),
      execute: (c) => cancelScheduleService.execute(c as CancelScheduleCommand),
    });

    // Variant commands
    const createVariantService = new CreateVariantService(unitOfWork);
    this.handlers.set("createVariant", {
      parse: (p) => CreateVariantCommand.parse(p),
      execute: (c) => createVariantService.execute(c as CreateVariantCommand),
    });

    const archiveVariantService = new ArchiveVariantService(unitOfWork);
    this.handlers.set("archiveVariant", {
      parse: (p) => ArchiveVariantCommand.parse(p),
      execute: (c) => archiveVariantService.execute(c as ArchiveVariantCommand),
    });

    const publishVariantService = new PublishVariantService(unitOfWork);
    this.handlers.set("publishVariant", {
      parse: (p) => PublishVariantCommand.parse(p),
      execute: (c) => publishVariantService.execute(c as PublishVariantCommand),
    });

    const updateVariantDetailsService = new UpdateVariantDetailsService(unitOfWork);
    this.handlers.set("updateVariantDetails", {
      parse: (p) => UpdateVariantDetailsCommand.parse(p),
      execute: (c) => updateVariantDetailsService.execute(c as UpdateVariantDetailsCommand),
    });

    const updateVariantInventoryService = new UpdateVariantInventoryService(unitOfWork);
    this.handlers.set("updateVariantInventory", {
      parse: (p) => UpdateVariantInventoryCommand.parse(p),
      execute: (c) => updateVariantInventoryService.execute(c as UpdateVariantInventoryCommand),
    });

    const updateVariantPriceService = new UpdateVariantPriceService(unitOfWork);
    this.handlers.set("updateVariantPrice", {
      parse: (p) => UpdateVariantPriceCommand.parse(p),
      execute: (c) => updateVariantPriceService.execute(c as UpdateVariantPriceCommand),
    });

    const updateVariantSkuService = new UpdateVariantSkuService(unitOfWork);
    this.handlers.set("updateVariantSku", {
      parse: (p) => UpdateVariantSkuCommand.parse(p),
      execute: (c) => updateVariantSkuService.execute(c as UpdateVariantSkuCommand),
    });

    const addVariantImageService = new AddVariantImageService(unitOfWork, imageUploadHelper!);
    this.handlers.set("addVariantImage", {
      parse: (p) => AddVariantImageCommand.parse(p),
      execute: (c) => addVariantImageService.execute(c as AddVariantImageCommand),
      returnsData: true,
    });

    const removeVariantImageService = new RemoveVariantImageService(unitOfWork);
    this.handlers.set("removeVariantImage", {
      parse: (p) => RemoveVariantImageCommand.parse(p),
      execute: (c) => removeVariantImageService.execute(c as RemoveVariantImageCommand),
    });

    const reorderVariantImagesService = new ReorderVariantImagesService(unitOfWork);
    this.handlers.set("reorderVariantImages", {
      parse: (p) => ReorderVariantImagesCommand.parse(p),
      execute: (c) => reorderVariantImagesService.execute(c as ReorderVariantImagesCommand),
    });

    const updateVariantImageAltTextService = new UpdateVariantImageAltTextService(unitOfWork);
    this.handlers.set("updateVariantImageAltText", {
      parse: (p) => UpdateVariantImageAltTextCommand.parse(p),
      execute: (c) => updateVariantImageAltTextService.execute(c as UpdateVariantImageAltTextCommand),
    });

    const attachVariantDigitalAssetService = new AttachVariantDigitalAssetService(unitOfWork, digitalAssetUploadHelper!);
    this.handlers.set("attachVariantDigitalAsset", {
      parse: (p) => AttachVariantDigitalAssetCommand.parse(p),
      execute: (c) => attachVariantDigitalAssetService.execute(c as AttachVariantDigitalAssetCommand),
    });

    const detachVariantDigitalAssetService = new DetachVariantDigitalAssetService(unitOfWork);
    this.handlers.set("detachVariantDigitalAsset", {
      parse: (p) => DetachVariantDigitalAssetCommand.parse(p),
      execute: (c) => detachVariantDigitalAssetService.execute(c as DetachVariantDigitalAssetCommand),
    });

    const reorderVariantsInProductService = new ReorderVariantsInProductService(unitOfWork);
    this.handlers.set("reorderVariantsInProduct", {
      parse: (p) => ReorderVariantsInProductCommand.parse(p),
      execute: (c) => reorderVariantsInProductService.execute(c as ReorderVariantsInProductCommand),
    });

    const setDefaultVariantService = new SetDefaultVariantService(unitOfWork);
    this.handlers.set("setDefaultVariant", {
      parse: (p) => SetDefaultVariantCommand.parse(p),
      execute: (c) => setDefaultVariantService.execute(c as SetDefaultVariantCommand),
    });
  }
}
