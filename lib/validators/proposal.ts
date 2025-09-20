import {z} from "zod";

export const createProposalSchema=z.object({
    requestId:z.string().min(1),
    coverLetter:z.string().trim().min(20).max(6000),
    amount:z.coerce.number().min(1).max(1_000_000),
    currency:z.enum(["INR","USD"]).default("INR").optional(),
    estimatedDays:z.coerce.number().int().min(1).max(120)
});

export const listProposalQuerySchema=z.object({
    requestId:z.string().min(1),
    page:z.coerce.number().int().min(1).default(1).optional(),
    perPage:z.coerce.number().int().min(1).max(100).default(20).optional
});

