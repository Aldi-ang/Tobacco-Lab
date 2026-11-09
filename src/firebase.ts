import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

/**
 * Primary Firebase project ("cello-inventory-manager") where the user's
 * Firestore database ("ai-studio-tobaccoblendmast-f290ea9f-0076-4586-82ca-6838791e893f")
 * and all historical workspace data reside.
 */
const PRIMARY_FIREBASE_CONFIG = {
  ...firebaseConfig,
  projectId: 'cello-inventory-manager',
  appId: '1:168352992942:web:b64c1609e20e5c3e3ea73f',
  apiKey: 'AIzaSyBlTCEVjiIOYiDOPJm0TSMjnwb-iIt61aQ',
  authDomain: 'cello-inventory-manager.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-tobaccoblendmast-f290ea9f-0076-4586-82ca-6838791e893f',
  storageBucket: 'cello-inventory-manager.firebasestorage.app',
  messagingSenderId: '168352992942',
};

/**
 * Secondary OAuth project ("gen-lang-client-0191666645") used exclusively when
 * requesting an OAuth access token for Google Sheets API export.
 */
const SHEETS_OAUTH_FIREBASE_CONFIG = {
  projectId: 'gen-lang-client-0191666645',
  appId: '1:355898139153:web:c5c87e99801a76e36387b0',
  apiKey: 'AIzaSyCSGtszOUjzufEmVd2pawUKcEV2MtFwMAU',
  authDomain: 'gen-lang-client-0191666645.firebaseapp.com',
  storageBucket: 'gen-lang-client-0191666645.firebasestorage.app',
  messagingSenderId: '355898139153',
};

const app = initializeApp(PRIMARY_FIREBASE_CONFIG);
const sheetsApp = initializeApp(SHEETS_OAUTH_FIREBASE_CONFIG, 'google-sheets-oauth-app');

const firestoreDbId = PRIMARY_FIREBASE_CONFIG.firestoreDatabaseId;

/**
 * Initialize Firestore with `experimentalAutoDetectLongPolling: true` so both
 * desktop WebChannel and iPhone / iOS Safari / Home Screen PWA work reliably.
 */
function createFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
      },
      firestoreDbId
    );
  } catch {
    return getFirestore(app, firestoreDbId);
  }
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);
const sheetsAuth = getAuth(sheetsApp);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/**
 * 1. Main Cloud Login Provider (Identity Only on "cello-inventory-manager")
 */
const cloudAuthProvider = new GoogleAuthProvider();
cloudAuthProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * 2. Google Sheets Export Provider (Requests Spreadsheets scope only when exporting to Sheets)
 */
const sheetsAuthProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => sheetsAuthProvider.addScope(scope));
sheetsAuthProvider.setCustomParameters({ prompt: 'select_account' });

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the Google OAuth access token strictly in memory (never in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

// Capture any pending redirect sign-in result on mobile / iOS
getRedirectResult(auth).catch(() => {
  // Ignore redirect errors if no redirect was pending
});

// Clear cached access token when user signs out
onAuthStateChanged(auth, (user) => {
  if (!user && !isSigningIn) {
    cachedAccessToken = null;
  }
});

export async function signInWithGoogle(): Promise<User | null> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, cloudAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return result.user;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, cloudAuthProvider);
      return null;
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
}

export async function googleSignInForSheets(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    let result;
    try {
      result = await signInWithPopup(sheetsAuth, sheetsAuthProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/unauthorized-domain' || code === 'auth/operation-not-supported-in-this-environment') {
        result = await signInWithPopup(auth, sheetsAuthProvider);
      } else {
        throw err;
      }
    }
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan izin akses Google Sheets. Silakan coba lagi.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: auth.currentUser || result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export async function signOutFromCloud(): Promise<void> {
  await signOut(auth);
  await signOut(sheetsAuth).catch(() => {});
  cachedAccessToken = null;
}

/**
 * Recursively strips `undefined` properties from objects/arrays before writing to Firestore,
 * since Firestore rejects `undefined` values inside maps.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export { doc, getDoc, getDocFromServer, setDoc, onSnapshot, serverTimestamp, onAuthStateChanged };
export type { User };
