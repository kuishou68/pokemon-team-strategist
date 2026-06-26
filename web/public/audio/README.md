# 背景音乐 (BGM)

本应用的背景音乐通过 hotlink 在线免授权曲目，**不打包进仓库**。

## 当前曲目

- **8bit Dungeon Level** — by Kevin MacLeod ([incompetech.com](https://incompetech.com/))
- 许可证：**Creative Commons Attribution 3.0 (CC-BY 3.0)**
- 来源直链：`https://incompetech.com/music/royalty-free/mp3-royaltyfree/8bit%20Dungeon%20Level.mp3`

> 按 CC-BY 要求署名原作者 Kevin MacLeod。可商用、可修改，需保留署名。
> ⚠️ 绝不使用宝可梦原版 BGM（侵权）。

## 更换音乐

编辑 `web/src/hooks/useAudio.ts` 的 `BGM_SRC` 为任意可访问的音频 URL，或放本地文件到本目录后改成 `/audio/your-file.mp3`。

## 网络访问慢？

如果 incompetech 在你的网络访问慢，可改走后端代理（参考 `/api/sprite` 的实现，新增一个音频代理端点 + 缓存）。

## 其它免授权音源站

- https://opengameart.org/ （CC0 / chiptune）
- https://pixabay.com/music/ （免版税）
- https://ozzed.net/ （CC-BY 8-bit）
