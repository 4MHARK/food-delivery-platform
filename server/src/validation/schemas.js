import { z } from "zod";

// ── Auth ──

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  email: z.string().trim().email("A valid email is required").max(254, "Email must be 254 characters or less"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be 72 characters or less"),
  role: z.enum(["CUSTOMER", "OWNER", "RIDER"]),
  phone: z.string().trim().max(20, "Phone must be 20 characters or less").optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

// ── Order checkout ──

export const checkoutSchema = z.object({
  restaurantId: z.coerce.number().int("Restaurant id must be a whole number").positive("Restaurant id must be positive"),
  deliveryAddress: z.string().trim().min(1, "Delivery address is required"),
  idempotencyKey: z.string().trim().min(1, "Idempotency key is required"),
  items: z
    .array(
      z.object({
        menuItemId: z.coerce.number().int("Menu item id must be a whole number").positive("Menu item id must be positive"),
        quantity: z.coerce.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
      })
    )
    .min(1, "Order must have at least one item"),
});
