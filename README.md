# HOJ Markdown 一键快速添加题目脚本

基于 Tampermonkey 的油猴脚本，支持在 HOJ 后台通过粘贴 Markdown 题面一键解析、补全并创建题目。

### 🚀 安装方式
1. 浏览器安装 [Tampermonkey (油猴插件)](https://www.tampermonkey.net/)
2. 点击此链接直接一键安装：👉 [**点击安装脚本**](https://raw.githubusercontent.com/<你的GitHub用户名>/hoj-quick-add/main/hoj-quick-add.user.js)

### ✨ 功能特性
- **Markdown 智能解析**：自动切分描述、输入、输出、样例及提示说明。
- **自动分配展示ID**：留空自动获取最大数字ID并自增，重复自动重试。
- **标签模糊搜索**：支持下拉多选。
- **评测数据同步**：同时写入题面展示样例与后台评测数据。
