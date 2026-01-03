// File attachment handler - S3 pre-signed URLs
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse, parseBody, generateId, formatDateTime } from '../utils.js';
import { verifyRespondentToken } from '../auth.js';

const S3_BUCKET = process.env.S3_BUCKET || 'evalytics-uploads';
const S3_REGION = process.env.AWS_REGION || 'eu-central-1';
const UPLOAD_EXPIRY = 3600; // 1 hour

export async function handleAttachments(event, method, path, authToken) {
  // POST /attachments - Create upload URL
  if (path === '/attachments' && method === 'POST') {
    return await createUpload(event, authToken);
  }

  // GET /attachments/{storage_item_id} - Get download URL
  const downloadMatch = path.match(/^\/attachments\/([^/]+)$/);
  if (downloadMatch && method === 'GET') {
    return await getDownloadUrl(downloadMatch[1], authToken);
  }

  // DELETE /attachments/{storage_item_id} - Delete attachment
  if (downloadMatch && method === 'DELETE') {
    return await deleteAttachment(downloadMatch[1], authToken);
  }

  return errorResponse(404, 'NOT_FOUND', 'Attachment endpoint not found');
}

async function createUpload(event, authToken) {
  if (!authToken || authToken.type !== 'respondent') {
    return errorResponse(401, 'UNAUTHORIZED', 'Respondent token required');
  }

  const body = parseBody(event);
  const { filename, content_type, size, public_id } = body;

  if (!filename || !content_type || !size || !public_id) {
    return errorResponse(400, 'MISSING_FIELDS', 'filename, content_type, size, and public_id are required');
  }

  const respondent = await verifyRespondentToken(authToken.token, public_id);
  if (!respondent) {
    return errorResponse(401, 'INVALID_TOKEN', 'Invalid respondent token');
  }

  // Generate storage item ID
  const storageItemId = generateId(64);
  const s3Key = `uploads/${respondent.campaign_id}/${respondent.respondent_id}/${storageItemId}`;
  const now = formatDateTime();

  // Store metadata in storage_items
  await query(
    `INSERT INTO storage_items (storage_item_id, s3_key, bucket, content_type, original_filename, size_bytes, uploaded_by, status, created)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      storageItemId,
      s3Key,
      S3_BUCKET,
      content_type,
      filename,
      size,
      respondent.respondent_id,
      'pending',
      now
    ]
  );

  // Generate pre-signed URL for upload
  // NOTE: In production, use AWS SDK to generate actual pre-signed URL
  // For now, return placeholder
  const uploadUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${UPLOAD_EXPIRY}`;

  return apiResponse(201, {
    storage_item_id: storageItemId,
    upload_url: uploadUrl,
    expires_in: UPLOAD_EXPIRY,
    method: 'PUT',
    headers: {
      'Content-Type': content_type
    },
    note: 'In production, use AWS SDK to generate real pre-signed URL'
  });
}

async function getDownloadUrl(storageItemId, authToken) {
  const item = await queryOne(
    'SELECT * FROM storage_items WHERE storage_item_id = ?',
    [storageItemId]
  );

  if (!item) {
    return errorResponse(404, 'NOT_FOUND', 'Attachment not found');
  }

  // Check permissions - either admin or respondent who uploaded
  if (authToken && authToken.type === 'respondent') {
    const respondent = await verifyRespondentToken(authToken.token);
    if (respondent.respondent_id !== item.uploaded_by) {
      return errorResponse(403, 'FORBIDDEN', 'Not authorized to access this attachment');
    }
  } else if (authToken && authToken.type === 'jwt') {
    // Admin access - OK
  } else {
    return errorResponse(401, 'UNAUTHORIZED', 'Authentication required');
  }

  // Generate pre-signed URL for download
  // NOTE: In production, use AWS SDK
  const downloadUrl = `https://${item.bucket}.s3.${S3_REGION}.amazonaws.com/${item.s3_key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${UPLOAD_EXPIRY}`;

  return apiResponse(200, {
    storage_item_id: item.storage_item_id,
    download_url: downloadUrl,
    filename: item.original_filename,
    content_type: item.content_type,
    size_bytes: item.size_bytes,
    expires_in: UPLOAD_EXPIRY,
    note: 'In production, use AWS SDK to generate real pre-signed URL'
  });
}

async function deleteAttachment(storageItemId, authToken) {
  const item = await queryOne(
    'SELECT * FROM storage_items WHERE storage_item_id = ?',
    [storageItemId]
  );

  if (!item) {
    return errorResponse(404, 'NOT_FOUND', 'Attachment not found');
  }

  // Check permissions
  if (authToken && authToken.type === 'respondent') {
    const respondent = await verifyRespondentToken(authToken.token);
    if (respondent.respondent_id !== item.uploaded_by) {
      return errorResponse(403, 'FORBIDDEN', 'Not authorized to delete this attachment');
    }
  } else if (!authToken || authToken.type !== 'jwt') {
    return errorResponse(401, 'UNAUTHORIZED', 'Authentication required');
  }

  // Mark as deleted (soft delete)
  await query(
    `UPDATE storage_items SET status = 'deleted', last_update = ? WHERE storage_item_id = ?`,
    [formatDateTime(), storageItemId]
  );

  // TODO: In production, delete from S3 using AWS SDK

  return apiResponse(200, { ok: true });
}
