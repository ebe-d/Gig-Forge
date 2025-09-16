import {z} from 'zod';

const MAX_TAGS=10;
const MAX_IMAGES=10;

export const createGigSchema=z.object({
    title:z.string().trim().min(10).max(120),
    description:z.string().trim().min(30).max(5000),
    price:z.coerce.number().min(5).max(1000000),
    currency:z.enum(["INR","USD"]).default("INR").optional(),
    deliveryDays:z.coerce.number().int().min(0).max(15).default(1),
    tags:z
    .array(z.string().trim().toLowerCase().min(2).max(20))
    .max(MAX_TAGS)
    .default([])
    .optional(),
    category:z.string().trim().min(2).max(50).nullable().optional(),
    images:z.array(z.string().url()).max(MAX_IMAGES).default([]).optional(),
    thumbnailUrl:z.string().url().nullable().optional()
});

export const listGigsQuerySchema=z.object({
    q:z.string().trim().max(120).optional(),
    tags:z.string().optional().transform((val)=>parseTagsCSV(val)), //seperate with commas while giving input
    category:z.string().max(50).optional(),
    sellerId:z.string().optional(),
    priceMin:z.coerce.number().min(0).optional(),
    priceMax:z.coerce.number().min(0).optional(),
    sort:z.enum(["new","price_asc","price_desc","rating"]).default("new").optional(),
    page:z.coerce.number().int().min(1).default(1).optional(),
    perPage:z.coerce.number().int().min(1).max(50).default(12).optional(),
    mine:z.enum(["true","false"]).optional()
});

export function parseTagsCSV(csv?:string){
    if(!csv) return [];
    return csv
    .split(",")
    .map((t)=>t.trim().toLowerCase())
    .filter((t)=>t.length>=2 && t.length<=20)
    .slice(0,MAX_TAGS)
}