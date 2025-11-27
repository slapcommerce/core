import { describe, test, expect } from "bun:test"
import { ScheduleReadModel } from "../../../../../../src/api/app/schedule/queries/admin/views"

describe("ScheduleReadModel", () => {
  test("can be instantiated", () => {
    const model = new ScheduleReadModel()
    expect(model).toBeInstanceOf(ScheduleReadModel)
  })
})
