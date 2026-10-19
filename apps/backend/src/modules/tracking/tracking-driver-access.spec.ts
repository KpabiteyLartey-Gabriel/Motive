import { ForbiddenException } from '@nestjs/common';
import { TrackingService } from './tracking.service';

// Live vehicle tracking is owner-only: a DRIVER must never be able to read a
// vehicle's device, last location, or history — even for a vehicle they drive.
describe('TrackingService driver access', () => {
  const prisma: any = {
    vehicle: { findUnique: jest.fn().mockResolvedValue({ id: 'veh-1', ownerId: 'own-1' }) },
    owner: { findUnique: jest.fn().mockResolvedValue({ id: 'own-1', userId: 'owner-user' }) },
    trackingDevice: { findUnique: jest.fn().mockResolvedValue({ id: 'dev-1', vehicleId: 'veh-1' }) },
    locationRecord: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
  };
  const audit: any = { log: jest.fn().mockResolvedValue(null) };
  const svc = new TrackingService(prisma, audit);

  it('rejects a driver asking for the last location', async () => {
    await expect(svc.getLastLocation('veh-1', 'driver-user', 'DRIVER')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a driver asking for the tracking device', async () => {
    await expect(svc.getDeviceForVehicle('veh-1', 'driver-user', 'DRIVER')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a driver asking for location history', async () => {
    await expect(svc.getLocationHistory('veh-1', 'driver-user', 'DRIVER', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows the owning owner through to the device lookup', async () => {
    await expect(svc.getDeviceForVehicle('veh-1', 'owner-user', 'OWNER')).resolves.toMatchObject({ id: 'dev-1' });
  });

  it('owner history with a missing/NaN limit falls back to 100 records', async () => {
    prisma.locationRecord.findMany.mockClear();
    const res: any = await svc.getLocationHistory('veh-1', 'owner-user', 'OWNER', { limit: NaN } as any);
    expect(res.count).toBe(0);
    expect(prisma.locationRecord.findMany.mock.calls[0][0].take).toBe(100);
  });

  it('rejects a different owner who does not own the vehicle', async () => {
    prisma.owner.findUnique.mockResolvedValueOnce({ id: 'own-2', userId: 'other-owner' });
    await expect(svc.getLastLocation('veh-1', 'other-owner', 'OWNER')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
