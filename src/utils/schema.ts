import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export function zodSchemaToJsonSchema(schema: z.ZodTypeAny): {
  type: "object";
  properties?: Record<string, object>;
  required?: string[];
  additionalProperties?: boolean;
} {
  const jsonSchema = zodToJsonSchema(schema, {
    target: "jsonSchema7",
    $refStrategy: "none",
    effectStrategy: "input",
  }) as Record<string, unknown>;

  // zod-to-json-schema may wrap the schema in a definitions/$schema envelope.
  // Unwrap it so we always return a plain JSON Schema object description.
  const candidate =
    jsonSchema.type === "object" && typeof jsonSchema.properties === "object"
      ? jsonSchema
      : ((jsonSchema.definitions as Record<string, unknown> | undefined)?.[
          Object.keys(jsonSchema.definitions ?? {})[0]
        ] ?? (jsonSchema.properties ? jsonSchema : undefined));

  if (!candidate || typeof candidate !== "object") {
    throw new Error("Failed to convert Zod schema to JSON Schema object");
  }

  const rest = { ...(candidate as Record<string, unknown>) };
  delete rest.$schema;
  delete rest.definitions;
  return rest as {
    type: "object";
    properties?: Record<string, object>;
    required?: string[];
    additionalProperties?: boolean;
  };
}
