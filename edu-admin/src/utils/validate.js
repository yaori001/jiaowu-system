/**
 * 表单校验规则：Element Plus 的 rules 直接引用，统一各页面的校验标准
 * 包含：非空校验、格式校验、非法字符校验
 */

// 非法字符：防止 XSS / SQL 注入类的异常输入
const ILLEGAL_REG = /[<>"'`\;{}$]/

/** 非法字符校验器 */
export const noIllegalChar = (rule, value, callback) => {
  if (value && ILLEGAL_REG.test(String(value))) {
    callback(new Error('不能包含特殊字符 < > " \' ` \ ; { } $'))
  } else {
    callback()
  }
}

/** 必填 + 非法字符 + 长度，最常用的文本规则 */
export const textRule = (label, min = 1, max = 50) => [
  { required: true, message: `请输入${label}`, trigger: 'blur' },
  { min, max, message: `${label}长度为 ${min}-${max} 个字符`, trigger: 'blur' },
  { validator: noIllegalChar, trigger: 'blur' }
]

export const requiredRule = (label, trigger = 'change') => [
  { required: true, message: `请选择${label}`, trigger }
]

export const usernameRule = [
  { required: true, message: '请输入账号', trigger: 'blur' },
  { pattern: /^[a-zA-Z0-9_]{3,16}$/, message: '账号为 3-16 位字母、数字或下划线', trigger: 'blur' }
]

export const passwordRule = [
  { required: true, message: '请输入密码', trigger: 'blur' },
  { pattern: /^\S{6,20}$/, message: '密码为 6-20 位非空白字符', trigger: 'blur' }
]

export const phoneRule = [
  { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的 11 位手机号', trigger: 'blur' }
]
