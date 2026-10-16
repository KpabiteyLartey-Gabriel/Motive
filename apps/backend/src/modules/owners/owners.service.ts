import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OwnersService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(userId: string, data: any) {
    const existing = await this.prisma.owner.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Owner profile already exists for this user');
    }

    return this.prisma.owner.create({ data: { userId, ...data } });
  }

  async getProfile(userId: string) {
    const owner = await this.prisma.owner.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true,
            email: true, phone: true, profilePhotoUrl: true,
          },
        },
        vehicles: {
          select: {
            id: true, registrationNumber: true, make: true,
            model: true, year: true, status: true,
          },
        },
      },
    });

    if (!owner) throw new NotFoundException('Owner profile not found');
    return owner;
  }

  async updateProfile(userId: string, data: any) {
    const existing = await this.prisma.owner.findUnique({ where: { userId } });
    if (!existing) {
      // Settings saves should work even if the profile row was never created
      return this.prisma.owner.create({ data: { userId, ...data } });
    }
    // Whitelist: identity, address and payout fields only — status/verification
    // can only be changed by an admin review.
    const allowed: any = {};
    for (const key of ['ghanaCardNumber', 'address', 'city', 'region', 'bankName', 'bankAccountNumber', 'momoNumber', 'momoProvider'] as const) {
      if (data[key] !== undefined) allowed[key] = data[key];
    }
    await this.prisma.owner.update({ where: { userId }, data: allowed });
    return this.getProfile(userId);
  }

  async getOwnerById(id: string) {
    const owner = await this.prisma.owner.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true,
            email: true, phone: true,
          },
        },
      },
    });

    if (!owner) throw new NotFoundException('Owner not found');
    return owner;
  }
}
