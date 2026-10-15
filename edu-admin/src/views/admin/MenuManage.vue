<!-- 菜单权限管理：菜单增删改（动态路由配置）+ 角色授权（页面访问权限 + 按钮权限） -->
<template>
  <el-card shadow="never">
    <el-tabs v-model="tab">
      <!-- ================= 菜单管理 ================= -->
      <el-tab-pane label="菜单管理" name="menu">
        <div class="toolbar">
          <div class="toolbar-left">
            <el-button v-perm="'menu:add'" type="primary" :icon="Plus" @click="openForm()">新增菜单</el-button>
            <el-button :icon="Sort" @click="toggleExpand">{{ expandAll ? '全部折叠' : '全部展开' }}</el-button>
          </div>
          <el-button :icon="RefreshRight" circle @click="loadMenus" />
        </div>

        <el-table
          v-if="tableKey"
          :key="tableKey"
          v-loading="loading"
          :data="menuTree"
          row-key="id"
          border
          :default-expand-all="expandAll"
        >
          <el-table-column label="菜单名称" min-width="170">
            <template #default="{ row }">
              <el-icon v-if="row.icon" class="icon"><component :is="row.icon" /></el-icon>
              {{ row.title }}
            </template>
          </el-table-column>
          <el-table-column prop="path" label="路由地址" min-width="150" />
          <el-table-column label="组件路径" min-width="170">
            <template #default="{ row }">
              <span v-if="row.component">{{ row.component }}</span>
              <el-tag v-else size="small" type="info">目录</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="sort" label="排序" width="70" align="center" />
          <el-table-column label="可访问角色" min-width="200">
            <template #default="{ row }">
              <el-tag v-for="r in row.roles" :key="r" size="small" :type="roleTag(r)" class="mr">{{ roleLabel(r) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="显示" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.hidden ? 'info' : 'success'" size="small">{{ row.hidden ? '隐藏' : '显示' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="230" fixed="right">
            <template #default="{ row }">
              <el-button v-if="!row.parentId" v-perm="'menu:add'" link type="success" :icon="Plus" @click="openForm(null, row.id)">子菜单</el-button>
              <el-button v-perm="'menu:edit'" link type="primary" :icon="Edit" @click="openForm(row)">编辑</el-button>
              <el-button v-perm="'menu:delete'" link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ================= 角色授权 ================= -->
      <el-tab-pane label="角色授权" name="role">
        <el-row :gutter="20" v-loading="permLoading">
          <el-col :xs="24" :md="6">
            <div class="role-list">
              <div
                v-for="r in ROLES"
                :key="r.value"
                class="role-item"
                :class="{ active: currentRole === r.value }"
                @click="selectRole(r.value)"
              >
                <el-icon><Avatar /></el-icon>
                <span>{{ r.label }}</span>
                <el-tag v-if="r.value === userStore.role" size="small" type="warning">当前</el-tag>
              </div>
            </div>
          </el-col>
          <el-col :xs="24" :md="8">
            <h4>页面访问权限</h4>
            <el-tree
              ref="treeRef"
              :data="menuTree"
              node-key="id"
              show-checkbox
              default-expand-all
              :props="{ label: 'title', disabled: isTreeNodeDisabled }"
              class="tree"
            />
          </el-col>
          <el-col :xs="24" :md="10">
            <h4>按钮操作权限</h4>
            <div v-for="g in permissions" :key="g.group" class="perm-group">
              <div class="perm-title">{{ g.group }}</div>
              <el-checkbox-group v-model="checkedPerms">
                <el-checkbox v-for="p in g.items" :key="p.code" :value="p.code">{{ p.label }}</el-checkbox>
              </el-checkbox-group>
            </div>
          </el-col>
        </el-row>
        <div class="save-bar">
          <span class="text-muted">提示：管理员的“首页”和“菜单权限”页面受保护，不能取消。</span>
          <el-button v-perm="'role:assign'" type="primary" :icon="Check" :loading="saving" @click="saveRole">保存授权</el-button>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增 / 编辑菜单 -->
    <el-dialog v-model="formVisible" :title="form.id ? '编辑菜单' : '新增菜单'" width="560px" @closed="formRef.resetFields()">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="上级菜单">
          <el-select v-model="form.parentId" style="width: 100%">
            <el-option label="无（顶级菜单）" :value="0" />
            <el-option v-for="m in directories" :key="m.id" :label="m.title" :value="m.id" :disabled="m.id === form.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="菜单名称" prop="title">
          <el-input v-model.trim="form.title" />
        </el-form-item>
        <el-form-item label="路由地址" prop="path">
          <el-input v-model.trim="form.path" placeholder="以 / 开头，如 /admin/xxx" />
        </el-form-item>
        <el-form-item label="页面组件" prop="component">
          <el-select v-model="form.component" clearable filterable placeholder="不选则为目录" style="width: 100%">
            <el-option v-for="c in componentOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="图标">
          <el-select v-model="form.icon" clearable filterable placeholder="选择图标" style="width: 100%">
            <template #prefix>
              <el-icon v-if="form.icon"><component :is="form.icon" /></el-icon>
            </template>
            <el-option v-for="i in ICONS" :key="i" :label="i" :value="i">
              <el-icon class="icon"><component :is="i" /></el-icon>{{ i }}
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="999" controls-position="right" />
        </el-form-item>
        <el-form-item label="是否隐藏">
          <el-switch v-model="form.hidden" />
          <span class="text-muted" style="margin-left: 12px">隐藏后不在侧边栏显示，但仍可通过地址访问</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, RefreshRight, Sort, Check } from '@element-plus/icons-vue'
import * as api from '@/api/admin'
import { useUserStore } from '@/stores/user'
import { useMenuStore } from '@/stores/menu'
import { ROLES, roleLabel, roleTag } from '@/utils/constants'
import { textRule } from '@/utils/validate'

const userStore = useUserStore()
const menuStore = useMenuStore()
const tab = ref('menu')

/** 受保护菜单 id（与 mock 保持一致） */
const PROTECTED = [1, 10, 15]

const ICONS = [
  'HomeFilled', 'Setting', 'User', 'UserFilled', 'Avatar', 'School', 'Reading', 'Notebook', 'Collection', 'Bell',
  'Menu', 'EditPen', 'Calendar', 'Clock', 'Grid', 'Trophy', 'Medal', 'Management', 'ChatLineSquare', 'Document',
  'Files', 'Folder', 'DataAnalysis', 'PieChart', 'TrendCharts', 'List', 'Tickets', 'Star', 'Flag', 'Compass'
]

// 所有可用的页面组件（排除登录页和错误页）
const componentOptions = Object.keys(import.meta.glob('/src/views/**/*.vue'))
  .map((p) => p.replace('/src/views/', '').replace('.vue', ''))
  .filter((p) => p.includes('/') && !p.startsWith('error/'))

// ---------- 菜单列表 ----------
const menus = ref([])
const loading = ref(false)
const expandAll = ref(true)
const tableKey = ref(1)

const buildTree = (list, parentId = 0) =>
  list
    .filter((m) => m.parentId === parentId)
    .sort((a, b) => a.sort - b.sort)
    .map((m) => {
      const children = buildTree(list, m.id)
      return children.length ? { ...m, children } : { ...m }
    })

const menuTree = computed(() => buildTree(menus.value))
const directories = computed(() => menus.value.filter((m) => !m.parentId && !m.component))

async function loadMenus() {
  loading.value = true
  try {
    menus.value = (await api.getAllMenus()).data
  } finally {
    loading.value = false
  }
}

// 通过修改 key 让表格重新渲染，实现全部展开 / 折叠
function toggleExpand() {
  expandAll.value = !expandAll.value
  tableKey.value++
}

/** 菜单或授权变动后，刷新当前登录用户的侧边栏和路由 */
async function refreshCurrent() {
  await menuStore.loadMenus()
}

// ---------- 新增 / 编辑 ----------
const formVisible = ref(false)
const formRef = ref()
const saving = ref(false)
const emptyForm = () => ({ id: null, parentId: 0, title: '', path: '', component: '', icon: '', sort: 1, hidden: false })
const form = reactive(emptyForm())
const rules = {
  title: textRule('菜单名称', 2, 10),
  path: [
    { required: true, message: '请输入路由地址', trigger: 'blur' },
    { pattern: /^\/[a-zA-Z0-9/_-]*$/, message: '以 / 开头，只能包含字母、数字、/ _ -', trigger: 'blur' }
  ]
}

function openForm(row, parentId = 0) {
  formVisible.value = true
  Object.assign(form, emptyForm(), row ? { ...row } : { parentId })
}

async function submitForm() {
  if (!(await formRef.value.validate().catch(() => false))) return
  saving.value = true
  try {
    const res = form.id ? await api.updateMenu(form.id, form) : await api.addMenu(form)
    ElMessage.success(res.msg)
    formVisible.value = false
    await loadMenus()
    refreshCurrent()
  } finally {
    saving.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除菜单「${row.title}」吗？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  const res = await api.deleteMenu(row.id)
  ElMessage.success(res.msg)
  await loadMenus()
  refreshCurrent()
}

// ---------- 角色授权 ----------
const treeRef = ref()
const permLoading = ref(false)
const permissions = ref([])
const roleData = ref({ rolePerms: {}, roleMenus: {} })
const currentRole = ref('admin')
const checkedPerms = ref([])

const isTreeNodeDisabled = (node) => currentRole.value === 'admin' && PROTECTED.includes(node.id)

async function loadPerms() {
  permLoading.value = true
  try {
    const res = await api.getRolePerms()
    permissions.value = res.data.permissions
    roleData.value = res.data
    await nextTick()
    selectRole(currentRole.value)
  } finally {
    permLoading.value = false
  }
}

function selectRole(role) {
  currentRole.value = role
  checkedPerms.value = [...(roleData.value.rolePerms[role] || [])]
  // 只勾选“叶子节点”，父节点会根据子节点自动呈现全选 / 半选状态
  const ids = roleData.value.roleMenus[role] || []
  const leafIds = ids.filter((id) => !menus.value.some((m) => m.parentId === id))
  treeRef.value?.setCheckedKeys(leafIds)
}

async function saveRole() {
  const menuIds = [...treeRef.value.getCheckedKeys(), ...treeRef.value.getHalfCheckedKeys()]
  saving.value = true
  try {
    const res = await api.saveRolePerms(currentRole.value, { menuIds, perms: checkedPerms.value })
    ElMessage.success(res.msg)
    await loadMenus()
    await loadPerms()
    if (currentRole.value === userStore.role) {
      await refreshCurrent()
      ElMessage.info('当前角色的菜单已刷新，按钮权限在重新进入页面后生效')
    }
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadMenus()
  loadPerms()
})
</script>

<style scoped>
.icon { vertical-align: -2px; margin-right: 6px; }
.mr { margin-right: 4px; }
.role-list { border: 1px solid var(--el-border-color-light); border-radius: 6px; overflow: hidden; margin-bottom: 16px; }
.role-item { display: flex; align-items: center; gap: 8px; padding: 14px 16px; cursor: pointer; border-bottom: 1px solid var(--el-border-color-lighter); }
.role-item:last-child { border-bottom: none; }
.role-item:hover { background: var(--el-fill-color-light); }
.role-item.active { background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-weight: 600; }
h4 { margin: 0 0 12px; }
.tree { border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 8px 0; margin-bottom: 16px; }
.perm-group { margin-bottom: 12px; }
.perm-title { font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 4px; }
.save-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; border-top: 1px solid var(--el-border-color-lighter); padding-top: 16px; }
</style>
