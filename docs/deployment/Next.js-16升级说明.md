# Next.js 16.3.5 / Node.js 24

`next` 和 `eslint-config-next` 固定为 `16.3.5`；`package.json` 与锁文件的 `engines.node` 均为 `24.x`。部署环境需切换 Node.js 24，`engines` 本身不会替换本机 Node.js。

```sh
node --version
npm ci
npm run lint -- --quiet
npm run build
npm start
```

Next.js 16 使用原生 ESLint flat config，配置已适配；构建使用默认 Turbopack。按 Next.js 自动迁移结果，TypeScript JSX 设置更新为 `react-jsx`。构建不再自动执行 ESLint，因此部署检查应单独运行 lint。参考：[官方升级说明](https://nextjs.org/docs/app/guides/upgrading/version-16)。

可用 `NEXT_BUILD_DIR` 指定隔离的构建目录，运行 `build` 和 `start` 时必须保持一致。默认目录仍是 `.next-timeprint`。本次验证使用 Node.js 24 和 `.next-timeprint-next16`，无需数据库迁移。
