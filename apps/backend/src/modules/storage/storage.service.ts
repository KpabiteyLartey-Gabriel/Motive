import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';

export interface UploadedBufferFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
}

export interface StoredFile {
  url: string;
  provider: 'cloudinary' | 'local';
  publicId?: string;
  fileName: string;
}

/**
 * File storage: Cloudinary when configured, local disk otherwise.
 *
 * Cloudinary is enabled when STORAGE_PROVIDER=cloudinary and credentials are
 * present (CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY +
 * CLOUDINARY_API_SECRET). Without credentials we fall back to the local
 * uploads/ folder so development keeps working; URLs are stored in the
 * database either way, so switching providers needs no schema change.
 *
 * Folder structure (mirrored on Cloudinary and on local disk):
 *   ghmotive/vehicles/<vehicleId>/…     vehicle photos
 *   ghmotive/profiles/<userId>/…        profile pictures
 *   ghmotive/documents/<recordId>/…     compliance document files
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly cloudEnabled: boolean;

  constructor() {
    const hasUrl = !!process.env.CLOUDINARY_URL;
    const hasParts = !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
    const wantsCloud = (process.env.STORAGE_PROVIDER || '').toLowerCase() === 'cloudinary' || hasUrl || hasParts;
    this.cloudEnabled = wantsCloud && (hasUrl || hasParts);

    if (this.cloudEnabled) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
      this.logger.log('Storage provider: Cloudinary');
    } else {
      if (wantsCloud) this.logger.warn('STORAGE_PROVIDER=cloudinary but credentials are missing — falling back to local disk');
      this.logger.log('Storage provider: local disk (uploads/)');
    }
  }

  get provider(): 'cloudinary' | 'local' {
    return this.cloudEnabled ? 'cloudinary' : 'local';
  }

  async uploadFile(file: UploadedBufferFile, folder: string): Promise<StoredFile> {
    if (!file?.buffer?.length) throw new Error('No file data received');
    if (this.cloudEnabled) return this.uploadToCloudinary(file, folder);
    return this.saveLocally(file, folder);
  }

  private uploadToCloudinary(file: UploadedBufferFile, folder: string): Promise<StoredFile> {
    // PDFs must go up as `raw`: Cloudinary blocks public delivery of PDFs
    // uploaded as image resources (they return 401), raw files serve fine.
    const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '');
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `ghmotive/${folder}`, resource_type: isPdf ? 'raw' : 'auto' },
        (error, result) => {
          if (error || !result) return reject(error || new Error('Cloudinary upload failed'));
          resolve({
            url: result.secure_url,
            provider: 'cloudinary',
            publicId: result.public_id,
            fileName: file.originalname || result.public_id,
          });
        },
      );
      stream.end(file.buffer);
    });
  }

  private saveLocally(file: UploadedBufferFile, folder: string): StoredFile {
    const dir = join(process.cwd(), 'uploads', folder);
    mkdirSync(dir, { recursive: true });
    const safeExt = (extname(file.originalname || '') || '.bin').toLowerCase().slice(0, 10);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    writeFileSync(join(dir, name), file.buffer);
    return { url: `/uploads/${folder}/${name}`, provider: 'local', fileName: file.originalname || name };
  }
}
