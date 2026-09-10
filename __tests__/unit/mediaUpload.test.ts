import {
  isAllowedMediaType,
  buildUploadFilename,
} from '../../server/src/utils/media';

describe('media upload helpers', () => {
  it('accepts supported media types including images, video and audio', () => {
    expect(isAllowedMediaType('image/jpeg')).toBe(true);
    expect(isAllowedMediaType('video/mp4')).toBe(true);
    expect(isAllowedMediaType('audio/mpeg')).toBe(true);
  });

  it('creates a filename based on the mime type', () => {
    expect(buildUploadFilename('image/png')).toMatch(/\.png$/);
    expect(buildUploadFilename('audio/mpeg')).toMatch(/\.mp3$/);
    expect(buildUploadFilename('application/pdf')).toMatch(/\.pdf$/);
  });
});
