import { describe, test, expect } from 'bun:test'
import { ImageCollection, type ImageItem } from '../../../src/domain/_base/imageCollection'
import type { ImageUploadResult } from '../../../src/infrastructure/adapters/imageStorageAdapter'

function createMockImageUploadResult(imageId: string): ImageUploadResult {
  return {
    imageId,
    urls: {
      original: { original: `https://example.com/${imageId}/original.jpg`, webp: `https://example.com/${imageId}/original.webp`, avif: `https://example.com/${imageId}/original.avif` },
      thumbnail: { original: `https://example.com/${imageId}/thumbnail.jpg`, webp: `https://example.com/${imageId}/thumbnail.webp`, avif: `https://example.com/${imageId}/thumbnail.avif` },
      small: { original: `https://example.com/${imageId}/small.jpg`, webp: `https://example.com/${imageId}/small.webp`, avif: `https://example.com/${imageId}/small.avif` },
      medium: { original: `https://example.com/${imageId}/medium.jpg`, webp: `https://example.com/${imageId}/medium.webp`, avif: `https://example.com/${imageId}/medium.avif` },
      large: { original: `https://example.com/${imageId}/large.jpg`, webp: `https://example.com/${imageId}/large.webp`, avif: `https://example.com/${imageId}/large.avif` },
    },
  }
}

function createMockImageItem(imageId: string, altText = ''): ImageItem {
  return {
    imageId,
    urls: {
      original: { original: `https://example.com/${imageId}/original.jpg`, webp: `https://example.com/${imageId}/original.webp`, avif: `https://example.com/${imageId}/original.avif` },
      thumbnail: { original: `https://example.com/${imageId}/thumbnail.jpg`, webp: `https://example.com/${imageId}/thumbnail.webp`, avif: `https://example.com/${imageId}/thumbnail.avif` },
      small: { original: `https://example.com/${imageId}/small.jpg`, webp: `https://example.com/${imageId}/small.webp`, avif: `https://example.com/${imageId}/small.avif` },
      medium: { original: `https://example.com/${imageId}/medium.jpg`, webp: `https://example.com/${imageId}/medium.webp`, avif: `https://example.com/${imageId}/medium.avif` },
      large: { original: `https://example.com/${imageId}/large.jpg`, webp: `https://example.com/${imageId}/large.webp`, avif: `https://example.com/${imageId}/large.avif` },
    },
    uploadedAt: new Date(),
    altText,
  }
}

describe('ImageCollection', () => {
  describe('empty', () => {
    test('should create an empty image collection', () => {
      // Arrange & Act
      const collection = ImageCollection.empty()

      // Assert
      expect(collection.isEmpty()).toBe(true)
      expect(collection.count()).toBe(0)
      expect(collection.toArray()).toHaveLength(0)
      expect(collection.getPrimaryImage()).toBeNull()
    })
  })

  describe('fromArray', () => {
    test('should create collection from array of images', () => {
      // Arrange
      const images = [
        createMockImageItem('img-1', 'First image'),
        createMockImageItem('img-2', 'Second image'),
        createMockImageItem('img-3', 'Third image'),
      ]

      // Act
      const collection = ImageCollection.fromArray(images)

      // Assert
      expect(collection.isEmpty()).toBe(false)
      expect(collection.count()).toBe(3)
      expect(collection.toArray()).toHaveLength(3)
      expect(collection.getPrimaryImage()?.imageId).toBe('img-1')
    })

    test('should throw error when exceeding absolute maximum', () => {
      // Arrange
      const images: ImageItem[] = []
      for (let i = 0; i < 101; i++) {
        images.push(createMockImageItem(`img-${i}`))
      }

      // Act & Assert
      expect(() => ImageCollection.fromArray(images)).toThrow('Cannot exceed 100 images')
    })

    test('should create collection at exactly maximum', () => {
      // Arrange
      const images: ImageItem[] = []
      for (let i = 0; i < 100; i++) {
        images.push(createMockImageItem(`img-${i}`))
      }

      // Act
      const collection = ImageCollection.fromArray(images)

      // Assert
      expect(collection.count()).toBe(100)
      expect(collection.isAtMaximum()).toBe(true)
    })
  })

  describe('fromJSON', () => {
    test('should create collection from JSON array', () => {
      // Arrange
      const json = [
        {
          imageId: 'img-1',
          urls: {
            thumbnail: { original: 'https://example.com/img-1/thumbnail.jpg', webp: null },
            small: { original: 'https://example.com/img-1/small.jpg', webp: null },
            medium: { original: 'https://example.com/img-1/medium.jpg', webp: null },
            large: { original: 'https://example.com/img-1/large.jpg', webp: null },
          },
          uploadedAt: '2024-01-01T00:00:00.000Z',
          altText: 'Test image',
        },
      ]

      // Act
      const collection = ImageCollection.fromJSON(json)

      // Assert
      expect(collection.count()).toBe(1)
      expect(collection.getPrimaryImage()?.imageId).toBe('img-1')
      expect(collection.getPrimaryImage()?.altText).toBe('Test image')
      expect(collection.getPrimaryImage()?.uploadedAt).toBeInstanceOf(Date)
    })

    test('should create empty collection from invalid JSON', () => {
      // Arrange & Act
      const collection = ImageCollection.fromJSON(null)

      // Assert
      expect(collection.isEmpty()).toBe(true)
    })

    test('should create empty collection from non-array JSON', () => {
      // Arrange & Act
      const collection = ImageCollection.fromJSON({ foo: 'bar' })

      // Assert
      expect(collection.isEmpty()).toBe(true)
    })

    test('should handle missing altText in JSON', () => {
      // Arrange
      const json = [
        {
          imageId: 'img-1',
          urls: {
            thumbnail: { original: 'https://example.com/img-1/thumbnail.jpg', webp: null },
            small: { original: 'https://example.com/img-1/small.jpg', webp: null },
            medium: { original: 'https://example.com/img-1/medium.jpg', webp: null },
            large: { original: 'https://example.com/img-1/large.jpg', webp: null },
          },
          uploadedAt: '2024-01-01T00:00:00.000Z',
        },
      ]

      // Act
      const collection = ImageCollection.fromJSON(json)

      // Assert
      expect(collection.getPrimaryImage()?.altText).toBe('')
    })
  })

  describe('addImage', () => {
    test('should add image to empty collection', () => {
      // Arrange
      const collection = ImageCollection.empty()
      const uploadResult = createMockImageUploadResult('img-1')

      // Act
      const updated = collection.addImage(uploadResult, 'New image')

      // Assert
      expect(updated.count()).toBe(1)
      expect(updated.getPrimaryImage()?.imageId).toBe('img-1')
      expect(updated.getPrimaryImage()?.altText).toBe('New image')
    })

    test('should add image to existing collection', () => {
      // Arrange
      const images = [createMockImageItem('img-1')]
      const collection = ImageCollection.fromArray(images)
      const uploadResult = createMockImageUploadResult('img-2')

      // Act
      const updated = collection.addImage(uploadResult, 'Second image')

      // Assert
      expect(updated.count()).toBe(2)
      expect(updated.toArray()[0]?.imageId).toBe('img-1')
      expect(updated.toArray()[1]?.imageId).toBe('img-2')
      expect(updated.toArray()[1]?.altText).toBe('Second image')
    })

    test('should default to empty altText if not provided', () => {
      // Arrange
      const collection = ImageCollection.empty()
      const uploadResult = createMockImageUploadResult('img-1')

      // Act
      const updated = collection.addImage(uploadResult, '')

      // Assert
      expect(updated.getPrimaryImage()?.altText).toBe('')
    })

    test('should throw error when adding to collection at maximum', () => {
      // Arrange
      const images: ImageItem[] = []
      for (let i = 0; i < 100; i++) {
        images.push(createMockImageItem(`img-${i}`))
      }
      const collection = ImageCollection.fromArray(images)
      const uploadResult = createMockImageUploadResult('img-101')

      // Act & Assert
      expect(() => collection.addImage(uploadResult, 'Too many')).toThrow('Cannot exceed 100 images')
    })

    test('should not mutate original collection', () => {
      // Arrange
      const collection = ImageCollection.empty()
      const uploadResult = createMockImageUploadResult('img-1')

      // Act
      const updated = collection.addImage(uploadResult, 'New image')

      // Assert
      expect(collection.count()).toBe(0)
      expect(updated.count()).toBe(1)
    })
  })

  describe('removeImage', () => {
    test('should remove image from collection', () => {
      // Arrange
      const images = [
        createMockImageItem('img-1'),
        createMockImageItem('img-2'),
        createMockImageItem('img-3'),
      ]
      const collection = ImageCollection.fromArray(images)

      // Act
      const updated = collection.removeImage('img-2')

      // Assert
      expect(updated.count()).toBe(2)
      expect(updated.toArray()[0]?.imageId).toBe('img-1')
      expect(updated.toArray()[1]?.imageId).toBe('img-3')
    })

    test('should remove primary image and promote second image', () => {
      // Arrange
      const images = [
        createMockImageItem('img-1'),
        createMockImageItem('img-2'),
      ]
      const collection = ImageCollection.fromArray(images)

      // Act
      const updated = collection.removeImage('img-1')

      // Assert
      expect(updated.count()).toBe(1)
      expect(updated.getPrimaryImage()?.imageId).toBe('img-2')
    })

    test('should throw error when removing non-existent image', () => {
      // Arrange
      const images = [createMockImageItem('img-1')]
      const collection = ImageCollection.fromArray(images)

      // Act & Assert
      expect(() => collection.removeImage('img-999')).toThrow('Image with id img-999 not found')
    })

    test('should not mutate original collection', () => {
      // Arrange
      const images = [createMockImageItem('img-1'), createMockImageItem('img-2')]
      const collection = ImageCollection.fromArray(images)

      // Act
      const updated = collection.removeImage('img-1')

      // Assert
      expect(collection.count()).toBe(2)
      expect(updated.count()).toBe(1)
    })
  })

  describe('reorder', () => {
    test('should reorder images', () => {
      // Arrange
      const images = [
        createMockImageItem('img-1'),
        createMockImageItem('img-2'),
        createMockImageItem('img-3'),
      ]
      const collection = ImageCollection.fromArray(images)

      // Act
      const updated = collection.reorder(['img-3', 'img-1', 'img-2'])

      // Assert
      expect(updated.toArray()[0]?.imageId).toBe('img-3')
      expect(updated.toArray()[1]?.imageId).toBe('img-1')
      expect(updated.toArray()[2]?.imageId).toBe('img-2')
      expect(updated.getPrimaryImage()?.imageId).toBe('img-3')
    })

    test('should throw error when ordered IDs count mismatch', () => {
      // Arrange
      const images = [createMockImageItem('img-1'), createMockImageItem('img-2')]
      const collection = ImageCollection.fromArray(images)

      // Act & Assert
      expect(() => collection.reorder(['img-1'])).toThrow('All image IDs must be present in reorder operation')
    })

    test('should throw error when ordered ID not found', () => {
      // Arrange
      const images = [createMockImageItem('img-1'), createMockImageItem('img-2')]
      const collection = ImageCollection.fromArray(images)

      // Act & Assert
      expect(() => collection.reorder(['img-1', 'img-999'])).toThrow('Image with id img-999 not found in collection')
    })

    test('should not mutate original collection', () => {
      // Arrange
      const images = [createMockImageItem('img-1'), createMockImageItem('img-2')]
      const collection = ImageCollection.fromArray(images)

      // Act
      const updated = collection.reorder(['img-2', 'img-1'])

      // Assert
      expect(collection.getPrimaryImage()?.imageId).toBe('img-1')
      expect(updated.getPrimaryImage()?.imageId).toBe('img-2')
    })
  })

  describe('updateAltText', () => {
    test('should update altText for image', () => {
      // Arrange
      const images = [createMockImageItem('img-1', 'Old text')]
      const collection = ImageCollection.fromArray(images)

      // Act
      const updated = collection.updateAltText('img-1', 'New text')

      // Assert
      expect(updated.getPrimaryImage()?.altText).toBe('New text')
    })

    test('should update altText for non-primary image', () => {
      // Arrange
      const images = [
        createMockImageItem('img-1', 'First'),
        createMockImageItem('img-2', 'Second'),
      ]
      const collection = ImageCollection.fromArray(images)

      // Act
      const updated = collection.updateAltText('img-2', 'Updated second')

      // Assert
      expect(updated.toArray()[0]?.altText).toBe('First')
      expect(updated.toArray()[1]?.altText).toBe('Updated second')
    })

    test('should throw error when updating non-existent image', () => {
      // Arrange
      const images = [createMockImageItem('img-1')]
      const collection = ImageCollection.fromArray(images)

      // Act & Assert
      expect(() => collection.updateAltText('img-999', 'New text')).toThrow('Image with id img-999 not found')
    })

    test('should not mutate original collection', () => {
      // Arrange
      const images = [createMockImageItem('img-1', 'Old text')]
      const collection = ImageCollection.fromArray(images)

      // Act
      const updated = collection.updateAltText('img-1', 'New text')

      // Assert
      expect(collection.getPrimaryImage()?.altText).toBe('Old text')
      expect(updated.getPrimaryImage()?.altText).toBe('New text')
    })
  })

  describe('getPrimaryImage', () => {
    test('should return first image as primary', () => {
      // Arrange
      const images = [
        createMockImageItem('img-1'),
        createMockImageItem('img-2'),
      ]
      const collection = ImageCollection.fromArray(images)

      // Act
      const primary = collection.getPrimaryImage()

      // Assert
      expect(primary?.imageId).toBe('img-1')
    })

    test('should return null for empty collection', () => {
      // Arrange
      const collection = ImageCollection.empty()

      // Act
      const primary = collection.getPrimaryImage()

      // Assert
      expect(primary).toBeNull()
    })
  })

  describe('count', () => {
    test('should return correct count', () => {
      // Arrange
      const images = [
        createMockImageItem('img-1'),
        createMockImageItem('img-2'),
        createMockImageItem('img-3'),
      ]
      const collection = ImageCollection.fromArray(images)

      // Act & Assert
      expect(collection.count()).toBe(3)
    })

    test('should return 0 for empty collection', () => {
      // Arrange
      const collection = ImageCollection.empty()

      // Act & Assert
      expect(collection.count()).toBe(0)
    })
  })

  describe('isEmpty', () => {
    test('should return true for empty collection', () => {
      // Arrange
      const collection = ImageCollection.empty()

      // Act & Assert
      expect(collection.isEmpty()).toBe(true)
    })

    test('should return false for non-empty collection', () => {
      // Arrange
      const images = [createMockImageItem('img-1')]
      const collection = ImageCollection.fromArray(images)

      // Act & Assert
      expect(collection.isEmpty()).toBe(false)
    })
  })

  describe('isApproachingLimit', () => {
    test('should return false when below recommended limit', () => {
      // Arrange
      const images: ImageItem[] = []
      for (let i = 0; i < 9; i++) {
        images.push(createMockImageItem(`img-${i}`))
      }
      const collection = ImageCollection.fromArray(images)

      // Act & Assert
      expect(collection.isApproachingLimit()).toBe(false)
    })

    test('should return true when at recommended limit', () => {
      // Arrange
      const images: ImageItem[] = []
      for (let i = 0; i < 10; i++) {
        images.push(createMockImageItem(`img-${i}`))
      }
      const collection = ImageCollection.fromArray(images)

      // Act & Assert
      expect(collection.isApproachingLimit()).toBe(true)
    })

    test('should return true when above recommended limit', () => {
      // Arrange
      const images: ImageItem[] = []
      for (let i = 0; i < 15; i++) {
        images.push(createMockImageItem(`img-${i}`))
      }
      const collection = ImageCollection.fromArray(images)

      // Act & Assert
      expect(collection.isApproachingLimit()).toBe(true)
    })
  })

  describe('isAtMaximum', () => {
    test('should return false when below maximum', () => {
      // Arrange
      const images: ImageItem[] = []
      for (let i = 0; i < 99; i++) {
        images.push(createMockImageItem(`img-${i}`))
      }
      const collection = ImageCollection.fromArray(images)

      // Act & Assert
      expect(collection.isAtMaximum()).toBe(false)
    })

    test('should return true when at maximum', () => {
      // Arrange
      const images: ImageItem[] = []
      for (let i = 0; i < 100; i++) {
        images.push(createMockImageItem(`img-${i}`))
      }
      const collection = ImageCollection.fromArray(images)

      // Act & Assert
      expect(collection.isAtMaximum()).toBe(true)
    })
  })

  describe('toArray', () => {
    test('should return readonly array of images', () => {
      // Arrange
      const images = [
        createMockImageItem('img-1'),
        createMockImageItem('img-2'),
      ]
      const collection = ImageCollection.fromArray(images)

      // Act
      const array = collection.toArray()

      // Assert
      expect(array).toHaveLength(2)
      expect(array[0]?.imageId).toBe('img-1')
      expect(array[1]?.imageId).toBe('img-2')
    })
  })

  describe('toJSON', () => {
    test('should serialize to JSON array', () => {
      // Arrange
      const images = [
        createMockImageItem('img-1', 'First image'),
        createMockImageItem('img-2', 'Second image'),
      ]
      const collection = ImageCollection.fromArray(images)

      // Act
      const json = collection.toJSON()

      // Assert
      expect(json).toHaveLength(2)
      expect(json[0]?.imageId).toBe('img-1')
      expect(json[0]?.altText).toBe('First image')
      expect(json[0]?.uploadedAt).toBeTypeOf('string')
      expect(json[1]?.imageId).toBe('img-2')
      expect(json[1]?.altText).toBe('Second image')
    })

    test('should serialize empty collection', () => {
      // Arrange
      const collection = ImageCollection.empty()

      // Act
      const json = collection.toJSON()

      // Assert
      expect(json).toHaveLength(0)
      expect(Array.isArray(json)).toBe(true)
    })

    test('should round-trip through JSON', () => {
      // Arrange
      const images = [createMockImageItem('img-1', 'Test image')]
      const collection = ImageCollection.fromArray(images)

      // Act
      const json = collection.toJSON()
      const restored = ImageCollection.fromJSON(json)

      // Assert
      expect(restored.count()).toBe(1)
      expect(restored.getPrimaryImage()?.imageId).toBe('img-1')
      expect(restored.getPrimaryImage()?.altText).toBe('Test image')
    })
  })

  describe('immutability', () => {
    test('should not mutate original when operations performed', () => {
      // Arrange
      const images = [createMockImageItem('img-1')]
      const collection = ImageCollection.fromArray(images)

      // Act
      const uploadResult = createMockImageUploadResult('img-2')
      const withAdded = collection.addImage(uploadResult, 'New image')
      const withRemoved = withAdded.removeImage('img-1')
      const withUpdated = withAdded.updateAltText('img-1', 'Updated')

      // Assert - original collection unchanged
      expect(collection.count()).toBe(1)
      expect(withAdded.count()).toBe(2)
      expect(withRemoved.count()).toBe(1)
      expect(withUpdated.getPrimaryImage()?.altText).toBe('Updated')
      expect(collection.getPrimaryImage()?.altText).toBe('')
    })
  })
})
