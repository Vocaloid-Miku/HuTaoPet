# HuTaoPet

HuTaoPet — A highly customizable desktop pet with custom avatars and sound effects  
高自定义形象和音效的桌面宠物

作者：[胡桃每日大赛](https://space.bilibili.com/3537120218057512)

![Windows](https://img.shields.io/badge/Windows-x64-0e7c66)
![Electron](https://img.shields.io/badge/Electron-28-47848F)
![Vue](https://img.shields.io/badge/Vue-3-42b883)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 功能

- 桌面置顶宠物，可拖动，点击角色本体才会响应
- 自定义主题形象：底图、角色图、外观配置均可更换
- 自定义点击音效、音量与开关
- 气泡台词、宠物大小、按钮与配色可调
- 开机自启动
- 单实例运行，重复打开会回到已有窗口
- 系统托盘：打开设置 / 退出

设置窗口包含：**系统**、**外观**、**声音**、**主题**、**关于**。

## 下载

Windows 用户可在 [Releases](https://github.com/Vocaloid-Miku/HuTaoPet/releases) 下载 `hutaopet-*-setup.exe`，安装时可选路径。

未签名安装包可能被 Windows 提示「未知发布者」，选择仍要运行即可。

## 开发

需要 Node.js 18+。

```bash
git clone https://github.com/Vocaloid-Miku/HuTaoPet.git
cd HuTaoPet
npm install
npm run dev
```

常用命令：

```bash
npm run typecheck
npm run build:win      # 生成 Windows 安装包
npm run generate:alpha -- theme/themes/hutao   # 为角色图生成点击区域
```

安装包输出到 `dist/hutaopet-0.1.0-setup.exe`。  
`dist/`、`out/`、`node_modules/` 不需要提交到 Git。

## 自定义主题

角色资源在项目根目录的 `theme/` 下，运行时按 `theme.json` 加载。也可在应用的「主题」面板里导入。

```
theme/
├── theme.json
└── themes/
    └── hutao/
        ├── base.png           # 显示用底图（角色 + 对话框）
        ├── character.png      # 透明角色图，用于点击判定
        ├── alpha.bin          # 点击区域表（脚本生成）
        ├── meta.json
        └── appearance.json    # 该主题的默认外观
```

新增主题：

1. 在 `theme/themes/` 下新建文件夹
2. 放入 `base.png` 与 `character.png`
3. 运行 `npm run generate:alpha -- theme/themes/<主题目录>`
4. 补上该主题的 `appearance.json`
5. 在 `theme.json` 中注册

更完整的说明见 [`theme/README.md`](theme/README.md)。

## 技术栈

Electron · Vue 3 · TypeScript · electron-vite · electron-builder

## 交流与合作

- 粉丝群 / 技术交流群：`1107874115`
- 合作微信：`ETHMiku`
- 合作 QQ：`1491731390`
- Bilibili：[胡桃每日大赛](https://space.bilibili.com/3537120218057512)

## License

[MIT](LICENSE)
