#!/bin/sh
# luci-app-ontoneshot 安装脚本（在 PonWrt 路由器上以 root 运行）
# 用法： sh install.sh
set -e

SRC=$(dirname "$0")/files

[ -d "$SRC" ] || { echo "找不到 files 目录"; exit 1; }

echo "== 安装 luci-app-ontoneshot =="

# 保存"安装前"的原始配置基线（总开关关闭时用它还原）
BASELINE=/root/ontoneshot/baseline
if [ ! -d "$BASELINE" ]; then
	mkdir -p "$BASELINE"
	for f in network dhcp firewall system; do
		[ -f "/etc/config/$f" ] && cp -f "/etc/config/$f" "$BASELINE/$f"
	done
	[ -f /etc/sysctl.conf ] && cp -f /etc/sysctl.conf "$BASELINE/sysctl.conf"
	echo "  已保存原始配置基线到 $BASELINE"
else
	echo "  原始配置基线已存在，保留"
fi

# 1. 配置文件：已存在则保留用户配置
if [ ! -f /etc/config/ontoneshot ]; then
	cp "$SRC/etc/config/ontoneshot" /etc/config/ontoneshot
	chmod 644 /etc/config/ontoneshot
	echo "  已安装 /etc/config/ontoneshot"
else
	echo "  已存在 /etc/config/ontoneshot，保留现有配置"
fi

# 2. 主脚本
cp "$SRC/usr/bin/ontoneshot" /usr/bin/ontoneshot
chmod 755 /usr/bin/ontoneshot
echo "  已安装 /usr/bin/ontoneshot"

# 3. 软件源修复工具
cp "$SRC/../scripts/ponwrt-feedfix.sh" /usr/bin/ponwrt-feedfix
chmod 755 /usr/bin/ponwrt-feedfix
echo "  已安装 /usr/bin/ponwrt-feedfix"

# 4. 开机重新应用桥接参数
cp "$SRC/etc/init.d/ontoneshot-bridge" /etc/init.d/ontoneshot-bridge
chmod 755 /etc/init.d/ontoneshot-bridge
/etc/init.d/ontoneshot-bridge enable >/dev/null 2>&1 || true
echo "  已安装开机桥接修复服务"

# 5. apk 配置（允许未签名包）
if [ ! -f /etc/apk/config ]; then
	mkdir -p /etc/apk
	cp "$SRC/etc/apk/config" /etc/apk/config
	chmod 644 /etc/apk/config
	echo "  已写入 /etc/apk/config (allow-untrusted)"
else
	echo "  /etc/apk/config 已存在，追加 allow-untrusted"
	grep -q '^allow-untrusted' /etc/apk/config || echo 'allow-untrusted' >> /etc/apk/config
fi

# 6. rpcd 后端
mkdir -p /usr/share/rpcd/ucode
cp "$SRC/usr/share/rpcd/ucode/ontoneshot" /usr/share/rpcd/ucode/ontoneshot
chmod 755 /usr/share/rpcd/ucode/ontoneshot
echo "  已安装 rpcd 后端"

# 7. LuCI 菜单 / 权限 / 视图
cp "$SRC/usr/share/luci/menu.d/luci-app-ontoneshot.json" /usr/share/luci/menu.d/
cp "$SRC/usr/share/rpcd/acl.d/luci-app-ontoneshot.json" /usr/share/rpcd/acl.d/
mkdir -p /www/luci-static/resources/view/ontoneshot
cp "$SRC/www/luci-static/resources/view/ontoneshot/overview.js" /www/luci-static/resources/view/ontoneshot/overview.js
chmod 644 /usr/share/luci/menu.d/luci-app-ontoneshot.json \
          /usr/share/rpcd/acl.d/luci-app-ontoneshot.json \
          /www/luci-static/resources/view/ontoneshot/overview.js
echo "  已安装 LuCI 视图与菜单"

# 8. 重启服务
echo "== 重启 rpcd / uhttpd =="
/etc/init.d/rpcd restart >/dev/null 2>&1 || true
/etc/init.d/uhttpd restart >/dev/null 2>&1 || true
sleep 2

# 9. 自检
if ubus -v list ontoneshot >/dev/null 2>&1; then
	echo "  后端已注册：ubus 对象 ontoneshot"
else
	echo "  [警告] 后端未注册，请检查 /usr/share/rpcd/ucode/ontoneshot"
fi

echo ""
echo "安装完成。打开：网络 -> 光猫一键配置"