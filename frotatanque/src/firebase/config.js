import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyCD07Tbj6FMMIfp0GFxpUaUGOYpBO0Bp6I',
  authDomain: 'frotanatville.firebaseapp.com',
  databaseURL: 'https://frotanatville-default-rtdb.firebaseio.com',
  projectId: 'frotanatville',
  storageBucket: 'frotanatville.firebasestorage.app',
  messagingSenderId: '250858823165',
  appId: '1:250858823165:web:e5d0578b1c9def32d9cd94',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

/** App secundária para criar utilizadores sem terminar sessão do gestor */
export const secondaryApp = initializeApp(firebaseConfig, 'Secondary')
export const secondaryAuth = getAuth(secondaryApp)
