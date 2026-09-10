export function isAllowedMediaType(mimeType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/3gpp',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/mp4',
    'audio/aac',
    'audio/webm',
    'audio/x-m4a',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip',
    'application/octet-stream',
  ];
  return allowedTypes.includes(mimeType);
}

export function buildUploadFilename(mimeType: string): string {
  const typeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/3gpp': '3gp',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/webm': 'webm',
    'audio/x-m4a': 'm4a',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'text/plain': 'txt',
    'application/zip': 'zip',
    'application/octet-stream': 'bin',
  };

  const ext = typeMap[mimeType] || 'bin';
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}
