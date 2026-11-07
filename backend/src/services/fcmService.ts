/**
 * fcmService.ts
 * Sends FCM push notifications to Flutter mobile app via Firebase Admin SDK.
 * Requires env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * Get from Firebase Console → Project Settings → Service Accounts → Generate New Private Key
 */

let _adminApp: any = null;

function getApp() {
  if (_adminApp) return _adminApp;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    if (admin.apps.length === 0) {
      _adminApp = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      _adminApp = admin.apps[0];
    }
    return _adminApp;
  } catch {
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
    const admin = require('firebase-admin');
    await admin.messaging(app).send({
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
  } catch {
    // Silently fail — FCM token may be stale
  }
}
