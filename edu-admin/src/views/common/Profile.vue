<!-- 个人中心：查看个人信息、编辑资料、修改/重置密码 -->
<template>
  <el-row :gutter="16" class="page-row">
    <el-col :xs="24" :md="9">
      <el-card shadow="never">
        <div class="head">
          <el-avatar :size="80" class="avatar">{{ user.name?.slice(-2) }}</el-avatar>
          <h3>{{ user.name }}</h3>
          <el-tag :type="roleTag(user.role)">{{ roleLabel(user.role) }}</el-tag>
        </div>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="账号">{{ user.username }}</el-descriptions-item>
          <el-descriptions-item label="姓名">{{ user.name }}</el-descriptions-item>
          <el-descriptions-item label="角色">{{ roleLabel(user.role) }}</el-descriptions-item>
          <el-descriptions-item :label="user.role === 'student' ? '所属班级' : '所属部门'">
            {{ user.role === 'student' ? className || '-' : user.dept || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="手机号">{{ user.phone || '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="本次登录">{{ userStore.loginTime }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
    </el-col>

    <el-col :xs="24" :md="15">
      <el-card shadow="never">
        <el-tabs v-model="tab">
          <el-tab-pane label="基本资料" name="info">
            <el-form ref="infoRef" :model="info" :rules="infoRules" label-width="90px" class="form">
              <el-form-item label="账号">
                <el-input :model-value="user.username" disabled />
              </el-form-item>
              <el-form-item label="姓名" prop="name">
                <el-input v-model.trim="info.name" maxlength="20" />
              </el-form-item>
              <el-form-item label="手机号" prop="phone">
                <el-input v-model.trim="info.phone" maxlength="11" placeholder="请输入 11 位手机号" />
              </el-form-item>
              <el-form-item v-if="user.role !== 'student'" label="所属部门" prop="dept">
                <el-input v-model.trim="info.dept" maxlength="30" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="saving" @click="saveInfo">保存</el-button>
                <el-button @click="resetInfo">重置</el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="修改密码" name="password">
            <el-form ref="pwdRef" :model="pwd" :rules="pwdRules" label-width="90px" class="form">
              <el-form-item label="原密码" prop="oldPassword">
                <el-input v-model="pwd.oldPassword" type="password" show-password />
              </el-form-item>
              <el-form-item label="新密码" prop="newPassword">
                <el-input v-model="pwd.newPassword" type="password" show-password />
              </el-form-item>
              <el-form-item label="确认密码" prop="confirm">
                <el-input v-model="pwd.confirm" type="password" show-password />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="saving" @click="savePassword">修改密码</el-button>
                <el-button @click="pwdRef.resetFields()">清空</el-button>
              </el-form-item>
            </el-form>
            <el-alert type="info" :closable="false" show-icon class="form">
              忘记原密码？可以
              <el-link type="primary" @click="handleReset">重置为默认密码 123456</el-link>
            </el-alert>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </el-col>
  </el-row>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { updateProfile, changePassword, resetPassword } from '@/api/auth'
import { getClassOptions } from '@/api/admin'
import { encryptPassword } from '@/utils/crypto'
import { roleLabel, roleTag } from '@/utils/constants'
import { textRule, passwordRule, phoneRule, noIllegalChar } from '@/utils/validate'

const userStore = useUserStore()
const user = computed(() => userStore.user || {})
const tab = ref('info')
const saving = ref(false)

// 学生显示所属班级名称
const className = ref('')
onMounted(async () => {
  if (user.value.role === 'student') {
    const res = await getClassOptions()
    className.value = res.data.find((c) => c.id === user.value.classId)?.name || ''
  }
})

// ---------- 基本资料 ----------
const infoRef = ref()
const info = reactive({ name: '', phone: '', dept: '' })
const resetInfo = () => Object.assign(info, { name: user.value.name, phone: user.value.phone, dept: user.value.dept })
resetInfo()

const infoRules = {
  name: textRule('姓名', 2, 20),
  phone: phoneRule,
  dept: [{ validator: noIllegalChar, trigger: 'blur' }]
}

async function saveInfo() {
  if (!(await infoRef.value.validate().catch(() => false))) return
  saving.value = true
  try {
    const res = await updateProfile(info)
    userStore.setUser(res.data)
    ElMessage.success(res.msg)
  } finally {
    saving.value = false
  }
}

// ---------- 修改密码 ----------
const pwdRef = ref()
const pwd = reactive({ oldPassword: '', newPassword: '', confirm: '' })
const pwdRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: passwordRule,
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, cb) => (value !== pwd.newPassword ? cb(new Error('两次输入的密码不一致')) : cb()),
      trigger: 'blur'
    }
  ]
}

async function savePassword() {
  if (!(await pwdRef.value.validate().catch(() => false))) return
  saving.value = true
  try {
    const res = await changePassword({
      oldPassword: encryptPassword(pwd.oldPassword),
      newPassword: encryptPassword(pwd.newPassword)
    })
    ElMessage.success(res.msg)
    userStore.logout()
  } finally {
    saving.value = false
  }
}

async function handleReset() {
  try {
    await ElMessageBox.confirm('确定将密码重置为默认密码 123456 吗？重置后需要重新登录。', '重置密码', { type: 'warning' })
  } catch {
    return
  }
  const res = await resetPassword()
  ElMessage.success(res.msg)
  userStore.logout()
}
</script>

<style scoped>
.page-row { row-gap: 16px; }
.head { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 20px; }
.head h3 { margin: 4px 0 0; }
.avatar { background: var(--el-color-primary); font-size: 24px; }
.form { max-width: 460px; }
</style>
