# 主题角色资源

角色资源放在项目根目录的 `theme/` 下，不打包进渲染进程，运行时按 `theme.json` 加载。

## 目录结构

```
theme/
├── theme.json
└── themes/
    └── hutao/
        ├── base.png           # 底图：角色 + 对话框，仅用于显示
        ├── character.png      # 角色图：透明背景，用于生成 Alpha 点击表
        ├── alpha.bin          # 预计算的 Alpha 表（由脚本生成）
        ├── meta.json          # 元数据（尺寸、阈值等）
        └── appearance.json    # 该主题的默认外观配置
```

## theme.json

```json
{
  "activeTheme": "hutao",
  "themes": {
    "hutao": {
      "label": "胡桃",
      "folder": "themes/hutao"
    }
  }
}
```

## 主题默认外观

每个主题目录下的 `appearance.json` 是该主题的**内置外观**。

- **切换主题时**：用主题内的 `appearance.json` **覆盖写入**当前外观配置文件，并立即生效
- **日常外观设置**：只读写外观配置文件（系统里配置的路径 / 默认 userData）
- **恢复默认**：仍使用应用内置的 `config/appearance.json`，与主题内置外观无关

## 生成 Alpha 表

```bash
npm run generate:alpha -- theme/themes/hutao
```

新增主题时：

1. 在 `theme/themes/` 下新建子文件夹
2. 放入 `base.png` 与 `character.png`
3. 运行上述命令生成 `alpha.bin` 和 `meta.json`
4. 添加该主题的 `appearance.json`（切换到此主题时会写入外观配置文件）
5. 在 `theme.json` 中注册并设为 `activeTheme`

## alpha.bin 格式

| 偏移 | 长度 | 说明 |
|------|------|------|
| 0 | 4 | 魔数 `ALPH` |
| 4 | 4 | 版本号（当前为 1） |
| 8 | 4 | 图片宽度 uint32 LE |
| 12 | 4 | 图片高度 uint32 LE |
| 16 | W×H | 每像素 Alpha 值（0–255） |
