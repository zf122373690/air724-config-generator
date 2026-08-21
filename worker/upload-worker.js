/**
 * upload-worker.js — 替代原 upload_media.php 的语音上传接口（可选）
 *
 * 原 PHP 逻辑：
 *   - 校验 URL 中的 ?key=123
 *   - 读取原始请求体，按唯一文件名保存到 uploaded_voices/
 *   - 返回 { errcode:0, errmsg:"ok", media_id, created_at }
 *
 * 静态站点无法接收上传，本 Worker 用 Cloudflare R2 存储承接该能力。
 * 部署（需先在 wrangler.toml / 控制台绑定名为 VOICE_BUCKET 的 R2 存储桶）：
 *   wrangler deploy worker/upload-worker.js
 *
 * 设备侧把上传地址改为该 Worker 的地址，并继续带 ?key=123 即可。
 */
const ALLOW_KEY = "123";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. 校验 KEY
    if (url.searchParams.get("key") !== ALLOW_KEY) {
      return json(403, { errcode: 403, errmsg: "invalid key" });
    }

    // 2. 读取原始 body（兼容任何格式，原样保存）
    const raw = await request.arrayBuffer();
    const filename = "recv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10) + ".mp3";

    // 3. 存入 R2（需绑定 VOICE_BUCKET）
    if (!env.VOICE_BUCKET) {
      return json(500, { errcode: 500, errmsg: "R2 bucket not configured" });
    }
    await env.VOICE_BUCKET.put("voices/" + filename, raw);

    // 4. 返回与原接口一致的结构
    return json(200, {
      errcode: 0,
      errmsg: "ok",
      media_id: filename,
      created_at: Math.floor(Date.now() / 1000),
    });
  },
};

function json(code, body) {
  return new Response(JSON.stringify(body), {
    status: code,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
