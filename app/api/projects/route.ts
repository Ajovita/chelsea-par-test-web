import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { projects } from "../../../db/schema";
import { categories, isAdmin, sameOrigin, validateImage } from "../../../lib/studio";
import { desc, eq } from "drizzle-orm";
export async function GET(){return Response.json(await getDb().select().from(projects).orderBy(desc(projects.createdAt)));}
export async function POST(request:Request){
 if(!sameOrigin(request)||!await isAdmin())return Response.json({error:"Studio access required."},{status:403});
 if(Number(request.headers.get('content-length'))>9*1024*1024)return Response.json({error:"Photo exceeds 8 MB."},{status:413});
 let stored:string|null=null;
 try{
 const data=await request.formData(),title=String(data.get('title')??'').trim(),category=String(data.get('category')??''),description=String(data.get('description')??'').trim(),image=data.get('image');
 if(!title||title.length>120||description.length>1000||!categories.includes(category)||!(image instanceof File))throw new Error('Please provide a title, category and photo.');
 const mime=await validateImage(image),id=crypto.randomUUID();if(!env.BUCKET)throw new Error('Photo storage unavailable.');
 await env.BUCKET.put(id,await image.arrayBuffer(),{httpMetadata:{contentType:mime}});stored=id;
 await getDb().insert(projects).values({id,title,category,description,imageId:id,createdAt:new Date().toISOString()});return Response.json({ok:true});
 }catch(e){if(stored&&env.BUCKET)await env.BUCKET.delete(stored).catch(()=>{});return Response.json({error:e instanceof Error&&/^(Please|Each|Photo)/.test(e.message)?e.message:'Unable to upload this project.'},{status:400});}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request)||!await isAdmin())return Response.json({error:"Studio access required."},{status:403});
 const body=await request.json() as {id?:unknown}; if(typeof body?.id!=='string')return Response.json({error:'Invalid project.'},{status:400}); const id=body.id,db=getDb(),project=await db.select().from(projects).where(eq(projects.id,id)).get();
 if(!project)return Response.json({error:'Project not found.'},{status:404});
 await db.delete(projects).where(eq(projects.id,id));await env.BUCKET?.delete(project.imageId);return Response.json({ok:true});
}
