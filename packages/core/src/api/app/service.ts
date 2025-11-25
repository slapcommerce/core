import { Command } from "./command";

export interface Service<T extends Command> {
  execute(command: T): Promise<void>;
}