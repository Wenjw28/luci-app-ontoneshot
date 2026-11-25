#!/bin/sh
# ponwrt-feedfix - 修复 PonWrt 软件源中失效的 feed
#
# 现象：apk update 报
#   ERROR: wget: exited with error 8
#   WARNING: ... pon_drivers/packages.adb: unexpected end of file
#   ... 3 unavailable
#
# 原因：固件自带的 /etc/apk/repositories.d/distfeeds.list 里有 3 个 feed
#   在镜像站并不存在（pon_drivers / pon_userspace / video），
#   mirrors.vsean.net 会 302 到 mirrors.pku.edu.cn，而那边对应路径是 404。
#   这 3 个 feed 里的包（kmod-airoha-xpon、airoha-ponctl、luci-app-pon 等）
#   出厂就已安装，后续不重装的情况下注释掉它们没有任何影响。
#
# 用法：
#   sh ponwrt-feedfix.sh           # 注释掉失效 feed 并更新索引
#   sh ponwrt-feedfix.sh restore   # 恢复出厂源配置

LIST=/etc/apk/repositories.d/distfeeds.list
BAK=/etc/apk/repositories.d/distfeeds.list.orig

BAD="pon_drivers pon_userspace video"

if [ ! -f "$LIST" ]; then
	echo "找不到 $LIST"
	exit 1
fi

if [ "$1" = "restore" ]; then
	[ -f "$BAK" ] || { echo "没有备份，无法恢复"; exit 1; }
	cp -f "$BAK" "$LIST"
	echo "已恢复出厂源配置"
	apk update 2>&1 | tail -3
	exit 0
fi

# 首次运行先留一份原始备份
[ -f "$BAK" ] || cp -f "$LIST" "$BAK"

changed=0
for feed in $BAD; do
	# 已经注释过的跳过
	grep -q "^https://.*/$feed/packages.adb$" "$LIST" 2>/dev/null || continue
	sed -i "s|^\(https://.*/$feed/packages\.adb\)$|#\1|" "$LIST"
	echo "已禁用失效源: $feed"
	changed=$((changed + 1))
done

if [ "$changed" = "0" ]; then
	echo "没有需要禁用的源（可能已处理过）"
else
	echo "共禁用 $changed 个失效源，原始配置备份在 $BAK"
fi

# 清理可能存在的损坏索引缓存
rm -f /var/cache/apk/*pon_drivers* /var/cache/apk/*pon_userspace* /var/cache/apk/*video* 2>/dev/null

echo "== 更新索引 =="
apk update 2>&1 | tail -6

echo ""
echo "完成。如需还原： sh $0 restore"
