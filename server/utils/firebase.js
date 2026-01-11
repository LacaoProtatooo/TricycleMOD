import admin from 'firebase-admin';

let messaging = null;
let auth = null;

try {
  // Check if required environment variables are present
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    throw new Error('Missing required Firebase environment variables');
  }

  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
  };

  // Initialize Firebase Admin SDK only if not already initialized
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
  }

  messaging = admin.messaging();
  auth = admin.auth();
  
  console.log('✅ Firebase messaging and auth services ready');
} catch (error) {
  console.error('❌ Firebase Admin SDK initialization error:', error.message);
  console.error('Push notifications will not work until Firebase is properly configured');
}

/**
 * Send a push notification to a specific device
 * @param {string} token - FCM device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 * @returns {Promise} - Firebase messaging response
 */
const sendNotification = async (token, title, body, data = {}) => {
  if (!messaging) {
    console.warn('Firebase messaging not initialized, skipping notification');
    return null;
  }

  if (!token) {
    console.warn('No FCM token provided, skipping notification');
    return null;
  }

  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        title,
        body,
      },
      token,
    };

    const response = await messaging.send(message);
    console.log('✅ Notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    // Don't throw - just log the error so the main operation can continue
    return null;
  }
};

export { messaging, auth, sendNotification };



