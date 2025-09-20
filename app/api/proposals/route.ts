import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitHeaders, rlGetProposals, rlPostProposals } from "@/lib/rateLimit";
import { getIP, json, toMoneyStr } from "@/lib/utils/util";
import { createProposalSchema, listProposalQuerySchema } from "@/lib/validators/proposal";
import { admin } from "better-auth/plugins";
import { request } from "http";

export async function GET(req:Request) {
    
    try{
        const user=await requireDbUser();

        const {searchParams}=new URL(req.url);

        const parsed=listProposalQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));

        if(!parsed.success){
            return json({error:"Invalid Query",details:parsed.error.flatten()},400);
        }

        const { requestId, perPage: rawPerPage = 12, page = 1 } = parsed.data;
        const perPage = typeof rawPerPage === "number" ? rawPerPage : 12;

        
        const rl=await rlGetProposals.limit(`proposals:limit:${user.id}:${requestId}`);

        const headers=rateLimitHeaders(rl);

        if(!rl.success) return json({ error: "Rate limit exceeded" }, { status: 429, headers });

        const reqRow=await prisma.request.findUnique({
            where:{ id: requestId },
            select:{id :true,clientId:true}
        });
        if (!reqRow) return json({ error: "Request not found" }, 404);

        const isAdmin=user.role === "ADMIN";
        const isOwner=user.id === reqRow.clientId;

        let where:any={ requestId };

        if(!isAdmin && !isOwner){
            where.freelancerId=user.id;
        }

        const skip=(page-1)*12;

        const [items,total]=await Promise.all([
            prisma.proposal.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: perPage,
                select: {
                id: true,
                requestId: true,
                freelancerId: true,
                coverLetter: true,
                amount: true,
                currency: true,
                estimatedDays: true,
                createdAt: true,
                acceptedAt: true,
                freelancer: {
                    select: {
                    id: true,
                    profile: { select: { username: true, avatarUrl: true } },
                    },
                },
                },
            }),
            prisma.proposal.count({ where }),
        ]);

        return json({ items, total, page, perPage }, { headers });

    }
    catch (err: any) {
        if (err?.status) return json({ error: err.message }, err.status);
        console.error("GET /api/proposals error:", err);
        return json({ error: "Internal server error" }, 500);
        }
}

export async function POST(req:Request){

    try{
        const user=await requireDbUser();

        if(user.role !=="FREELANCER"){
            return json({ error : "Only freelancer can submit proposals"},403);
        }

        const body=await req.json();

        const parsed=createProposalSchema.safeParse(body);

        if (!parsed.success) {
        return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
        }
        const dto = parsed.data;

        const rl=await rlPostProposals.limit(`proposals:create:${user.id}`);

        const headers=rateLimitHeaders(rl);

        if (!rl.success) return json({ error: "Rate limit exceeded" }, { status: 429, headers });

        const reqRow=await prisma.request.findUnique({
            where: { id:dto.requestId },
             select: {
                id: true,
                clientId: true,
                status: true,
                budgetMin: true,
                budgetMax: true,
                currency: true,
            },
        })
        if (!reqRow) return json({ error: "Request not found" }, { status: 404, headers });

        if(reqRow.status !== "OPEN"){
            return json({ error: "Request is not open for proposals" }, { status: 409, headers });
        }

        if(reqRow.clientId===user.id){
            return json({ error: "You cannot propose on your own request" }, { status: 403, headers });
        }

        const amt=Number(dto.amount);
        const min=reqRow.budgetMin != null ? Number(reqRow.budgetMin) : null;
        const max = reqRow.budgetMax != null ? Number(reqRow.budgetMax) : null;

        if(min!=null && max !=null && (amt < min || amt > max)){
              return json(
                { error: `Amount must be within the request budget range ${toMoneyStr(min)} - ${toMoneyStr(max)}` },
                { status: 400, headers }
            );
        }

        try{
            const proposal=await prisma.proposal.create({
                data:{
                    requestId:dto.requestId,
                    freelancerId:user.id,
                    coverLetter:dto.coverLetter,
                    amount:toMoneyStr(dto.amount),
                    currency:dto.currency ?? reqRow.currency ?? "INR",
                    estimatedDays:dto.estimatedDays
                },
                select:{
                    id:true,
                    requestId: true,
                    freelancerId: true,
                    coverLetter: true,
                    amount: true,
                    currency: true,
                    estimatedDays: true,
                    createdAt: true,
                    acceptedAt: true,
                }
            });

            return json(proposal, { status: 201, headers });
        } catch (e: any) {
            if (e?.code === "P2002") {
                    // Unique constraint on (requestId, freelancerId)
                return json({ error: "You already proposed on this request" }, { status: 409, headers });
            }
            throw e;
            }
        }
        catch (err: any) {
        if (err?.status) return json({ error: err.message }, err.status);
        console.error("POST /api/proposals error:", err);
        return json({ error: "Internal server error" }, 500);
        }    
}