import type { UnitOfWork } from "../unitOfWork";
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
import { CreateBundleService } from "../../app/bundle/commands/admin/createBundleService";
import { ArchiveBundleService } from "../../app/bundle/commands/admin/archiveBundleService";
import { PublishBundleService } from "../../app/bundle/commands/admin/publishBundleService";
import { UnpublishBundleService } from "../../app/bundle/commands/admin/unpublishBundleService";
import { UpdateBundleItemsService } from "../../app/bundle/commands/admin/updateBundleItemsService";
import { UpdateBundleDetailsService } from "../../app/bundle/commands/admin/updateBundleDetailsService";
import { UpdateBundleMetadataService } from "../../app/bundle/commands/admin/updateBundleMetadataService";
import { UpdateBundlePriceService } from "../../app/bundle/commands/admin/updateBundlePriceService";
import { UpdateBundleCollectionsService } from "../../app/bundle/commands/admin/updateBundleCollectionsService";
import { ChangeBundleSlugService } from "../../app/bundle/commands/admin/changeBundleSlugService";
import { UpdateBundleTaxDetailsService } from "../../app/bundle/commands/admin/updateBundleTaxDetailsService";
import { AddBundleImageService } from "../../app/bundle/commands/admin/addBundleImageService";
import { RemoveBundleImageService } from "../../app/bundle/commands/admin/removeBundleImageService";
import { ReorderBundleImagesService } from "../../app/bundle/commands/admin/reorderBundleImagesService";
import { UpdateBundleImageAltTextService } from "../../app/bundle/commands/admin/updateBundleImageAltTextService";
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
  CreateScheduleCommand,
  UpdateScheduleCommand,
  CancelScheduleCommand,
} from "../../app/schedule/commands/admin/commands";
import {
  CreateBundleCommand,
  ArchiveBundleCommand,
  PublishBundleCommand,
  UnpublishBundleCommand,
  UpdateBundleItemsCommand,
  UpdateBundleDetailsCommand,
  UpdateBundleMetadataCommand,
  UpdateBundlePriceCommand,
  UpdateBundleCollectionsCommand,
  ChangeBundleSlugCommand,
  UpdateBundleTaxDetailsCommand,
  AddBundleImageCommand,
  RemoveBundleImageCommand,
  ReorderBundleImagesCommand,
  UpdateBundleImageAltTextCommand,
} from "../../app/bundle/commands/admin/commands";
import { type CommandType } from "../../app/command";
import { CreateDigitalDownloadableProductService } from "../../app/digitalDownloadableProduct/commands/admin/createDigitalDownloadableProductService";
import { ArchiveDigitalDownloadableProductService } from "../../app/digitalDownloadableProduct/commands/admin/archiveDigitalDownloadableProductService";
import { PublishDigitalDownloadableProductService } from "../../app/digitalDownloadableProduct/commands/admin/publishDigitalDownloadableProductService";
import { UnpublishDigitalDownloadableProductService } from "../../app/digitalDownloadableProduct/commands/admin/unpublishDigitalDownloadableProductService";
import { ChangeDigitalDownloadableProductSlugService } from "../../app/digitalDownloadableProduct/commands/admin/changeDigitalDownloadableProductSlugService";
import { UpdateDigitalDownloadableProductDetailsService } from "../../app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductDetailsService";
import { UpdateDigitalDownloadableProductMetadataService } from "../../app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductMetadataService";
import { UpdateDigitalDownloadableProductClassificationService } from "../../app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductClassificationService";
import { UpdateDigitalDownloadableProductTagsService } from "../../app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductTagsService";
import { UpdateDigitalDownloadableProductCollectionsService } from "../../app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductCollectionsService";
import { UpdateDigitalDownloadableProductOptionsService } from "../../app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductOptionsService";
import { UpdateDigitalDownloadableProductTaxDetailsService } from "../../app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductTaxDetailsService";
import { SetDigitalDownloadableProductDefaultVariantService } from "../../app/digitalDownloadableProduct/commands/admin/setDigitalDownloadableProductDefaultVariantService";
import { UpdateDigitalDownloadableProductDownloadSettingsService } from "../../app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductDownloadSettingsService";
import {
  CreateDigitalDownloadableProductCommand,
  ArchiveDigitalDownloadableProductCommand,
  PublishDigitalDownloadableProductCommand,
  UnpublishDigitalDownloadableProductCommand,
  ChangeDigitalDownloadableProductSlugCommand,
  UpdateDigitalDownloadableProductDetailsCommand,
  UpdateDigitalDownloadableProductMetadataCommand,
  UpdateDigitalDownloadableProductClassificationCommand,
  UpdateDigitalDownloadableProductTagsCommand,
  UpdateDigitalDownloadableProductCollectionsCommand,
  UpdateDigitalDownloadableProductOptionsCommand,
  UpdateDigitalDownloadableProductTaxDetailsCommand,
  SetDigitalDownloadableProductDefaultVariantCommand,
  UpdateDigitalDownloadableProductDownloadSettingsCommand,
} from "../../app/digitalDownloadableProduct/commands/admin/commands";
import { CreateDigitalDownloadableVariantService } from "../../app/digitalDownloadableVariant/commands/admin/createDigitalDownloadableVariantService";
import { ArchiveDigitalDownloadableVariantService } from "../../app/digitalDownloadableVariant/commands/admin/archiveDigitalDownloadableVariantService";
import { PublishDigitalDownloadableVariantService } from "../../app/digitalDownloadableVariant/commands/admin/publishDigitalDownloadableVariantService";
import { UpdateDigitalDownloadableVariantDetailsService } from "../../app/digitalDownloadableVariant/commands/admin/updateDigitalDownloadableVariantDetailsService";
import { UpdateDigitalDownloadableVariantPriceService } from "../../app/digitalDownloadableVariant/commands/admin/updateDigitalDownloadableVariantPriceService";
import { UpdateDigitalDownloadableVariantSkuService } from "../../app/digitalDownloadableVariant/commands/admin/updateDigitalDownloadableVariantSkuService";
import { AddDigitalDownloadableVariantImageService } from "../../app/digitalDownloadableVariant/commands/admin/addDigitalDownloadableVariantImageService";
import { RemoveDigitalDownloadableVariantImageService } from "../../app/digitalDownloadableVariant/commands/admin/removeDigitalDownloadableVariantImageService";
import { ReorderDigitalDownloadableVariantImagesService } from "../../app/digitalDownloadableVariant/commands/admin/reorderDigitalDownloadableVariantImagesService";
import { UpdateDigitalDownloadableVariantImageAltTextService } from "../../app/digitalDownloadableVariant/commands/admin/updateDigitalDownloadableVariantImageAltTextService";
import { AttachDigitalDownloadableVariantDigitalAssetService } from "../../app/digitalDownloadableVariant/commands/admin/attachDigitalDownloadableVariantDigitalAssetService";
import { DetachDigitalDownloadableVariantDigitalAssetService } from "../../app/digitalDownloadableVariant/commands/admin/detachDigitalDownloadableVariantDigitalAssetService";
import { UpdateDigitalDownloadableVariantDownloadSettingsService } from "../../app/digitalDownloadableVariant/commands/admin/updateDigitalDownloadableVariantDownloadSettingsService";
import {
  CreateDigitalDownloadableVariantCommand,
  ArchiveDigitalDownloadableVariantCommand,
  PublishDigitalDownloadableVariantCommand,
  UpdateDigitalDownloadableVariantDetailsCommand,
  UpdateDigitalDownloadableVariantPriceCommand,
  UpdateDigitalDownloadableVariantSkuCommand,
  AddDigitalDownloadableVariantImageCommand,
  RemoveDigitalDownloadableVariantImageCommand,
  ReorderDigitalDownloadableVariantImagesCommand,
  UpdateDigitalDownloadableVariantImageAltTextCommand,
  AttachDigitalDownloadableVariantDigitalAssetCommand,
  DetachDigitalDownloadableVariantDigitalAssetCommand,
  UpdateDigitalDownloadableVariantDownloadSettingsCommand,
} from "../../app/digitalDownloadableVariant/commands/admin/commands";
import { CreateDropshipProductService } from "../../app/dropshipProduct/commands/admin/createDropshipProductService";
import { ArchiveDropshipProductService } from "../../app/dropshipProduct/commands/admin/archiveDropshipProductService";
import { PublishDropshipProductService } from "../../app/dropshipProduct/commands/admin/publishDropshipProductService";
import { UnpublishDropshipProductService } from "../../app/dropshipProduct/commands/admin/unpublishDropshipProductService";
import { ChangeDropshipProductSlugService } from "../../app/dropshipProduct/commands/admin/changeDropshipProductSlugService";
import { UpdateDropshipProductDetailsService } from "../../app/dropshipProduct/commands/admin/updateDropshipProductDetailsService";
import { UpdateDropshipProductMetadataService } from "../../app/dropshipProduct/commands/admin/updateDropshipProductMetadataService";
import { UpdateDropshipProductClassificationService } from "../../app/dropshipProduct/commands/admin/updateDropshipProductClassificationService";
import { UpdateDropshipProductTagsService } from "../../app/dropshipProduct/commands/admin/updateDropshipProductTagsService";
import { UpdateDropshipProductCollectionsService } from "../../app/dropshipProduct/commands/admin/updateDropshipProductCollectionsService";
import { UpdateDropshipProductOptionsService } from "../../app/dropshipProduct/commands/admin/updateDropshipProductOptionsService";
import { UpdateDropshipProductTaxDetailsService } from "../../app/dropshipProduct/commands/admin/updateDropshipProductTaxDetailsService";
import { SetDropshipProductDefaultVariantService } from "../../app/dropshipProduct/commands/admin/setDropshipProductDefaultVariantService";
import { UpdateDropshipProductSafetyBufferService } from "../../app/dropshipProduct/commands/admin/updateDropshipProductSafetyBufferService";
import { UpdateDropshipProductFulfillmentSettingsService } from "../../app/dropshipProduct/commands/admin/updateDropshipProductFulfillmentSettingsService";
import {
  CreateDropshipProductCommand,
  ArchiveDropshipProductCommand,
  PublishDropshipProductCommand,
  UnpublishDropshipProductCommand,
  ChangeDropshipProductSlugCommand,
  UpdateDropshipProductDetailsCommand,
  UpdateDropshipProductMetadataCommand,
  UpdateDropshipProductClassificationCommand,
  UpdateDropshipProductTagsCommand,
  UpdateDropshipProductCollectionsCommand,
  UpdateDropshipProductOptionsCommand,
  UpdateDropshipProductTaxDetailsCommand,
  SetDropshipProductDefaultVariantCommand,
  UpdateDropshipProductSafetyBufferCommand,
  UpdateDropshipProductFulfillmentSettingsCommand,
} from "../../app/dropshipProduct/commands/admin/commands";
import { CreateDropshipVariantService } from "../../app/dropshipVariant/commands/admin/createDropshipVariantService";
import { ArchiveDropshipVariantService } from "../../app/dropshipVariant/commands/admin/archiveDropshipVariantService";
import { PublishDropshipVariantService } from "../../app/dropshipVariant/commands/admin/publishDropshipVariantService";
import { UpdateDropshipVariantDetailsService } from "../../app/dropshipVariant/commands/admin/updateDropshipVariantDetailsService";
import { UpdateDropshipVariantPriceService } from "../../app/dropshipVariant/commands/admin/updateDropshipVariantPriceService";
import { UpdateDropshipVariantSkuService } from "../../app/dropshipVariant/commands/admin/updateDropshipVariantSkuService";
import { AddDropshipVariantImageService } from "../../app/dropshipVariant/commands/admin/addDropshipVariantImageService";
import { RemoveDropshipVariantImageService } from "../../app/dropshipVariant/commands/admin/removeDropshipVariantImageService";
import { ReorderDropshipVariantImagesService } from "../../app/dropshipVariant/commands/admin/reorderDropshipVariantImagesService";
import { UpdateDropshipVariantImageAltTextService } from "../../app/dropshipVariant/commands/admin/updateDropshipVariantImageAltTextService";
import { UpdateDropshipVariantInventoryService } from "../../app/dropshipVariant/commands/admin/updateDropshipVariantInventoryService";
import { UpdateDropshipVariantFulfillmentSettingsService } from "../../app/dropshipVariant/commands/admin/updateDropshipVariantFulfillmentSettingsService";
import {
  CreateDropshipVariantCommand,
  ArchiveDropshipVariantCommand,
  PublishDropshipVariantCommand,
  UpdateDropshipVariantDetailsCommand,
  UpdateDropshipVariantPriceCommand,
  UpdateDropshipVariantSkuCommand,
  AddDropshipVariantImageCommand,
  RemoveDropshipVariantImageCommand,
  ReorderDropshipVariantImagesCommand,
  UpdateDropshipVariantImageAltTextCommand,
  UpdateDropshipVariantInventoryCommand,
  UpdateDropshipVariantFulfillmentSettingsCommand,
} from "../../app/dropshipVariant/commands/admin/commands";

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

    // Bundle commands
    const createBundleService = new CreateBundleService(unitOfWork);
    this.handlers.set("createBundle", {
      parse: (p) => CreateBundleCommand.parse(p),
      execute: (c) => createBundleService.execute(c as CreateBundleCommand),
    });

    const archiveBundleService = new ArchiveBundleService(unitOfWork);
    this.handlers.set("archiveBundle", {
      parse: (p) => ArchiveBundleCommand.parse(p),
      execute: (c) => archiveBundleService.execute(c as ArchiveBundleCommand),
    });

    const publishBundleService = new PublishBundleService(unitOfWork);
    this.handlers.set("publishBundle", {
      parse: (p) => PublishBundleCommand.parse(p),
      execute: (c) => publishBundleService.execute(c as PublishBundleCommand),
    });

    const unpublishBundleService = new UnpublishBundleService(unitOfWork);
    this.handlers.set("unpublishBundle", {
      parse: (p) => UnpublishBundleCommand.parse(p),
      execute: (c) => unpublishBundleService.execute(c as UnpublishBundleCommand),
    });

    const updateBundleItemsService = new UpdateBundleItemsService(unitOfWork);
    this.handlers.set("updateBundleItems", {
      parse: (p) => UpdateBundleItemsCommand.parse(p),
      execute: (c) => updateBundleItemsService.execute(c as UpdateBundleItemsCommand),
    });

    const updateBundleDetailsService = new UpdateBundleDetailsService(unitOfWork);
    this.handlers.set("updateBundleDetails", {
      parse: (p) => UpdateBundleDetailsCommand.parse(p),
      execute: (c) => updateBundleDetailsService.execute(c as UpdateBundleDetailsCommand),
    });

    const updateBundleMetadataService = new UpdateBundleMetadataService(unitOfWork);
    this.handlers.set("updateBundleMetadata", {
      parse: (p) => UpdateBundleMetadataCommand.parse(p),
      execute: (c) => updateBundleMetadataService.execute(c as UpdateBundleMetadataCommand),
    });

    const updateBundlePriceService = new UpdateBundlePriceService(unitOfWork);
    this.handlers.set("updateBundlePrice", {
      parse: (p) => UpdateBundlePriceCommand.parse(p),
      execute: (c) => updateBundlePriceService.execute(c as UpdateBundlePriceCommand),
    });

    const updateBundleCollectionsService = new UpdateBundleCollectionsService(unitOfWork);
    this.handlers.set("updateBundleCollections", {
      parse: (p) => UpdateBundleCollectionsCommand.parse(p),
      execute: (c) => updateBundleCollectionsService.execute(c as UpdateBundleCollectionsCommand),
    });

    const changeBundleSlugService = new ChangeBundleSlugService(unitOfWork);
    this.handlers.set("changeBundleSlug", {
      parse: (p) => ChangeBundleSlugCommand.parse(p),
      execute: (c) => changeBundleSlugService.execute(c as ChangeBundleSlugCommand),
    });

    const updateBundleTaxDetailsService = new UpdateBundleTaxDetailsService(unitOfWork);
    this.handlers.set("updateBundleTaxDetails", {
      parse: (p) => UpdateBundleTaxDetailsCommand.parse(p),
      execute: (c) => updateBundleTaxDetailsService.execute(c as UpdateBundleTaxDetailsCommand),
    });

    const addBundleImageService = new AddBundleImageService(unitOfWork, imageUploadHelper!);
    this.handlers.set("addBundleImage", {
      parse: (p) => AddBundleImageCommand.parse(p),
      execute: (c) => addBundleImageService.execute(c as AddBundleImageCommand),
      returnsData: true,
    });

    const removeBundleImageService = new RemoveBundleImageService(unitOfWork);
    this.handlers.set("removeBundleImage", {
      parse: (p) => RemoveBundleImageCommand.parse(p),
      execute: (c) => removeBundleImageService.execute(c as RemoveBundleImageCommand),
    });

    const reorderBundleImagesService = new ReorderBundleImagesService(unitOfWork);
    this.handlers.set("reorderBundleImages", {
      parse: (p) => ReorderBundleImagesCommand.parse(p),
      execute: (c) => reorderBundleImagesService.execute(c as ReorderBundleImagesCommand),
    });

    const updateBundleImageAltTextService = new UpdateBundleImageAltTextService(unitOfWork);
    this.handlers.set("updateBundleImageAltText", {
      parse: (p) => UpdateBundleImageAltTextCommand.parse(p),
      execute: (c) => updateBundleImageAltTextService.execute(c as UpdateBundleImageAltTextCommand),
    });

    // Digital Downloadable Product commands
    const createDigitalDownloadableProductService = new CreateDigitalDownloadableProductService(unitOfWork);
    this.handlers.set("createDigitalDownloadableProduct", {
      parse: (p) => CreateDigitalDownloadableProductCommand.parse(p),
      execute: (c) => createDigitalDownloadableProductService.execute(c as CreateDigitalDownloadableProductCommand),
    });

    const archiveDigitalDownloadableProductService = new ArchiveDigitalDownloadableProductService(unitOfWork);
    this.handlers.set("archiveDigitalDownloadableProduct", {
      parse: (p) => ArchiveDigitalDownloadableProductCommand.parse(p),
      execute: (c) => archiveDigitalDownloadableProductService.execute(c as ArchiveDigitalDownloadableProductCommand),
    });

    const publishDigitalDownloadableProductService = new PublishDigitalDownloadableProductService(unitOfWork);
    this.handlers.set("publishDigitalDownloadableProduct", {
      parse: (p) => PublishDigitalDownloadableProductCommand.parse(p),
      execute: (c) => publishDigitalDownloadableProductService.execute(c as PublishDigitalDownloadableProductCommand),
    });

    const unpublishDigitalDownloadableProductService = new UnpublishDigitalDownloadableProductService(unitOfWork);
    this.handlers.set("unpublishDigitalDownloadableProduct", {
      parse: (p) => UnpublishDigitalDownloadableProductCommand.parse(p),
      execute: (c) => unpublishDigitalDownloadableProductService.execute(c as UnpublishDigitalDownloadableProductCommand),
    });

    const changeDigitalDownloadableProductSlugService = new ChangeDigitalDownloadableProductSlugService(unitOfWork);
    this.handlers.set("changeDigitalDownloadableProductSlug", {
      parse: (p) => ChangeDigitalDownloadableProductSlugCommand.parse(p),
      execute: (c) => changeDigitalDownloadableProductSlugService.execute(c as ChangeDigitalDownloadableProductSlugCommand),
    });

    const updateDigitalDownloadableProductDetailsService = new UpdateDigitalDownloadableProductDetailsService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableProductDetails", {
      parse: (p) => UpdateDigitalDownloadableProductDetailsCommand.parse(p),
      execute: (c) => updateDigitalDownloadableProductDetailsService.execute(c as UpdateDigitalDownloadableProductDetailsCommand),
    });

    const updateDigitalDownloadableProductMetadataService = new UpdateDigitalDownloadableProductMetadataService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableProductMetadata", {
      parse: (p) => UpdateDigitalDownloadableProductMetadataCommand.parse(p),
      execute: (c) => updateDigitalDownloadableProductMetadataService.execute(c as UpdateDigitalDownloadableProductMetadataCommand),
    });

    const updateDigitalDownloadableProductClassificationService = new UpdateDigitalDownloadableProductClassificationService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableProductClassification", {
      parse: (p) => UpdateDigitalDownloadableProductClassificationCommand.parse(p),
      execute: (c) => updateDigitalDownloadableProductClassificationService.execute(c as UpdateDigitalDownloadableProductClassificationCommand),
    });

    const updateDigitalDownloadableProductTagsService = new UpdateDigitalDownloadableProductTagsService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableProductTags", {
      parse: (p) => UpdateDigitalDownloadableProductTagsCommand.parse(p),
      execute: (c) => updateDigitalDownloadableProductTagsService.execute(c as UpdateDigitalDownloadableProductTagsCommand),
    });

    const updateDigitalDownloadableProductCollectionsService = new UpdateDigitalDownloadableProductCollectionsService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableProductCollections", {
      parse: (p) => UpdateDigitalDownloadableProductCollectionsCommand.parse(p),
      execute: (c) => updateDigitalDownloadableProductCollectionsService.execute(c as UpdateDigitalDownloadableProductCollectionsCommand),
    });

    const updateDigitalDownloadableProductOptionsService = new UpdateDigitalDownloadableProductOptionsService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableProductOptions", {
      parse: (p) => UpdateDigitalDownloadableProductOptionsCommand.parse(p),
      execute: (c) => updateDigitalDownloadableProductOptionsService.execute(c as UpdateDigitalDownloadableProductOptionsCommand),
    });

    const updateDigitalDownloadableProductTaxDetailsService = new UpdateDigitalDownloadableProductTaxDetailsService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableProductTaxDetails", {
      parse: (p) => UpdateDigitalDownloadableProductTaxDetailsCommand.parse(p),
      execute: (c) => updateDigitalDownloadableProductTaxDetailsService.execute(c as UpdateDigitalDownloadableProductTaxDetailsCommand),
    });

    const setDigitalDownloadableProductDefaultVariantService = new SetDigitalDownloadableProductDefaultVariantService(unitOfWork);
    this.handlers.set("setDigitalDownloadableProductDefaultVariant", {
      parse: (p) => SetDigitalDownloadableProductDefaultVariantCommand.parse(p),
      execute: (c) => setDigitalDownloadableProductDefaultVariantService.execute(c as SetDigitalDownloadableProductDefaultVariantCommand),
    });

    const updateDigitalDownloadableProductDownloadSettingsService = new UpdateDigitalDownloadableProductDownloadSettingsService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableProductDownloadSettings", {
      parse: (p) => UpdateDigitalDownloadableProductDownloadSettingsCommand.parse(p),
      execute: (c) => updateDigitalDownloadableProductDownloadSettingsService.execute(c as UpdateDigitalDownloadableProductDownloadSettingsCommand),
    });

    // Digital Downloadable Variant commands
    const createDigitalDownloadableVariantService = new CreateDigitalDownloadableVariantService(unitOfWork);
    this.handlers.set("createDigitalDownloadableVariant", {
      parse: (p) => CreateDigitalDownloadableVariantCommand.parse(p),
      execute: (c) => createDigitalDownloadableVariantService.execute(c as CreateDigitalDownloadableVariantCommand),
    });

    const archiveDigitalDownloadableVariantService = new ArchiveDigitalDownloadableVariantService(unitOfWork);
    this.handlers.set("archiveDigitalDownloadableVariant", {
      parse: (p) => ArchiveDigitalDownloadableVariantCommand.parse(p),
      execute: (c) => archiveDigitalDownloadableVariantService.execute(c as ArchiveDigitalDownloadableVariantCommand),
    });

    const publishDigitalDownloadableVariantService = new PublishDigitalDownloadableVariantService(unitOfWork);
    this.handlers.set("publishDigitalDownloadableVariant", {
      parse: (p) => PublishDigitalDownloadableVariantCommand.parse(p),
      execute: (c) => publishDigitalDownloadableVariantService.execute(c as PublishDigitalDownloadableVariantCommand),
    });

    const updateDigitalDownloadableVariantDetailsService = new UpdateDigitalDownloadableVariantDetailsService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableVariantDetails", {
      parse: (p) => UpdateDigitalDownloadableVariantDetailsCommand.parse(p),
      execute: (c) => updateDigitalDownloadableVariantDetailsService.execute(c as UpdateDigitalDownloadableVariantDetailsCommand),
    });

    const updateDigitalDownloadableVariantPriceService = new UpdateDigitalDownloadableVariantPriceService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableVariantPrice", {
      parse: (p) => UpdateDigitalDownloadableVariantPriceCommand.parse(p),
      execute: (c) => updateDigitalDownloadableVariantPriceService.execute(c as UpdateDigitalDownloadableVariantPriceCommand),
    });

    const updateDigitalDownloadableVariantSkuService = new UpdateDigitalDownloadableVariantSkuService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableVariantSku", {
      parse: (p) => UpdateDigitalDownloadableVariantSkuCommand.parse(p),
      execute: (c) => updateDigitalDownloadableVariantSkuService.execute(c as UpdateDigitalDownloadableVariantSkuCommand),
    });

    const addDigitalDownloadableVariantImageService = new AddDigitalDownloadableVariantImageService(unitOfWork, imageUploadHelper!);
    this.handlers.set("addDigitalDownloadableVariantImage", {
      parse: (p) => AddDigitalDownloadableVariantImageCommand.parse(p),
      execute: (c) => addDigitalDownloadableVariantImageService.execute(c as AddDigitalDownloadableVariantImageCommand),
      returnsData: true,
    });

    const removeDigitalDownloadableVariantImageService = new RemoveDigitalDownloadableVariantImageService(unitOfWork);
    this.handlers.set("removeDigitalDownloadableVariantImage", {
      parse: (p) => RemoveDigitalDownloadableVariantImageCommand.parse(p),
      execute: (c) => removeDigitalDownloadableVariantImageService.execute(c as RemoveDigitalDownloadableVariantImageCommand),
    });

    const reorderDigitalDownloadableVariantImagesService = new ReorderDigitalDownloadableVariantImagesService(unitOfWork);
    this.handlers.set("reorderDigitalDownloadableVariantImages", {
      parse: (p) => ReorderDigitalDownloadableVariantImagesCommand.parse(p),
      execute: (c) => reorderDigitalDownloadableVariantImagesService.execute(c as ReorderDigitalDownloadableVariantImagesCommand),
    });

    const updateDigitalDownloadableVariantImageAltTextService = new UpdateDigitalDownloadableVariantImageAltTextService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableVariantImageAltText", {
      parse: (p) => UpdateDigitalDownloadableVariantImageAltTextCommand.parse(p),
      execute: (c) => updateDigitalDownloadableVariantImageAltTextService.execute(c as UpdateDigitalDownloadableVariantImageAltTextCommand),
    });

    const attachDigitalDownloadableVariantDigitalAssetService = new AttachDigitalDownloadableVariantDigitalAssetService(unitOfWork, digitalAssetUploadHelper!);
    this.handlers.set("attachDigitalDownloadableVariantDigitalAsset", {
      parse: (p) => AttachDigitalDownloadableVariantDigitalAssetCommand.parse(p),
      execute: (c) => attachDigitalDownloadableVariantDigitalAssetService.execute(c as AttachDigitalDownloadableVariantDigitalAssetCommand),
    });

    const detachDigitalDownloadableVariantDigitalAssetService = new DetachDigitalDownloadableVariantDigitalAssetService(unitOfWork);
    this.handlers.set("detachDigitalDownloadableVariantDigitalAsset", {
      parse: (p) => DetachDigitalDownloadableVariantDigitalAssetCommand.parse(p),
      execute: (c) => detachDigitalDownloadableVariantDigitalAssetService.execute(c as DetachDigitalDownloadableVariantDigitalAssetCommand),
    });

    const updateDigitalDownloadableVariantDownloadSettingsService = new UpdateDigitalDownloadableVariantDownloadSettingsService(unitOfWork);
    this.handlers.set("updateDigitalDownloadableVariantDownloadSettings", {
      parse: (p) => UpdateDigitalDownloadableVariantDownloadSettingsCommand.parse(p),
      execute: (c) => updateDigitalDownloadableVariantDownloadSettingsService.execute(c as UpdateDigitalDownloadableVariantDownloadSettingsCommand),
    });

    // Dropship Product commands
    const createDropshipProductService = new CreateDropshipProductService(unitOfWork);
    this.handlers.set("createDropshipProduct", {
      parse: (p) => CreateDropshipProductCommand.parse(p),
      execute: (c) => createDropshipProductService.execute(c as CreateDropshipProductCommand),
    });

    const archiveDropshipProductService = new ArchiveDropshipProductService(unitOfWork);
    this.handlers.set("archiveDropshipProduct", {
      parse: (p) => ArchiveDropshipProductCommand.parse(p),
      execute: (c) => archiveDropshipProductService.execute(c as ArchiveDropshipProductCommand),
    });

    const publishDropshipProductService = new PublishDropshipProductService(unitOfWork);
    this.handlers.set("publishDropshipProduct", {
      parse: (p) => PublishDropshipProductCommand.parse(p),
      execute: (c) => publishDropshipProductService.execute(c as PublishDropshipProductCommand),
    });

    const unpublishDropshipProductService = new UnpublishDropshipProductService(unitOfWork);
    this.handlers.set("unpublishDropshipProduct", {
      parse: (p) => UnpublishDropshipProductCommand.parse(p),
      execute: (c) => unpublishDropshipProductService.execute(c as UnpublishDropshipProductCommand),
    });

    const changeDropshipProductSlugService = new ChangeDropshipProductSlugService(unitOfWork);
    this.handlers.set("changeDropshipProductSlug", {
      parse: (p) => ChangeDropshipProductSlugCommand.parse(p),
      execute: (c) => changeDropshipProductSlugService.execute(c as ChangeDropshipProductSlugCommand),
    });

    const updateDropshipProductDetailsService = new UpdateDropshipProductDetailsService(unitOfWork);
    this.handlers.set("updateDropshipProductDetails", {
      parse: (p) => UpdateDropshipProductDetailsCommand.parse(p),
      execute: (c) => updateDropshipProductDetailsService.execute(c as UpdateDropshipProductDetailsCommand),
    });

    const updateDropshipProductMetadataService = new UpdateDropshipProductMetadataService(unitOfWork);
    this.handlers.set("updateDropshipProductMetadata", {
      parse: (p) => UpdateDropshipProductMetadataCommand.parse(p),
      execute: (c) => updateDropshipProductMetadataService.execute(c as UpdateDropshipProductMetadataCommand),
    });

    const updateDropshipProductClassificationService = new UpdateDropshipProductClassificationService(unitOfWork);
    this.handlers.set("updateDropshipProductClassification", {
      parse: (p) => UpdateDropshipProductClassificationCommand.parse(p),
      execute: (c) => updateDropshipProductClassificationService.execute(c as UpdateDropshipProductClassificationCommand),
    });

    const updateDropshipProductTagsService = new UpdateDropshipProductTagsService(unitOfWork);
    this.handlers.set("updateDropshipProductTags", {
      parse: (p) => UpdateDropshipProductTagsCommand.parse(p),
      execute: (c) => updateDropshipProductTagsService.execute(c as UpdateDropshipProductTagsCommand),
    });

    const updateDropshipProductCollectionsService = new UpdateDropshipProductCollectionsService(unitOfWork);
    this.handlers.set("updateDropshipProductCollections", {
      parse: (p) => UpdateDropshipProductCollectionsCommand.parse(p),
      execute: (c) => updateDropshipProductCollectionsService.execute(c as UpdateDropshipProductCollectionsCommand),
    });

    const updateDropshipProductOptionsService = new UpdateDropshipProductOptionsService(unitOfWork);
    this.handlers.set("updateDropshipProductOptions", {
      parse: (p) => UpdateDropshipProductOptionsCommand.parse(p),
      execute: (c) => updateDropshipProductOptionsService.execute(c as UpdateDropshipProductOptionsCommand),
    });

    const updateDropshipProductTaxDetailsService = new UpdateDropshipProductTaxDetailsService(unitOfWork);
    this.handlers.set("updateDropshipProductTaxDetails", {
      parse: (p) => UpdateDropshipProductTaxDetailsCommand.parse(p),
      execute: (c) => updateDropshipProductTaxDetailsService.execute(c as UpdateDropshipProductTaxDetailsCommand),
    });

    const setDropshipProductDefaultVariantService = new SetDropshipProductDefaultVariantService(unitOfWork);
    this.handlers.set("setDropshipProductDefaultVariant", {
      parse: (p) => SetDropshipProductDefaultVariantCommand.parse(p),
      execute: (c) => setDropshipProductDefaultVariantService.execute(c as SetDropshipProductDefaultVariantCommand),
    });

    const updateDropshipProductSafetyBufferService = new UpdateDropshipProductSafetyBufferService(unitOfWork);
    this.handlers.set("updateDropshipProductSafetyBuffer", {
      parse: (p) => UpdateDropshipProductSafetyBufferCommand.parse(p),
      execute: (c) => updateDropshipProductSafetyBufferService.execute(c as UpdateDropshipProductSafetyBufferCommand),
    });

    const updateDropshipProductFulfillmentSettingsService = new UpdateDropshipProductFulfillmentSettingsService(unitOfWork);
    this.handlers.set("updateDropshipProductFulfillmentSettings", {
      parse: (p) => UpdateDropshipProductFulfillmentSettingsCommand.parse(p),
      execute: (c) => updateDropshipProductFulfillmentSettingsService.execute(c as UpdateDropshipProductFulfillmentSettingsCommand),
    });

    // Dropship Variant commands
    const createDropshipVariantService = new CreateDropshipVariantService(unitOfWork);
    this.handlers.set("createDropshipVariant", {
      parse: (p) => CreateDropshipVariantCommand.parse(p),
      execute: (c) => createDropshipVariantService.execute(c as CreateDropshipVariantCommand),
    });

    const archiveDropshipVariantService = new ArchiveDropshipVariantService(unitOfWork);
    this.handlers.set("archiveDropshipVariant", {
      parse: (p) => ArchiveDropshipVariantCommand.parse(p),
      execute: (c) => archiveDropshipVariantService.execute(c as ArchiveDropshipVariantCommand),
    });

    const publishDropshipVariantService = new PublishDropshipVariantService(unitOfWork);
    this.handlers.set("publishDropshipVariant", {
      parse: (p) => PublishDropshipVariantCommand.parse(p),
      execute: (c) => publishDropshipVariantService.execute(c as PublishDropshipVariantCommand),
    });

    const updateDropshipVariantDetailsService = new UpdateDropshipVariantDetailsService(unitOfWork);
    this.handlers.set("updateDropshipVariantDetails", {
      parse: (p) => UpdateDropshipVariantDetailsCommand.parse(p),
      execute: (c) => updateDropshipVariantDetailsService.execute(c as UpdateDropshipVariantDetailsCommand),
    });

    const updateDropshipVariantPriceService = new UpdateDropshipVariantPriceService(unitOfWork);
    this.handlers.set("updateDropshipVariantPrice", {
      parse: (p) => UpdateDropshipVariantPriceCommand.parse(p),
      execute: (c) => updateDropshipVariantPriceService.execute(c as UpdateDropshipVariantPriceCommand),
    });

    const updateDropshipVariantSkuService = new UpdateDropshipVariantSkuService(unitOfWork);
    this.handlers.set("updateDropshipVariantSku", {
      parse: (p) => UpdateDropshipVariantSkuCommand.parse(p),
      execute: (c) => updateDropshipVariantSkuService.execute(c as UpdateDropshipVariantSkuCommand),
    });

    const addDropshipVariantImageService = new AddDropshipVariantImageService(unitOfWork, imageUploadHelper!);
    this.handlers.set("addDropshipVariantImage", {
      parse: (p) => AddDropshipVariantImageCommand.parse(p),
      execute: (c) => addDropshipVariantImageService.execute(c as AddDropshipVariantImageCommand),
      returnsData: true,
    });

    const removeDropshipVariantImageService = new RemoveDropshipVariantImageService(unitOfWork);
    this.handlers.set("removeDropshipVariantImage", {
      parse: (p) => RemoveDropshipVariantImageCommand.parse(p),
      execute: (c) => removeDropshipVariantImageService.execute(c as RemoveDropshipVariantImageCommand),
    });

    const reorderDropshipVariantImagesService = new ReorderDropshipVariantImagesService(unitOfWork);
    this.handlers.set("reorderDropshipVariantImages", {
      parse: (p) => ReorderDropshipVariantImagesCommand.parse(p),
      execute: (c) => reorderDropshipVariantImagesService.execute(c as ReorderDropshipVariantImagesCommand),
    });

    const updateDropshipVariantImageAltTextService = new UpdateDropshipVariantImageAltTextService(unitOfWork);
    this.handlers.set("updateDropshipVariantImageAltText", {
      parse: (p) => UpdateDropshipVariantImageAltTextCommand.parse(p),
      execute: (c) => updateDropshipVariantImageAltTextService.execute(c as UpdateDropshipVariantImageAltTextCommand),
    });

    const updateDropshipVariantInventoryService = new UpdateDropshipVariantInventoryService(unitOfWork);
    this.handlers.set("updateDropshipVariantInventory", {
      parse: (p) => UpdateDropshipVariantInventoryCommand.parse(p),
      execute: (c) => updateDropshipVariantInventoryService.execute(c as UpdateDropshipVariantInventoryCommand),
    });

    const updateDropshipVariantFulfillmentSettingsService = new UpdateDropshipVariantFulfillmentSettingsService(unitOfWork);
    this.handlers.set("updateDropshipVariantFulfillmentSettings", {
      parse: (p) => UpdateDropshipVariantFulfillmentSettingsCommand.parse(p),
      execute: (c) => updateDropshipVariantFulfillmentSettingsService.execute(c as UpdateDropshipVariantFulfillmentSettingsCommand),
    });
  }
}
