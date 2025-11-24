import type { Statement } from 'bun:sqlite'

export interface QueuedCommand {
  statement: Statement
  params: any[]
  type: 'insert' | 'update' | 'delete' | 'select'
}

export class TransactionBatch {
  public readonly id: string
  public readonly commands: QueuedCommand[] = []
  public readonly enqueuedAt: number
  private resolvePromise!: () => void
  private rejectPromise!: (error: Error) => void
  public readonly promise: Promise<void>

  constructor() {
    this.id = crypto.randomUUID()
    this.enqueuedAt = Date.now()

    this.promise = new Promise<void>((resolve, reject) => {
      this.resolvePromise = resolve
      this.rejectPromise = reject
    })
  }

  addCommand(command: QueuedCommand): void {
    this.commands.push(command)
  }

  resolve(): void {
    this.resolvePromise()
  }

  reject(error: Error): void {
    this.rejectPromise(error)
  }
}
