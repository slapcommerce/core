import { describe, test, expect } from "bun:test"
import { CollectionReadModel, SlugRedirectReadModel } from "../../../../../../src/api/app/collection/queries/admin/views"

describe("CollectionReadModel", () => {
  test("can be instantiated", () => {
    const model = new CollectionReadModel()
    expect(model).toBeInstanceOf(CollectionReadModel)
  })
})

describe("SlugRedirectReadModel", () => {
  test("can be instantiated", () => {
    const model = new SlugRedirectReadModel()
    expect(model).toBeInstanceOf(SlugRedirectReadModel)
  })
})
