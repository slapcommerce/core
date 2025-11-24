import { type AccessLevel } from "./accessLevel";
import { Command } from "./command";

export interface Service<T extends Command> {
  accessLevel: AccessLevel;

  execute(command: T): Promise<void>;
}