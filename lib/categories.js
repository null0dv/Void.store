const fs = require('fs');
const path = require('path');

const siteConfigFile = path.join(__dirname, '..', 'data', 'site-config.json');

const DEFAULT_CATEGORIES = [
  '銀飾',
  '墜飾',
  '耳環',
  '戒指',
  'AI畫作',
  '服飾',
  '食品',
  '3C電子',
  '居家生活',
  '美妝保養',
  '其他',
];

function readSiteConfigRaw() {
  if (!fs.existsSync(siteConfigFile)) {
    return { publicUrl: null, customCategories: [] };
  }
  return JSON.parse(fs.readFileSync(siteConfigFile, 'utf-8'));
}

function writeSiteConfigRaw(patch) {
  const config = readSiteConfigRaw();
  Object.assign(config, patch);
  fs.writeFileSync(siteConfigFile, JSON.stringify(config, null, 2), 'utf-8');
  return config;
}

function getCategories() {
  const config = readSiteConfigRaw();
  const custom = Array.isArray(config.customCategories) ? config.customCategories : [];
  const merged = [...DEFAULT_CATEGORIES];
  custom.forEach(name => {
    const trimmed = String(name).trim();
    if (trimmed && !merged.includes(trimmed)) merged.push(trimmed);
  });
  return merged;
}

function addCustomCategory(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { ok: false, error: '請輸入品項名稱' };
  if (trimmed.length > 24) return { ok: false, error: '品項名稱最多 24 字' };

  const existing = getCategories();
  if (existing.includes(trimmed)) {
    return { ok: false, error: '此品項已存在' };
  }

  const config = readSiteConfigRaw();
  const custom = Array.isArray(config.customCategories) ? [...config.customCategories] : [];
  custom.push(trimmed);
  writeSiteConfigRaw({ customCategories: custom });

  return { ok: true, categories: getCategories() };
}

module.exports = {
  DEFAULT_CATEGORIES,
  getCategories,
  addCustomCategory,
};