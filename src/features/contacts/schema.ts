import { z } from "zod";
import { ContactRole } from "@prisma/client";
import { optionalText, shortText } from "@/lib/validation";

/**
 * Zod schemas for Contact writes. Contacts are always scoped to a client
 * (the client id comes from the route path, not the body).
 */
export const createContactSchema = z.object({
  name: shortText(200),
  email: z.string().trim().toLowerCase().email("email must be valid").max(320),
  phone: optionalText(50),
  role: z.nativeEnum(ContactRole).default(ContactRole.other),
  isPrimary: z.boolean().default(false),
});

export const updateContactSchema = createContactSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" },
);

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
