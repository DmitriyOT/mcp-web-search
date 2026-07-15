import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { z } from "zod";

import { zodSchemaToJsonSchema } from "../src/utils/schema.js";

describe("zodSchemaToJsonSchema", () => {
  it("converts a Zod object schema to JSON Schema", () => {
    const schema = z.object({
      query: z.string().min(1).describe("Search query"),
      limit: z.number().int().optional().default(10),
      provider: z.enum(["a", "b"]).optional().default("a"),
    });

    const jsonSchema = zodSchemaToJsonSchema(schema);
    assert.equal(jsonSchema.type, "object");
    assert.deepEqual(jsonSchema.required, ["query"]);
    assert.ok(jsonSchema.properties);
    assert.equal(jsonSchema.properties!.query.description, "Search query");
    assert.equal(jsonSchema.properties!.limit.type, "integer");
    assert.deepEqual(jsonSchema.properties!.provider.enum, ["a", "b"]);
  });

  it("throws for non-object schemas", () => {
    assert.throws(() => zodSchemaToJsonSchema(z.string()), /Failed to convert Zod schema/);
  });
});
