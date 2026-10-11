import { getDb } from "../../../db";
import { enquiries } from "../../../db/schema";
import { isAdmin, packages, sameOrigin, validDate } from "../../../lib/studio";
import { desc, eq } from "drizzle-orm";
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:"Invalid request origin."},{status:403});
 const contentType=request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
 if(contentType!=="application/x-www-form-urlencoded")return Response.json({error:"Photo attachments are no longer accepted. Refresh the page and submit a text enquiry."},{status:415});
 const limit=64*1024;
 if(Number(request.headers.get("content-length"))>limit)return Response.json({error:"Request exceeds the size limit."},{status:413});
 const reader=request.body?.getReader(),chunks:Uint8Array[]= [];let size=0;
 if(reader){try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return Response.json({error:"Request exceeds the size limit."},{status:413});}chunks.push(value);}}finally{reader.releaseLock();}}
 try{
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 const data=new URLSearchParams(new TextDecoder("utf-8",{fatal:true}).decode(bytes)),text=(key:string)=>String(data.get(key)??"").trim();
 if(data.has("photos"))throw new Error("Photo attachments are no longer accepted.");
 if(text("website"))throw new Error("Please try again.");
 const name=text("name"),email=text("email"),message=text("message"),type=text("type"),pkg=text("package"),date=text("date"),time=text("time");
 if(name.length<2||name.length>100||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||message.length<10||message.length>5000||text("phone").length>40||!packages.includes(pkg)||!["Enquiry","Meeting"].includes(type)||text("consent")!=="on")throw new Error("Please check the required fields and consent.");
 if(date&&!validDate(date))throw new Error("Choose a valid date from today onwards.");
 if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error("Choose a valid time.");
 if(type==="Meeting"&&(!date||!time))throw new Error("Choose a preferred meeting date and time.");
 const id=crypto.randomUUID();await getDb().insert(enquiries).values({id,name,email,phone:text("phone"),package:pkg,type,date,time,message,createdAt:new Date().toISOString()});
 return Response.json({id});
 }catch(e){const message=e instanceof Error?e.message:"";const expected=/^(Please|Choose|Photo)/.test(message);return Response.json({error:expected?message:"Unable to save your request. Please try again."},{status:expected?400:500});}
}
export async function GET(){if(!await isAdmin())return Response.json({error:"Studio access required."},{status:403});const db=getDb();return Response.json({enquiries:await db.select().from(enquiries).orderBy(desc(enquiries.createdAt))});}
export async function PATCH(request:Request){
 if(!sameOrigin(request)||!await isAdmin())return Response.json({error:"Studio access required."},{status:403});
 const data=await request.json() as {id?:string;status?:string};if(typeof data?.status!=='string'||!['new','contacted','confirmed','closed'].includes(data.status)||typeof data.id!=='string')return Response.json({error:'Invalid status.'},{status:400});
 await getDb().update(enquiries).set({status:data.status}).where(eq(enquiries.id,data.id));return Response.json({ok:true});
}
