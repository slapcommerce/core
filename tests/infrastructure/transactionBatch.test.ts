import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { TransactionBatch } from '../../src/infrastructure/transactionBatch'
import type { QueuedCommand } from '../../src/infrastructure/transactionBatch'

describe('TransactionBatch', () => {
  test('constructor generates UUID for id', () => {
    // Act
    const batch = new TransactionBatch()

    // Assert
    expect(batch.id).toBeDefined()
    expect(typeof batch.id).toBe('string')
    // UUID format: 8-4-4-4-12 hex characters
    expect(batch.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test('constructor sets enqueuedAt timestamp', () => {
    // Arrange
    const beforeTime = Date.now()

    // Act
    const batch = new TransactionBatch()
    const afterTime = Date.now()

    // Assert
    expect(batch.enqueuedAt).toBeGreaterThanOrEqual(beforeTime)
    expect(batch.enqueuedAt).toBeLessThanOrEqual(afterTime)
  })

  test('constructor initializes empty commands array', () => {
    // Act
    const batch = new TransactionBatch()

    // Assert
    expect(batch.commands).toBeDefined()
    expect(Array.isArray(batch.commands)).toBe(true)
    expect(batch.commands.length).toBe(0)
  })

  test('constructor creates a promise', () => {
    // Act
    const batch = new TransactionBatch()

    // Assert
    expect(batch.promise).toBeDefined()
    expect(batch.promise).toBeInstanceOf(Promise)
  })

  test('addCommand adds command to commands array', () => {
    // Arrange
    const batch = new TransactionBatch()
    const db = new Database(':memory:')
    const statement = db.query('SELECT 1')
    const command: QueuedCommand = {
      statement,
      params: ['param1', 'param2'],
      type: 'insert',
    }

    // Act
    batch.addCommand(command)

    // Assert
    expect(batch.commands.length).toBe(1)
    expect(batch.commands[0]).toBe(command)
    db.close()
  })

  test('addCommand can add multiple commands', () => {
    // Arrange
    const batch = new TransactionBatch()
    const db = new Database(':memory:')
    const statement1 = db.query('SELECT 1')
    const statement2 = db.query('SELECT 2')
    const command1: QueuedCommand = {
      statement: statement1,
      params: ['param1'],
      type: 'insert',
    }
    const command2: QueuedCommand = {
      statement: statement2,
      params: ['param2'],
      type: 'update',
    }

    // Act
    batch.addCommand(command1)
    batch.addCommand(command2)

    // Assert
    expect(batch.commands.length).toBe(2)
    expect(batch.commands[0]).toBe(command1)
    expect(batch.commands[1]).toBe(command2)
    db.close()
  })

  test('resolve resolves the promise', async () => {
    // Arrange
    const batch = new TransactionBatch()
    let resolved = false

    // Act
    const promise = batch.promise.then(() => {
      resolved = true
    })
    batch.resolve()
    await promise

    // Assert
    expect(resolved).toBe(true)
  })

  test('reject rejects the promise with error', async () => {
    // Arrange
    const batch = new TransactionBatch()
    const error = new Error('Test error')
    let rejected = false
    let caughtError: Error | null = null

    // Act
    const promise = batch.promise.catch((err) => {
      rejected = true
      caughtError = err
    })
    batch.reject(error)
    
    try {
      await promise
    } catch (err) {
      // Expected to throw
    }

    // Assert
    expect(rejected).toBe(true)
    expect(caughtError).toBe(error)
  })

  test('resolve can be called multiple times without error', async () => {
    // Arrange
    const batch = new TransactionBatch()
    let resolveCount = 0

    // Act
    const promise = batch.promise.then(() => {
      resolveCount++
    })
    batch.resolve()
    batch.resolve() // Call again
    await promise

    // Assert - Should only resolve once
    expect(resolveCount).toBe(1)
  })

  test('reject can be called multiple times without error', async () => {
    // Arrange
    const batch = new TransactionBatch()
    const error1 = new Error('Error 1')
    const error2 = new Error('Error 2')
    let rejectCount = 0

    // Act
    const promise = batch.promise.catch((err) => {
      rejectCount++
      return err
    })
    batch.reject(error1)
    batch.reject(error2) // Call again
    
    try {
      await promise
    } catch (err) {
      // Expected to throw
    }

    // Assert - Should only reject once with first error
    expect(rejectCount).toBe(1)
  })

  test('commands array maintains order of added commands', () => {
    // Arrange
    const batch = new TransactionBatch()
    const db = new Database(':memory:')
    const commands: QueuedCommand[] = [
      { statement: db.query('SELECT 1'), params: [], type: 'insert' },
      { statement: db.query('SELECT 2'), params: [], type: 'update' },
      { statement: db.query('SELECT 3'), params: [], type: 'delete' },
      { statement: db.query('SELECT 4'), params: [], type: 'select' },
    ]

    // Act
    for (const command of commands) {
      batch.addCommand(command)
    }

    // Assert
    expect(batch.commands.length).toBe(4)
    expect(batch.commands[0]!.type).toBe('insert')
    expect(batch.commands[1]!.type).toBe('update')
    expect(batch.commands[2]!.type).toBe('delete')
    expect(batch.commands[3]!.type).toBe('select')
    db.close()
  })
})

