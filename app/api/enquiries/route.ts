import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { enquiries, uploads } from "../../../db/schema";
import { isAdmin, packages, sameOrigin, validDate, validateImage } from "../../../lib/studio";
import { desc, eq } from "drizzle-orm";
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:"Invalid request origin."},{status:403});
 if(Number(request.headers.get("content-length"))>26*1024*1024)return Response.json({error:"Upload limit exceeded."},{status:413});
 const uploaded:string[]=[];
 try{
 const data=await request.formData(), text=(key:string)=>String(data.get(key)??"").trim();
 if(text("website"))throw new Error("Please try again.");
 const name=text("name"),email=text("email"),message=text("message"),type=text("type"),pkg=text("package"),date=text("date"),time=text("time");
 if(name.length<2||name.length>100||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||message.length<10||message.length>5000||text("phone").length>40||!packages.includes(pkg)||!["Enquiry","Meeting"].includes(type)||text("consent")!=="on")throw new Error("Please check the required fields and consent.");
 if(date&&!validDate(date))throw new Error("Choose a valid date from today onwards.");
 if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error("Choose a valid time.");
 if(type==="Meeting"&&(!date||!time))throw new Error("Choose a preferred meeting date and time.");
 const files=data.getAll("photos").filter((f):f is File=>f instanceof File&&f.size>0);
 if(files.length>3)throw new Error("Attach up to 3 reference photos.");
 const types=await Promise.all(files.map(validateImage));
 if(!env.BUCKET)throw new Error("Photo storage is unavailable. Please try again later.");
 const id=crypto.randomUUID(), records=[];
 for(let i=0;i<files.length;i++){const file=files[i],uploadId=crypto.randomUUID();await env.BUCKET.put(uploadId,await file.arrayBuffer(),{httpMetadata:{contentType:types[i]}});uploaded.push(uploadId);records.push({id:uploadId,enquiryId:id,name:file.name.slice(0,200),mime:types[i],size:file.size});}
 const db=getDb(),record={id,name,email,phone:text("phone"),package:pkg,type,date,time,message,createdAt:new Date().toISOString()};
 if(records.length)await db.batch([db.insert(enquiries).values(record),db.insert(uploads).values(records)]);else await db.insert(enquiries).values(record);
 return Response.json({id});
 }catch(e){if(env.BUCKET&&uploaded.length)await env.BUCKET.delete(uploaded).catch(()=>{});const message=e instanceof Error?e.message:"";const expected=/^(Please|Choose|Attach|Each|Photo)/.test(message);return Response.json({error:expected?message:"Unable to save your request. Please try again."},{status:expected?400:500});}
}
export async function GET(){if(!await isAdmin())return Response.json({error:"Studio access required."},{status:403});const db=getDb();return Response.json({enquiries:await db.select().from(enquiries).orderBy(desc(enquiries.createdAt)),uploads:await db.select().from(uploads)});}
export async function PATCH(request:Request){
 if(!sameOrigin(request)||!await isAdmin())return Response.json({error:"Studio access required."},{status:403});
 const data=await request.json() as {id?:string;status?:string};if(typeof data?.status!=='string'||!['new','contacted','confirmed','closed'].includes(data.status)||typeof data.id!=='string')return Response.json({error:'Invalid status.'},{status:400});
 await getDb().update(enquiries).set({status:data.status}).where(eq(enquiries.id,data.id));return Response.json({ok:true});
}
