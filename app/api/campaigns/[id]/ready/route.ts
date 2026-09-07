import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/route-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { markCampaignReady } from '@/lib/server/campaign-service'
import type { Campaign } from '@/lib/types'
export async function POST(request: Request,{params}:{params:Promise<{id:string}>}) { if(!await getUserFromRequest(request)) return NextResponse.json({error:'Unauthorized.'},{status:401}); const {id}=await params; const admin=getSupabaseAdmin(); const {data,error}=await admin.from('campaigns').select('*').eq('id',id).single(); if(error) return NextResponse.json({error:error.message},{status:404}); try { await markCampaignReady(data as Campaign); const {data:updated}=await admin.from('campaigns').select('*').eq('id',id).single(); return NextResponse.json(updated) } catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not mark ready.'},{status:400})} }
