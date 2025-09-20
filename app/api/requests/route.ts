import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitHeaders, rlGetRequests, rlPostRequests } from "@/lib/rateLimit";
import { getIP, json, toMoneyStr } from "@/lib/utils/util";
import { createRequestSchema, listRequestsQuerySchema } from "@/lib/validators/requests";
import { error } from "console";
import { NextResponse } from "next/server";
import { title } from "process";

export const runtime="nodejs";

const MAX_OPEN_REQUESTS_UNVERIFIED=10;
const MAX_ATTACHMENTS=5;


export async function GET(req:Request) {
    
    try{
        const ip=getIP(req);
        const rl=await rlGetRequests.limit(`requests:list:${ip}`);
        const headers=rateLimitHeaders(rl);
        if (!rl.success) return json({error:"Rate limit exceeded"},{status:429,headers});

        const { searchParams } = new URL(req.url);

        const parsed=listRequestsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
        if(!parsed.success){
            return json({
                error:"Invalid Query",
                details:parsed.error.flatten()
            },{
                status:400,
                headers
            })
        }

        const {
            q,category,status,clientId,budgetMin,budgetMax,dueAfter,dueBefore,sort="new",page=1,perPage=12,mine,tags}=parsed.data;
        

        let scopeClientId=clientId;
        let isMine=false;

        if(mine==="true"){
            const user=await requireDbUser();
            scopeClientId=user.id;
            isMine=true;
        }

        const where:any={};

        if(q){
            where.OR=[
                {title:{contains:q,mode:"insensitive"}},
                {description:{contains:q,mode:"insensitive"}},
                {tags:{has:q.toLowerCase()}}
            ];
        }

        if(category) where.category=category;
        if(scopeClientId) where.clientId=clientId;

        if(!isMine && !clientId){
            where.status="OPEN";
        } else if (status) {
            where.status=status;
        } else if (isMine) {

        }

        if(tags.length){
            where.AND=(where.AND ?? []).concat(tags.map((t)=>({tags : { has:t}})))
        }

        if (budgetMin != null || budgetMax != null) {
        where.AND = [
            ...(where.AND ?? []),
            ...(budgetMin != null ? [{ budgetMin: { gte: toMoneyStr(budgetMin) } }] : []),
            ...(budgetMax != null ? [{ budgetMax: { lte: toMoneyStr(budgetMax) } }] : []),
        ];
        }

        if(dueAfter || dueBefore ){
            where.deadline={};

            if(dueAfter) where.deadline.gte=new Date(dueAfter);
            if(dueBefore) where.deadline.lte=new Date(dueBefore);
        }

        const skip=(page-1)*perPage;

        const orderBy= sort === "budget_asc" ? { budgetMax : "asc" as const } : sort === "budget_desc" ? { budgetMax : "desc" as const }
        : { createdAt: "desc" as const };

        const [items,total]=await Promise.all([
             prisma.request.findMany({
                where,
                orderBy,
                skip,
                take: perPage,
                select: {
                id: true,
                clientId: true,
                title: true,
                description: true,
                budgetMin: true,
                budgetMax: true,
                currency: true,
                deadline: true,
                attachments: true,
                status: true,
                tags: true,
                category: true,
                createdAt: true,
                client: { select: { id: true, profile: { select: { username: true, avatarUrl: true } } } },
                },
            }),
            prisma.request.count({ where }),
        ]);

        return json({ items,total,page,perPage }, { headers });

    }
    catch (err: any) {
        console.error("GET /api/requests error:", err);
        return json({ error: "Internal server error" }, 500);
    }
}



export async function POST(req:Request) {

    const ip=getIP(req);
    const rl=await rlPostRequests.limit(`requests:create:${ip}`);
    const headers=rateLimitHeaders(rl);
    if(!rl.success) return json({error:"Rate limit exceeded"},{status:429,headers});

    try{

        const user=await requireDbUser();
        if(!["CLIENT","ADMIN"].includes(user.role)){
            return json({ error: "Only clients can post requests" }, { status: 403, headers });
        }

        const contentLength=Number(req.headers.get("content-length") ?? 0);
        if(contentLength > 1_000_000) {
            return json({error:"Payload too large"},{status:413,headers});
        }

    const body=await req.json();
    const parsed=createRequestSchema.safeParse(body);

    if(!parsed.success){
        return json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400, headers });
    }

    const dto=parsed.data;

    const isVerified=!!user.profile?.idVerifiedAt;

    if(!isVerified){
        const openCount=await prisma.request.count({ where: { clientId:user.id,status:"OPEN"}});

        if(openCount >= MAX_OPEN_REQUESTS_UNVERIFIED){
            return json(
            { error: `Unverified accounts are limited to ${MAX_OPEN_REQUESTS_UNVERIFIED} open requests.` },
            { status: 403, headers }
            );
        }
    }

    if((dto.attachments?.length ?? 0)> MAX_ATTACHMENTS){
        return json({ error: `Maximum ${MAX_ATTACHMENTS} attachments allowed` }, { status: 400, headers });
    }

    const request = await prisma.request.create({
        data: {
            clientId: user.id,
            title: dto.title,
            description: dto.description,
            budgetMin: dto.budgetMin != null ? toMoneyStr(dto.budgetMin) : null,
            budgetMax: dto.budgetMax != null ? toMoneyStr(dto.budgetMax) : null,
            currency: dto.currency ?? "USD",
            deadline:
            dto.deadline == null
                ? null
                : dto.deadline instanceof Date
                ? dto.deadline
                : new Date(dto.deadline),
            tags: dto.tags ?? [],
            category: dto.category ?? null,
            attachments: dto.attachments ?? [],
            status: "OPEN",
        },
        select: {
            id: true,
            clientId: true,
            title: true,
            description: true,
            budgetMin: true,
            budgetMax: true,
            currency: true,
            deadline: true,
            attachments: true,
            status: true,
            tags: true,
            category: true,
            createdAt: true,
        },
        });

        return json(request, { status: 201, headers });
    }
    catch (err: any) {
        if (err?.status) return json({ error: err.message }, err.status);
        console.error("POST /api/requests error:", err);
        return json({ error: "Internal server error" }, 500);
        }

}