import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server.ts';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    res.once('finish', finish);
    res.once('close', finish);

    try {
      app(req as any, res as any, (err?: unknown) => {
        if (err && !res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              error:
                err instanceof Error
                  ? `Serverless API error: ${err.message}`
                  : 'Serverless API gagal memproses permintaan.',
            })
          );
        }
        finish();
      });
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            error:
              err instanceof Error
                ? `Serverless API error: ${err.message}`
                : 'Serverless API gagal memproses permintaan.',
          })
        );
      }
      finish();
    }
  });
}
