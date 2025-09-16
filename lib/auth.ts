import { headers } from "next/headers";
import { auth } from "./better-auth";
import { prisma } from "./db";
import { Prisma } from "@prisma/client";

async function generateUsername(name:string|undefined,authId:string) {
    const base=name? name.toLowerCase().replace(/\s+/g,"_").slice(0,24)
    : `u_${authId.slice(-6)}`;
    let username=base;
    let counter=1;

    while (await prisma.profile.findUnique({where:{username}})){
        username=`${base}_${counter++}`;
    }
    return username;
}

export async function getAuthSession(){
    return await auth.api.getSession({
        headers: await headers(),
    });
}

export async function requireDbUser() {
    const session=await getAuthSession();
    if(!session?.user){
        const error=new Error("Unauthorized");
        //@ts-ignore
        error.status=401;
        throw error
    }

    const authId=String(session.user.id);
    let user=await prisma.user.findUnique({
        where:{ authId },
        include:{profile:true}
    });

    if(!user){
        const username=await generateUsername(session.user.name,authId);

        user=await prisma.user.create({
            data:{
                authId,
                email:String(session.user.email ?? ""),
                role:"CLIENT",
                profile:{
                    create:{
                        username,
                        name:session.user.name??null,
                        avatarUrl:(session.user.image as string | undefined ) ?? null
                    }
                },
                wallet:{
                    create:{
                        balance: new Prisma.Decimal(0),
                        locked:new Prisma.Decimal(0),
                        currency:"INR"
                    }
                }
            },
            include:{profile:true}
        })
    }

    if(user.banned){
        const err = new Error("Account is banned");
        // @ts-ignore
        err.status = 403;
        throw err;
    }
}

