import { NextResponse } from "next/server";
import { access } from "node:fs/promises";
import path from "node:path";
import { dbQuery, isDatabaseConfigured } from "@/lib/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  try{
    if(!isDatabaseConfigured())return NextResponse.json({status:"offline-mode",database:false},{headers:{"Cache-Control":"no-store"}});
    await dbQuery("SELECT 1 FROM haneul_schema_migrations LIMIT 1");
    await access(process.env.HANEUL_COURSE_LIBRARY || path.join(process.cwd(),".haneul","courses"));
    return NextResponse.json({status:"ready",database:true,build:process.env.HANEUL_BUILD_FINGERPRINT??"host"},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({status:"unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
