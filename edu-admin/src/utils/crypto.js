/**
 * 模拟密码加密（课堂演示用）
 * 前端在提交密码前先做一次不可逆哈希，避免明文传输和明文存储。
 * 真实项目中应由后端使用 bcrypt 等算法加盐存储，并全程使用 HTTPS。
 */
const SALT = 'edu-admin-salt'

// cyrb53 哈希算法：简单、同步、分布均匀
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

/** 对密码加盐哈希，返回 32 位十六进制字符串 */
export function encryptPassword(password) {
  return cyrb53(SALT + password, 1) + cyrb53(password + SALT, 2)
}
