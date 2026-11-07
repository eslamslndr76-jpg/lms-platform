/**
 * fcmService.ts
 * Sends FCM push notifications to Flutter mobile app via Firebase Admin SDK.
 * Requires env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

let _adminApp: any = null;

function getApp() {
  if (_adminApp) return _adminApp;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) return null;

  // Handle escaped newlines in env vars
  privateKey = privateKey.replace(/\\n/g, '\n');

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cert } = require('firebase-admin/app');

    const apps = admin.apps || [];
    if (apps.length === 0) {
      _adminApp = admin.initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      _adminApp = apps[0];
    }
    return _adminApp;
  } catch (err: any) {
    console.error('[FCM] Failed to initialize Firebase Admin:', err.message);
    return null;
  }
}

export function isFcmEnabled(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

/**
 * Send FCM push notification to a single device token.
 */
export async function sendFcmToToken(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const app = getApp();
  if (!app) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getMessaging } = require('firebase-admin/messaging');
    await getMessaging(app).send({
      token,
      notification: { title, body },
      data: data ?? {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'training_fcm_channel',
          sound: 'default',
        },
      },
    });
  } catch (err: any) {
    console.error('[FCM] Send error:', err.message);
  }
}
