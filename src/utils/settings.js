const key = (email, name) => `fp_setting_${name}_${email}`

export function getSetting(email, name, defaultVal = null) {
  const v = localStorage.getItem(key(email, name))
  if (v === null) return defaultVal
  try { return JSON.parse(v) }
  catch { return v }
}

export function setSetting(email, name, value) {
  localStorage.setItem(key(email, name), JSON.stringify(value))
}

export function clearSetting(email, name) {
  localStorage.removeItem(key(email, name))
}
