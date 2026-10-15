/**
 * 密码哈希（与前端 src/utils/crypto.js 算法完全一致）
 * 前端在提交前已用 encryptPassword 处理，服务端收到的就是哈希值，
 * 这里的函数只在生成种子数据 / 重置密码时使用，保证与前端对得上。
 */
const SALT = 'edu-admin-salt'

function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

export function encryptPassword(password) {
  return cyrb53(SALT + password, 1) + cyrb53(password + SALT, 2)
}

export const DEFAULT_PASSWORD = '123456'
