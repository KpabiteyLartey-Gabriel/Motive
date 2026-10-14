import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDriverProfileDto } from './dto/create-driver-profile.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(userId: string, dto: CreateDriverProfileDto) {
    const existing = await this.prisma.driver.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Driver profile already exists for this user');
    }

    if (dto.licenseNumber) {
      const licenseExists = await this.prisma.driver.findUnique({
        where: { licenseNumber: dto.licenseNumber },
      });
      if (licenseExists) {
        throw new ConflictException('License number is already registered');
      }
    }

    return this.prisma.driver.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  async getProfile(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            profilePhotoUrl: true,
          },
        },
        documents: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return driver;
  }

  async getDriverById(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            profilePhotoUrl: true,
          },
        },
        documents: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
  }

  async findAll(params: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 20, search } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));

    const where: any = {};

    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { licenseNumber: { contains: search } },
      ];
    }

    const [drivers, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({
        where,
        skip,
        take: Math.max(1, Math.floor(Number(limit)) || 20),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.driver.count({ where }),
    ]);

    return {
      drivers,
      pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) },
    };
  }

  async authorizeDriverAccess(driverId: string, requestingUserId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { userId: true },
    });

    if (!driver) throw new NotFoundException('Driver not found');

    if (driver.userId !== requestingUserId) {
      // Check if admin
      const user = await this.prisma.user.findUnique({
        where: { id: requestingUserId },
        select: { primaryRole: true },
      });
      if (!['ADMIN', 'SUPER_ADMIN'].includes(user?.primaryRole)) {
        throw new ForbiddenException('Access denied to this driver record');
      }
    }
  }
}
