/**
 * 前端模拟导出：把表格数据生成 CSV 文件并触发下载（Excel 可直接打开）
 * @param {string} filename 文件名（不含扩展名）
 * @param {Array<{label:string, prop:string|Function}>} columns 列定义
 * @param {Array<object>} rows 数据
 */
export function exportCsv(filename, columns, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map((c) => escape(c.label)).join(',')
  const body = rows.map((row) =>
    columns.map((c) => escape(typeof c.prop === 'function' ? c.prop(row) : row[c.prop])).join(',')
  )
  // 加 BOM 头，防止 Excel 打开中文乱码
  const blob = new Blob(['\uFEFF' + [header, ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
