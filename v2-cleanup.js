// Deletes only successfully acknowledged encrypted relay payloads.
// Never deletes legacy R2 objects or unacknowledged photos.
export async function cleanupAcknowledgedV2(env){
 if(!env.DB||!env.PHOTOS)return {cleaned:0};
 let rows;
 try{
  rows=(await env.DB.prepare("SELECT photo_id,storage_key FROM lk_v2_photo_queue WHERE status='acknowledged' ORDER BY acknowledged_at LIMIT 50").all()).results;
 }catch(error){
  // During staged rollout, migration may not be applied yet.
  if(/no such table/i.test(String(error)))return {cleaned:0,unavailable:true};
  throw error;
 }
 let cleaned=0;
 for(const row of rows){
  try{
   await env.PHOTOS.delete(row.storage_key);
   await env.DB.prepare("DELETE FROM lk_v2_photo_queue WHERE photo_id=? AND status='acknowledged'").bind(row.photo_id).run();
   cleaned++;
  }catch(error){
   // Keep row so next scheduled run retries.
   console.error('v2 encrypted cleanup failed for queued receipt');
  }
 }
 return {cleaned};
}
