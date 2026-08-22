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

// ── Checkout ──

const orderItems = z
  .array(
    z.object({
      menuItemId: z.coerce.number().int("Menu item id must be a whole number").positive("Menu item id must be positive"),
      quantity: z.coerce.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
    })
  )
  .min(1, "Order must have at least one item");

export const checkoutSchema = z.object({
  restaurantId: z.coerce.number().int("Restaurant id must be a whole number").positive("Restaurant id must be positive"),
  deliveryAddress: z.string().trim().min(1, "Delivery address is required"),
  idempotencyKey: z.string().trim().min(1, "Idempotency key is required"),
  items: orderItems,
});

export const estimateSchema = z.object({
  restaurantId: z.coerce.number().int("Restaurant id must be a whole number").positive("Restaurant id must be positive"),
  items: orderItems,
});

// ── Restaurant ──

export const restaurantSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().trim().max(1000, "Description must be 1000 characters or less").optional(),
  address: z.string().trim().min(1, "Address is required").max(200, "Address must be 200 characters or less"),
  phone: z.string().trim().min(1, "Phone is required").max(20, "Phone must be 20 characters or less"),
  imageUrl: z.string().trim().max(500, "Image URL must be 500 characters or less").optional(),
});

// ── Menu item ──

export const menuItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().trim().max(1000, "Description must be 1000 characters or less").optional(),
  price: z.coerce.number().positive("Price must be a positive number"),
  category: z.string().trim().min(1, "Category is required").max(50, "Category must be 50 characters or less"),
  imageUrl: z.string().trim().max(500, "Image URL must be 500 characters or less").optional(),
});

// ── Rider ──

const emptyToUndefined = (v) => (v === "" ? undefined : v);

const phoneDigits = z
  .string()
  .trim()
  .refine(
    (v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    },
    "Phone number must be 10-15 digits"
  );

const licensePlateField = z.preprocess(
  emptyToUndefined,
  z.string().regex(/^[A-Za-z0-9\s]{2,15}$/, "License plate must be 2-15 alphanumeric characters").optional()
);

const licenseNumberField = z.preprocess(
  emptyToUndefined,
  z.string().regex(/^[A-Za-z0-9][-A-Za-z0-9]{4,20}$/, "License number must be 5-20 characters (letters, numbers, hyphens)").optional()
);

const matricNumberField = z.preprocess(
  emptyToUndefined,
  z.string().regex(/^[A-Za-z0-9/-]{5,20}$/, "Matric number must be 5-20 alphanumeric characters").optional()
);

export const riderRegisterSchema = z
  .object({
    vehicleType: z.string().trim().min(1, "vehicleType is required"),
    phone: phoneDigits,
    licensePlate: licensePlateField,
    licenseNumber: licenseNumberField,
    matricNumber: matricNumberField,
  })
  .superRefine((data, ctx) => {
    const hasLicense = Boolean(data.licensePlate || data.licenseNumber);
    const hasMatric = Boolean(data.matricNumber);

    if (!hasLicense && !hasMatric) {
      ctx.addIssue({ code: "custom", message: "Provide either a driver's license (plate + number) or a matriculation number" });
    } else if (hasLicense && hasMatric) {
      ctx.addIssue({ code: "custom", message: "Provide either a driver's license OR a matriculation number, not both" });
    } else if (hasLicense && (!data.licensePlate || !data.licenseNumber)) {
      ctx.addIssue({ code: "custom", message: "Both license plate and license number are required for license registration" });
    }
  });

export const riderUpdateSchema = z.object({
  vehicleType: z.string().trim().min(1, "vehicleType is required").optional(),
  licensePlate: licensePlateField,
  licenseNumber: licenseNumberField,
  matricNumber: matricNumberField,
  phone: phoneDigits.optional(),
  isAvailable: z.boolean().optional(),
});

// ── Delivery ──

export const deliveryStatusSchema = z.object({
  status: z.enum(["ZILLA_ON_IT", "AT_KITCHEN", "BAGGED", "MOVING", "CLOSE_BY", "DELIVERED", "FAILED"]),
  reason: z.string().trim().max(500, "Reason must be 500 characters or less").optional(),
});

// ── Password reset ──

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("A valid email is required"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be 72 characters or less"),
});

// ── Reviews ──

export const reviewSchema = z.object({
  rating: z.coerce.number().int("Rating must be a whole number").min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  comment: z.string().trim().max(500, "Comment must be 500 characters or less").optional(),
});

// ── Admin ──

export const adminRegisterSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  email: z.string().trim().email("A valid email is required").max(254, "Email must be 254 characters or less"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be 72 characters or less"),
  inviteCode: z.string().min(1, "Invite code is required"),
});
