import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { nextCookies } from "better-auth/next-js";

export const auth=betterAuth({
    database:prismaAdapter(prisma,{
        provider:"postgresql"
    }),
    secret:'devmode123',
    baseURL:'http://localhost:3000',
    emailAndPassword:{
        enabled:true,
        requireEmailVerification:false
    },
    plugins:[
        nextCookies()
    ],
    
})