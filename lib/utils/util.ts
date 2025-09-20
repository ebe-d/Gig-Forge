import { NextResponse } from "next/server";

export function json(data:unknown,init?:number | ResponseInit){
    return NextResponse.json(data,typeof init === "number" ? {status:init}:init);
}

export function getIP(req:Request){
    const ip=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip");

    return ip??"unknown";
}

export function toMoneyStr(v:number | string){
    const n=typeof v==="number"?v:Number(v);
    return n.toFixed(2);
}