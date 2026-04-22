import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

// Use AUTH_SECRET as the root, fallback for dev only
const secret = process.env.AUTH_SECRET || 'fallback-secret-development-only'

// 32-byte key derived via SHA-256 to guarantee valid length for aes-256
const ENCRYPTION_KEY = crypto.createHash('sha256').update(secret).digest()

export function encrypt(text: string | null | undefined): string | null {
  if (!text) return text as any

  try {
    const iv = crypto.randomBytes(12) // GCM standard IV length
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag().toString('hex')
    
    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag}:${encrypted}`
  } catch (error) {
    console.error('[Encryption Error]:', error)
    return text // Return original string so it doesn't break everything
  }
}

export function decrypt(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) return encryptedText as any
  
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    // Legacy plaintext support or corrupted data
    return encryptedText
  }

  try {
    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('[Decryption Error]:', error)
    // If decryption fails, return original string (might have been plaintext)
    return encryptedText 
  }
}
