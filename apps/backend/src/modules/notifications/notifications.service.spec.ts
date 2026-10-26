import { NotificationChannel } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService.findForUser', () => {
  function buildService() {
    const prisma: any = {
      $transaction: jest.fn(async (queries: any[]) => Promise.all(queries)),
      notification: {
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 0),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
    };
    const service = new NotificationsService(prisma, {} as any, {} as any, {} as any);
    return { service, prisma };
  }

  it('lists only in-app notifications, not email/SMS delivery records', async () => {
    const { service, prisma } = buildService();
    await service.findForUser('user-1', { page: 1, limit: 30 });
    const findArgs = prisma.notification.findMany.mock.calls[0][0];
    const countArgs = prisma.notification.count.mock.calls[0][0];
    expect(findArgs.where).toEqual({ userId: 'user-1', channel: NotificationChannel.IN_APP });
    expect(countArgs.where).toEqual({ userId: 'user-1', channel: NotificationChannel.IN_APP });
  });

  it('keeps the unread filter on in-app notifications', async () => {
    const { service, prisma } = buildService();
    await service.findForUser('user-1', { unreadOnly: true });
    const findArgs = prisma.notification.findMany.mock.calls[0][0];
    expect(findArgs.where).toEqual({
      userId: 'user-1',
      channel: NotificationChannel.IN_APP,
      readAt: null,
    });
  });

  it('marks all read only for in-app notifications', async () => {
    const { service, prisma } = buildService();
    await service.markAllRead('user-1');
    const args = prisma.notification.updateMany.mock.calls[0][0];
    expect(args.where).toEqual({
      userId: 'user-1',
      channel: NotificationChannel.IN_APP,
      readAt: null,
    });
  });
});
