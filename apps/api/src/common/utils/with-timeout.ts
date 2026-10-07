export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Délai dépassé après ${ms} ms`);
    this.name = 'TimeoutError';
  }
}

/** Rejette la promesse si elle ne se résout pas dans le délai imparti. */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(ms));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
