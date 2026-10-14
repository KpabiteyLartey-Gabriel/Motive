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
