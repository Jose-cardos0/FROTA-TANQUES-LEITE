/**
 * Cria o documento Firestore users/{UID} para admin@natville.com (role admin_geral).
 *
 * Pré-requisitos:
 * 1. Utilizador admin@natville.com já criado em Firebase Authentication (copie o UID).
 * 2. Chave de serviço: Firebase Console → Definições do projeto → Contas de serviço
 *    → Gerar nova chave privada → guarde como "firebase-admin-key.json" na pasta frotatanque
 *    (o ficheiro está no .gitignore).
 *
 * Execução (PowerShell, na pasta frotatanque):
 *   $env:ADMIN_UID="cole_o_uid_aqui"
 *   node scripts/create-admin-profile.mjs
 *
 * Linux/macOS:
 *   ADMIN_UID=cole_o_uid_aqui node scripts/create-admin-profile.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import admin from 'firebase-admin'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || join(root, 'firebase-admin-key.json')

const uid = process.env.ADMIN_UID?.trim()

if (!uid) {
  console.error('\n❌ Defina a variável ADMIN_UID com o UID do admin (Authentication → Users).\n')
  process.exit(1)
}

if (!existsSync(keyPath)) {
  console.error(
    `\n❌ Não encontrei a chave de serviço em:\n   ${keyPath}\n\n` +
      'Descarregue em Firebase Console → Project settings → Service accounts → Generate new private key\n' +
      'e guarde como firebase-admin-key.json na pasta frotatanque.\n',
  )
  process.exit(1)
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

await db
  .collection('users')
  .doc(uid)
  .set(
    {
      email: 'admin@natville.com',
      displayName: 'Administrador Natville',
      role: 'admin_geral',
      disabled: false,
    },
    { merge: true },
  )

console.log('\n✅ Documento criado/atualizado: users/' + uid)
console.log('   Pode fazer login na app com admin@natville.com\n')

process.exit(0)
