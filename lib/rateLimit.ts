import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type GlobalIRL={
    upstashRedis?:ReturnType<typeof Redis.fromEnv>;
    rlGetGigs?:Ratelimit;
    rlPostGigs?:Ratelimit;
}
const g=globalThis as unknown as GlobalIRL;

const redis=g.upstashRedis?? Redis.fromEnv();

if(!g.upstashRedis) g.upstashRedis=redis;

export const rlGetGigs=g.rlGetGigs ?? new Ratelimit({
    redis,
    limiter:Ratelimit.fixedWindow(60,'1 m'),
    analytics:true,
    prefix:"gf:rl:getGigs"
});

export const rlPostGigs=g.rlPostGigs??new Ratelimit({
    redis,
    limiter:Ratelimit.fixedWindow(10,'1 m'),
    analytics:true,
    prefix:"gf:rl:postGigs"
});

if(!g.rlGetGigs) g.rlGetGigs=rlGetGigs;

if(!g.rlPostGigs) g.rlPostGigs=rlPostGigs;

export type RLResult=Awaited<ReturnType<typeof rlGetGigs.limit>>

export function rateLimitHeaders(res:RLResult){
    return { 
        "X-RateLimit":String(res.limit),
        "X-RateLimit-Remaining": String(res.remaining),
        "X-RateLimit-Reset": String(res.reset),
    }
}
