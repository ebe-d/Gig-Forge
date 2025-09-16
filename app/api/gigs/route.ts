import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitHeaders, rlGetGigs } from "@/lib/rateLimit";
import { listGigsQuerySchema, parseTagsCSV } from "@/lib/validators/gig";
import { error } from "console";
import { NextResponse } from "next/server";
import { title } from "process";

export const runtime="nodejs";

const MAX_ACTIVE_GIGS_UNVERIFIED=5;

function json(data:unknown,init?:number | ResponseInit){
    return NextResponse.json(data,typeof init === "number" ? {status:init}:init);
}

function getIP(req:Request){
    const ip=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip");

    return ip??"unknown";
}

function toMoneyStr(v:number | string){
    const n=typeof v==="number"?v:Number(v);
    return n.toFixed(2);
}

export async function GET(req:Request) {
    try{
       const ip=getIP(req);
       const rl=await rlGetGigs.limit(`getGigs:${ip}`);
       const headers=rateLimitHeaders(rl);
       if(!rl.success) return json({error:"Rate Limit Exceeded"},{status:400,headers})

       const { searchParams } = new URL(req.url);

       const parsed=listGigsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()))
       
       if(!parsed.success){
        return json({error:"Invalid Query",details:parsed.error.flatten()},{status:400,headers})
       }
      
       const { q,category,sellerId,priceMin,priceMax,sort="new",page=1,perPage=12,mine,tags}=parsed.data;

       let sellerScope:string|undefined=sellerId;

       if(mine==="true"){
        const user=await requireDbUser();
        sellerScope=user.id;
       }

       const where:any={isActive:true,seller:{banned:false}};

       if(q){
        where.OR=[
            { title : { contains:q,mode:"insensitive"}},
            { description : { contains:q, mode:"insensitive"}},
            { tags: { has:q.toLowerCase() }}
        ];
       }

       if(category){
        where.category=category;
       }
       if(sellerScope){
        where.sellerId=sellerScope;
       }

       if(tags.length){
        where.AND=(where.AND ?? []).concat(tags.map((t)=>({ tags:{has:t}})));
       }

       if(priceMin != null || priceMax !=null){
        where.price={};
        if(priceMin!=null){
            where.price.gte = toMoneyStr(priceMin);
        }
        if(priceMax != null){
            where.price.lte=toMoneyStr(priceMax)
        }
       }

       const skip=(page-1)*perPage;

       const orderBy= sort === "price_asc" ?
        { price : "asc" as const } : sort === "price_desc" ? { price : "desc" as const } : sort === "rating" ? { ratingAvg : "desc" as const } : { createdAt : "desc" as const}

        const [items, total] = await Promise.all([
            prisma.gig.findMany({
                where,
                orderBy,
                skip,
                take: perPage,
                select: {
                id: true,
                title: true,
                slug: true,
                description: true,
                price: true,
                currency: true,
                deliveryDays: true,
                revisions: true,
                images: true,
                thumbnailUrl: true,
                tags: true,
                category: true,
                ratingAvg: true,
                ratingCount: true,
                createdAt: true,
                seller: { select: { id: true, profile: { select: { username: true, avatarUrl: true } } } },
                },
            }),
            prisma.gig.count({ where }),
            ]);

            return json ({ items,total,page,perPage }, {headers});
    }
    catch (err: any) {
        console.error("GET /api/gigs error:", err);
        return json({ error: "Internal server error" }, 500);
        }
}