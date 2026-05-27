// Génère une paire de clés VAPID (P-256) pour Web Push
const crypto = require('crypto')

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
})

function urlBase64(buf) {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

const pubJwk = publicKey.export({ format: 'jwk' })
const xBuf = Buffer.from(pubJwk.x, 'base64')
const yBuf = Buffer.from(pubJwk.y, 'base64')
const pubRaw = Buffer.concat([Buffer.from([0x04]), xBuf, yBuf])

const privJwk = privateKey.export({ format: 'jwk' })
const dBuf = Buffer.from(privJwk.d, 'base64')

console.log('VAPID_PUBLIC=' + urlBase64(pubRaw))
console.log('VAPID_PRIVATE=' + urlBase64(dBuf))
