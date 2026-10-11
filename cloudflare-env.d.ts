declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_EMAIL?: string;
    PRIVATE_PREVIEW_ADMIN?: string;
  }
}
