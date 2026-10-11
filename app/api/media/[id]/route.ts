import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { projects } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "../../../../lib/studio";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 const {id}=await context.params,project=await getDb().select().from(projects).where(eq(projects.imageId,id)).get();
 if(!project&&!await isAdmin())return new Response('Not found',{status:404});
 const object=await env.BUCKET?.get(id);if(!object)return new Response('Not found',{status:404});
 return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType??'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
}
