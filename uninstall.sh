#!/bin/sh
# luci-app-ontoneshot 卸载脚本
set -e

echo "== 卸载 luci-app-ontoneshot =="

rm -f /usr/bin/ontoneshot
rm -f /usr/share/rpcd/ucode/ontoneshot
rm -f /usr/share/luci/menu.d/luci-app-ontoneshot.json
rm -f /usr/share/rpcd/acl.d/luci-app-ontoneshot.json
rm -rf /www/luci-static/resources/view/ontoneshot
/etc/init.d/ontoneshot-bridge disable >/dev/null 2>&1 || true
rm -f /etc/init.d/ontoneshot-bridge
rm -f /usr/bin/ponwrt-feedfix

/etc/init.d/rpcd restart >/dev/null 2>&1 || true
/etc/init.d/uhttpd restart >/dev/null 2>&1 || true

echo "插件文件已删除。"
echo "注意：/etc/config/ontoneshot 与 /root/ontoneshot 备份保留，"
echo "      如需彻底清除请手动： rm -f /etc/config/ontoneshot && rm -rf /root/ontoneshot"