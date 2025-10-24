import { CreateProductService } from "../../app/product/createProduct";
import { ArchiveProductService } from "../../app/product/archiveProduct";
import {
  CreateProductCommand,
  ArchiveProductCommand,
} from "../../app/product/commands";
import { UnitOfWork } from "../../infrastructure/unitOfWork";
import { EventRepository } from "../../infrastructure/repositories";
import { tryCatch } from "../response";

export const createProduct = async (command: CreateProductCommand) => {
  const eventMapper = new DomainEventMapper();
  const unitOfWork = new UnitOfWork(db, EventRepository, OutboxRepository);
  const createProductService = new CreateProductService(
    unitOfWork,
    eventMapper
  );
  return await tryCatch(
    async () => await createProductService.execute(command)
  );
};
