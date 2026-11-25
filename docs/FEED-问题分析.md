# PonWrt 软件源（apk feed）问题分析与修复

## 现象

在设备上执行 `apk update`：

```
ERROR: wget: exited with error 8
WARNING: updating and opening .../pon_drivers/packages.adb: unexpected end of file
ERROR: wget: exited with error 8
WARNING: updating and opening .../pon_userspace/packages.adb: unexpected end of file
ERROR: wget: exited with error 8
WARNING: updating and opening .../video/packages.adb: unexpected end of file
3 unavailable, 0 stale; 10260 distinct packages available
```

`apk search` / `apk add` 时也会伴随同样的 3 条 WARNING。

## 根因

出厂 `/etc/apk/repositories.d/distfeeds.list` 共 9 条 feed，其中 **3 条在镜像站上不存在**：

| feed | HTTP 结果 |
| --- | --- |
| `.../pon_drivers/packages.adb` | 302 → pku 镜像 → **404** |
| `.../pon_userspace/packages.adb` | 302 → pku 镜像 → **404** |
| `.../video/packages.adb` | 302 → pku 镜像 → **404** |
| base / luci / packages / routing / telephony | 200 OK |
| targets/airoha/an7581/packages.adb | 200 OK |

说明：

1. `mirrors.vsean.net` 对**所有**路径都先返回 302，跳转到 `mirrors.pku.edu.cn/immortalwrt/`，
   所以第一眼看状态码都是 302，看不出问题；跟随跳转后才暴露 404。
2. 上游 ImmortalWrt 官方源（`downloads.immortalwrt.org`、`mirrors.pku.edu.cn`）
   **都没有** `pon_drivers` / `pon_userspace` / `video` 这三个 feed。
   这是 PonWrt 固件构建时的私有 feed（`feeds/pon_drivers`、`feeds/pon_userspace`），
   源码在 https://github.com/pbs05/openwrt-pon-userspace ，构建产物只在固件里，未发布到公共镜像。
3. 因此这 3 条是**构建配置遗留**，属于固件 bug，不是网络问题。

## 影响评估

**不影响使用**。这三个 feed 提供的包在出厂时已全部装好：

```
kmod-airoha-xpon, kmod-airoha-pon-frontend, kmod-airoha-paged-bosa,
airoha-ponctl, airoha-pond, airoha-pon-debug, luci-app-pon
```

只要不卸载重装 PON 相关组件，注释掉这些 feed 没有任何副作用。
（`apk update` 报的 `3 unavailable` 也只是提示，剩下 10260 个包照常可用。）

## 修复

```sh
sh /usr/bin/ponwrt-feedfix          # 注释掉 3 个失效 feed 并更新索引
sh /usr/bin/ponwrt-feedfix restore  # 还原出厂源配置
```

脚本做的事：

1. 首次运行把原配置备份为 `distfeeds.list.orig`
2. 注释掉 3 条失效 feed（已注释的自动跳过，重复执行安全）
3. 清理可能残留的坏索引缓存
4. 执行 `apk update`

修复前后对比：

| | 修复前 | 修复后 |
| --- | --- | --- |
| `apk update` | 3 unavailable + 3 条 ERROR | **OK: 10260 distinct packages available** |
| `apk add` | 伴随 WARNING | 干净输出 |
| 可用包数 | 10260 | 10260（不变） |

## 已验证

- `apk update` 无报错
- `apk add --simulate igmpproxy` 能正常解析依赖
- 已装 PON/FWX 相关包 44 个，全部完好
- 上网、IPv6 均正常
- `restore` 可还原出厂配置，`fix` 可重复执行

## 附：关于换源

想换更快的镜像可以改 `/etc/apk/repositories.d/customfeeds.list`，但要注意：

- `distfeeds.list` 是**固件构建时生成**的，sysupgrade 会被覆盖（文件头有注释说明）
- 自定义源应写进 `customfeeds.list` 才能保留
- 换源时必须保证 `packages.adb` 路径存在，且架构为 `aarch64_cortex-a53`、
  版本为 **snapshots**（不是 releases，snapshot 包与 releases 不兼容）

实测可用镜像：

| 镜像 | base 索引 |
| --- | --- |
| `mirrors.vsean.net`（当前，302 中转 pku） | 200 |
| `mirrors.pku.edu.cn`（直连） | 200 |
| `downloads.immortalwrt.org` | 从设备访问失败 |
