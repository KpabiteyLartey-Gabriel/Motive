import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { StorageService } from './storage.service';

describe('StorageService (local fallback)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('reports local provider without Cloudinary credentials', () => {
    delete process.env.STORAGE_PROVIDER;
    delete process.env.CLOUDINARY_URL;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    const svc = new StorageService();
    expect(svc.provider).toBe('local');
  });

  it('saves an uploaded buffer under uploads/<folder> and returns its /uploads URL', async () => {
    delete process.env.STORAGE_PROVIDER;
    delete process.env.CLOUDINARY_URL;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    const svc = new StorageService();
    const stored = await svc.uploadFile(
      { buffer: Buffer.from('fake-image-bytes'), originalname: 'car.jpg', mimetype: 'image/jpeg' },
      'vehicles',
    );
    expect(stored.provider).toBe('local');
    expect(stored.url).toMatch(/^\/uploads\/vehicles\/.+\.jpg$/);
    const onDisk = join(process.cwd(), stored.url.replace(/^\//, ''));
    expect(existsSync(onDisk)).toBe(true);
    expect(readFileSync(onDisk, 'utf8')).toBe('fake-image-bytes');
    rmSync(onDisk, { force: true });
  });

  it('rejects empty uploads', async () => {
    const svc = new StorageService();
    await expect(svc.uploadFile({ buffer: Buffer.alloc(0) }, 'vehicles')).rejects.toThrow('No file data');
  });
});
