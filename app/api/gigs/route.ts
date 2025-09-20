import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitHeaders, rlGetGigs, rlPostGigs } from "@/lib/rateLimit";
import { slugify } from "@/lib/slug";
import { getIP, json, toMoneyStr } from "@/lib/utils/util";
import { createGigSchema, listGigsQuerySchema, parseTagsCSV } from "@/lib/validators/gig";
import { error } from "console";
import { stat } from "fs";
import { NextResponse } from "next/server";
import { title } from "process";

export const runtime="nodejs";

const MAX_ACTIVE_GIGS_UNVERIFIED=5;



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

export async function POST(req:Request) {
    const ip=getIP(req);
    const rl=await rlPostGigs.limit(`gigs:create:${ip}`)
    const headers=rateLimitHeaders(rl);
    if(!rl.success) return json({error:"Rate Limit Exceeded"},{status:400,headers})
    
    try {
        const dbUser=await requireDbUser();
        if(!["FREELANCER","ADMIN"].includes(dbUser.role)){
            return json({error:"Only freelancers can create gigs"},{status:403,headers});
        }

        const contentLength=Number(req.headers.get("content-length") ?? 0);

        if(contentLength > 1_000_000) return json({error:"Payload too large"},{ status:413, headers});

        const body=await req.json();

        const parsed=createGigSchema.safeParse(body);
        if(!parsed.success){
            return json({ error : "Validation failed",details:parsed.error.flatten()},{status:400,headers})
        }
        const dto=parsed.data;

        const isVerified=!!dbUser.profile?.idVerifiedAt;
        if(!isVerified){
            const activeCount=await prisma.gig.count({where:{sellerId:dbUser.id,isActive:true}});
            if(activeCount >=MAX_ACTIVE_GIGS_UNVERIFIED){
                return json(
                    { error : "Unverified accounts are limited gigs.Please verify for having more gigs"},
                    { status : 403, headers }
                )
            }
        }

        const baseSlug=slugify(dto.title);
        let slug=baseSlug || `gig-${Date.now().toString(36)}`;
        for (let attempt=0; attempt < 8; attempt++){
            const exists=await prisma.gig.findUnique({where:{slug}});
            if(!exists)break;
            slug=`${baseSlug}-${attempt+1}`;
            if(attempt === 7){
                return json({ error: "Unable to allocate unique slug, try a different title"},{ status:503, headers})
            }
        }

        const gig=await prisma.gig.create({
            data: {
                sellerId: dbUser.id,
                title: dto.title,
                slug,
                description:dto.description,
                price: toMoneyStr(dto.price),
                currency: dto.currency ?? "INR",
                deliveryDays: dto.deliveryDays ?? 1,
                revisions: dto.revisions ?? 0,
                tags: dto.tags,
                category: dto.category?.trim() || null,
                images: dto.images ?? [],
                thumbnailUrl: dto.thumbnailUrl?.trim() || null,
                isActive: true 
            },
            select:{
                id:true,
                sellerId:true,
                title:true,
                slug:true,
                description:true,
                price:true,
                currency:true,
                deliveryDays:true,
                revisions:true,
                tags:true,
                category:true,
                images:true,
                thumbnailUrl:true,
                createdAt:true
            }
        });

        return json({ gig },{ status:201, headers });
    
        }
            
        catch (err:any) {
        if(err?.status) return json({ error: err.message },err.status);

        if(err?.code === "P2002" && err?.meta?.target?.includes("slug")){
            return json({ error: "Gig with this slug already exists, try a different title"},{ status:409, headers})
        }

        console.error("POST /api/gigs error:", err);
        return json({ error: "Internal server error" },{ status:500, headers });
    }
}