import { z } from "zod"

export const updateCustomerContactDataSchema = z.object({
  imieINazwisko: z
    .string()
    .trim()
    .min(2, "Imię i nazwisko musi mieć co najmniej 2 znaki"),
  email: z
    .string()
    .trim()
    .email("Niepoprawny format adresu e-mail")
    .optional()
    .or(z.literal("")),
  telefon: z
    .string()
    .trim()
    .optional()
    .or(z.literal("")),
})

export type UpdateCustomerContactDataInput = z.infer<typeof updateCustomerContactDataSchema>
