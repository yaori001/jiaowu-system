/**
 * MySQL 连接池
 * dateStrings: true 让 DATE / DATETIME 直接返回字符串，避免时区换算问题，
 * 返回格式与前端期望的 'YYYY-MM-DD' / 'YYYY-MM-DD HH:mm:ss' 一致。
 */
import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'edu_admin',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  dateStrings: true
})

/** 执行查询，返回结果数组 */
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params)
  return rows
}

/** 查询单条记录（没有则返回 null） */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params)
  return rows[0] || null
}

/** 在事务中执行一组操作，fn 收到一个连接对象 */
export async function transaction(fn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

/** 等待数据库就绪（容器启动时 MySQL 可能还没准备好，重试几次） */
export async function waitForDb(retries = 30, delay = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1')
      console.log('[db] 数据库连接成功')
      return
    } catch (e) {
      console.log(`[db] 等待数据库就绪 (${i}/${retries}) ...`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error('数据库连接失败，请检查配置')
}
