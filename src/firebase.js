let db;
if (process.env.NODE_ENV === 'test') {
  db = require('../tests/firestoreMock');
} else {
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? admin.credential.applicationDefault()
        : admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')),
      projectId: process.env.FIREBASE_PROJECT_ID || 'freelance-gig-platform',
    });
  }
  db = admin.firestore();
}
module.exports = { db };
