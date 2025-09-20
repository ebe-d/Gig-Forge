import {z} from 'zod';

const MAX_TAGS=10;
const MAX_ATTACHMENTS=5;

export const createRequestSchema=z.object({
    title: z.string().trim().min(10).max(140),
    description:z.string().trim().min(30).max(800),
    budgetMin:z.coerce.number().min(0).optional(),
    budgetMax:z.coerce.number().min(0).optional(),
    currency:z.enum(['INR','USD']).default('INR').optional(),
    deadline: z
    .union([z.string().datetime({ offset: true }), z.coerce.date()])
    .optional()
    .nullable(),
    tags: z
    .array(z.string().trim().toLowerCase().min(2).max(20))
    .max(MAX_TAGS)
    .default([])
    .optional(),
    category: z.string().trim().min(2).max(50).optional().nullable(),
    attachments: z.array(z.string().url()).max(MAX_ATTACHMENTS).default([]).optional(),
    }).refine((d)=>d.budgetMin==null || d.budgetMax==null || 
    (typeof d.budgetMin === "number" && typeof d.budgetMax === "number" && d.budgetMin <= d.budgetMax),
    { message: "budgetMin should be <= budgetMax",path:["budgetMin"]} )
    .refine(
    (d) =>
    !d.deadline ||
    (d.deadline instanceof Date
    ? d.deadline.getTime() > Date.now()
    : new Date(d.deadline).getTime() > Date.now()),
    { message: "deadline must be in the future", path: ["deadline"] }
    );

    export const listRequestsQuerySchema = z.object({
    q: z.string().trim().max(140).optional(),
    tags:z.string().optional().transform((val)=>parseTagsCSV(val)), //seperate with commas while giving input
    category: z.string().max(50).optional(),
    status: z.enum(["OPEN", "ASSIGNED", "CLOSED", "CANCELLED"]).optional(),
    clientId: z.string().optional(),
    budgetMin: z.coerce.number().min(0).optional(),
    budgetMax: z.coerce.number().min(0).optional(),
    dueAfter: z.string().datetime({ offset: true }).optional(),
    dueBefore: z.string().datetime({ offset: true }).optional(),
    mine: z.enum(["true", "false"]).optional(),
    sort: z.enum(["new", "budget_asc", "budget_desc"]).default("new").optional(),
    page: z.coerce.number().int().min(1).default(1).optional(),
    perPage: z.coerce.number().int().min(1).max(50).default(12).optional(),
    });

    export function parseTagsCSV(csv?:string){
        if(!csv) return [];
        return csv
        .split(",")
        .map((t)=>t.trim().toLowerCase())
        .filter((t)=>t.length>=2 && t.length<=20)
        .slice(0,MAX_TAGS)
    }
