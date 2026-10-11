import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
export async function isAdmin() {
 // Remove preview-only flag BEFORE changing the Site's owner-private audience.
 if(env.PRIVATE_PREVIEW_ADMIN === "true") return true;
 const user=await getChatGPTUser();
 return !!(env.ADMIN_EMAIL && user && user.email.toLowerCase()===env.ADMIN_EMAIL.toLowerCase());
}
export function sameOrigin(request:Request){const origin=request.headers.get("origin");return !!origin && origin===new URL(request.url).origin;}
export const packages=["Photography","Videography","Reels & posts","Photo + video","Not sure yet"];
export const categories=["Photography","Videography","Social content"];
export function validDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+"T00:00:00Z"), today=new Date().toLocaleDateString("en-CA",{timeZone:"Australia/Perth"});
 return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===value && value>=today;
}
export async function validateImage(file:File){
 if(!file.size || file.size>8*1024*1024)throw new Error("Each photo must be between 1 byte and 8 MB.");
 const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const type=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?"image/jpeg":
 bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a?"image/png":
 String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP"?"image/webp":null;
 if(!type || type!==file.type)throw new Error("Please upload valid JPG, PNG or WebP photos.");return type;
}
