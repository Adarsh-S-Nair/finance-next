import { dispatch, type WebhookHandlers } from '../dispatcher';
import type {
  HoldingsWebhookPayload,
  InvestmentsTransactionsWebhookPayload,
  ItemWebhookPayload,
  PlaidWebhookPayload,
  RecurringTransactionsWebhookPayload,
  TransactionsWebhookPayload,
  WebhookLogger,
} from '../types';

function makeLogger(): WebhookLogger {
  const noop = () => undefined;
  const logger: WebhookLogger = {
    child: () => logger,
    info: noop,
    warn: noop,
    error: noop,
  };
  return logger;
}

function makeHandlers(): WebhookHandlers & {
  spies: Record<keyof WebhookHandlers, jest.Mock>;
} {
  const spies = {
    transactions: jest.fn(async () => undefined),
    item: jest.fn(async () => undefined),
    holdings: jest.fn(async () => undefined),
    investmentTransactions: jest.fn(async () => undefined),
    recurring: jest.fn(async () => undefined),
  };
  return {
    ...spies,
    spies,
  };
}

describe('dispatch', () => {
  it('routes TRANSACTIONS to the transactions handler', async () => {
    const handlers = makeHandlers();
    const logger = makeLogger();
    const payload: TransactionsWebhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'DEFAULT_UPDATE',
      item_id: 'item-1',
      new_transactions: 3,
    };

    await dispatch(payload, handlers, logger);

    expect(handlers.spies.transactions).toHaveBeenCalledTimes(1);
    expect(handlers.spies.transactions).toHaveBeenCalledWith(payload, logger);
    expect(handlers.spies.item).not.toHaveBeenCalled();
    expect(handlers.spies.holdings).not.toHaveBeenCalled();
    expect(handlers.spies.investmentTransactions).not.toHaveBeenCalled();
    expect(handlers.spies.recurring).not.toHaveBeenCalled();
  });

  it('routes ITEM to the item handler', async () => {
    const handlers = makeHandlers();
    const payload: ItemWebhookPayload = {
      webhook_type: 'ITEM',
      webhook_code: 'ERROR',
      item_id: 'item-1',
      error: { error_message: 'boom' },
    };
    await dispatch(payload, handlers, makeLogger());
    expect(handlers.spies.item).toHaveBeenCalledTimes(1);
    expect(handlers.spies.transactions).not.toHaveBeenCalled();
  });

  it('routes HOLDINGS to the holdings handler', async () => {
    const handlers = makeHandlers();
    const payload: HoldingsWebhookPayload = {
      webhook_type: 'HOLDINGS',
      webhook_code: 'DEFAULT_UPDATE',
      item_id: 'item-1',
    };
    await dispatch(payload, handlers, makeLogger());
    expect(handlers.spies.holdings).toHaveBeenCalledTimes(1);
  });

  it('routes INVESTMENTS_TRANSACTIONS to the investmentTransactions handler', async () => {
    const handlers = makeHandlers();
    const payload: InvestmentsTransactionsWebhookPayload = {
      webhook_type: 'INVESTMENTS_TRANSACTIONS',
      webhook_code: 'DEFAULT_UPDATE',
      item_id: 'item-1',
    };
    await dispatch(payload, handlers, makeLogger());
    expect(handlers.spies.investmentTransactions).toHaveBeenCalledTimes(1);
  });

  it('routes RECURRING_TRANSACTIONS to the recurring handler', async () => {
    const handlers = makeHandlers();
    const payload: RecurringTransactionsWebhookPayload = {
      webhook_type: 'RECURRING_TRANSACTIONS',
      webhook_code: 'RECURRING_TRANSACTIONS_UPDATE',
      item_id: 'item-1',
    };
    await dispatch(payload, handlers, makeLogger());
    expect(handlers.spies.recurring).toHaveBeenCalledTimes(1);
  });

  it('logs a warning (no-op) for unknown webhook types instead of throwing', async () => {
    const handlers = makeHandlers();
    const warn = jest.fn();
    const logger: WebhookLogger = {
      child: () => logger,
      info: jest.fn(),
      warn,
      error: jest.fn(),
    };
    const payload = {
      webhook_type: 'COMPLETELY_UNKNOWN',
      webhook_code: 'X',
      item_id: 'item-1',
    } as unknown as PlaidWebhookPayload;

    await expect(dispatch(payload, handlers, logger)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'Unhandled webhook type',
      expect.objectContaining({ webhook_type: 'COMPLETELY_UNKNOWN' })
    );
    for (const spy of Object.values(handlers.spies)) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('propagates errors from the handler so the dispatcher can mark status=error', async () => {
    const handlers = makeHandlers();
    handlers.spies.transactions.mockRejectedValueOnce(new Error('handler kaboom'));
    const payload: TransactionsWebhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'DEFAULT_UPDATE',
      item_id: 'item-1',
    };
    await expect(dispatch(payload, handlers, makeLogger())).rejects.toThrow('handler kaboom');
  });
});
