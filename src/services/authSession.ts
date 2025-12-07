import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

const email = import.meta.env.VITE_FIREBASE_USER;
const password = import.meta.env.VITE_FIREBASE_PASS;

/**
 * Ensure a session is established using env-provided credentials.
 * Called once on app start. Session persists in local storage.
 */
export const ensureSession = async () => {
  if (!email || !password) {
    console.warn('Firebase email/password env vars missing; skipping auto-login.');
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.info('Firebase login successful');
  } catch (err) {
    console.error('Firebase login failed', err);
    throw err;
  }
};
