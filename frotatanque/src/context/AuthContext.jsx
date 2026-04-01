import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { ADMIN_NATVILLE_EMAIL, ROLES } from '../constants/roles'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u) {
        setProfile(null)
        setLoading(false)
        return
      }
      try {
        const ref = doc(db, 'users', u.uid)
        let snap = await getDoc(ref)

        /* Primeiro login do admin: só precisa existir em Authentication — criamos o perfil aqui */
        if (!snap.exists() && (u.email || '').toLowerCase() === ADMIN_NATVILLE_EMAIL.toLowerCase()) {
          await setDoc(ref, {
            email: ADMIN_NATVILLE_EMAIL,
            displayName: u.displayName || 'Administrador Natville',
            role: ROLES.ADMIN_GERAL,
            disabled: false,
            createdAt: serverTimestamp(),
          })
          snap = await getDoc(ref)
        }

        if (snap.exists()) {
          const data = snap.data()
          if (data.disabled) {
            await signOut(auth)
            setProfile(null)
            setUser(null)
          } else if (
            data.role === ROLES.ADMIN_GERAL &&
            (u.email || '').toLowerCase() !== ADMIN_NATVILLE_EMAIL.toLowerCase()
          ) {
            await signOut(auth)
            setProfile(null)
            setUser(null)
          } else {
            setProfile({
              id: u.uid,
              ...data,
              email: data.email || u.email || '',
            })
          }
        } else {
          setProfile(null)
        }
      } catch {
        setProfile(null)
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      async login(email, password) {
        await signInWithEmailAndPassword(auth, email, password)
      },
      async sendPasswordReset(email) {
        const trimmed = String(email || '').trim()
        const url =
          typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined
        await sendPasswordResetEmail(auth, trimmed, url ? { url, handleCodeInApp: false } : undefined)
      },
      async logout() {
        await signOut(auth)
      },
    }),
    [user, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
