import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
    const now=await prisma.$queryRaw`SELECT NOW() as now;`;

    return NextResponse.json({ok:true,now})
}