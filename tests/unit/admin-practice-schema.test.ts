import { describe, expect, it } from "vitest";
import { getTable } from "../../src/lib/admin/schema";

describe("practice library admin schema", () => {
  for (const name of ["practice_papers", "practice_passages", "practice_questions"]) {
    it(`${name} supports edit, soft delete and restore`, () => {
      const table = getTable(name);
      expect(table).not.toBeNull();
      expect(table?.editable).toBe(true);
      expect(table?.deletable).toBe(true);
      expect(table?.softDelete).toBe(true);
      expect(table?.columns.some((column) => column.name === "deleted_at")).toBe(true);
    });
  }
});
