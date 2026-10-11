import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const enquiries = sqliteTable("enquiries", {
 id:text("id").primaryKey(), name:text("name").notNull(), email:text("email").notNull(), phone:text("phone"), package:text("package").notNull(), type:text("type").notNull(), date:text("date"), time:text("time"), message:text("message").notNull(), status:text("status").notNull().default("new"), createdAt:text("created_at").notNull(),
});
export const uploads=sqliteTable("uploads",{id:text("id").primaryKey(),enquiryId:text("enquiry_id").references(()=>enquiries.id),name:text("name").notNull(),mime:text("mime").notNull(),size:integer("size").notNull()});
export const projects=sqliteTable("projects",{id:text("id").primaryKey(),title:text("title").notNull(),category:text("category").notNull(),description:text("description").notNull(),imageId:text("image_id").notNull(),createdAt:text("created_at").notNull()});
