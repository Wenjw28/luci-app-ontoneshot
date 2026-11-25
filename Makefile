#
# luci-app-ontoneshot - PonWrt / ImmortalWrt 光猫一键配置
#
# This is free software, licensed under the GPL-2.0.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-ontoneshot
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_LICENSE:=GPL-2.0
PKG_MAINTAINER:=Wenjw28

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-ontoneshot
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI ONT one-shot provisioning
  DEPENDS:=+rpcd +rpcd-mod-ucode +ucode +ucode-mod-uci +ucode-mod-fs
  PKGARCH:=all
endef

define Package/luci-app-ontoneshot/description
  One-click provisioning for PonWrt / ImmortalWrt based ONT devices:
  internet (PPPoE/DHCP/static or bridge), IPTV (with optional multicast
  VLAN) and IPv6 (including downstream PD delegation).
  Includes a master switch that restores the pre-install configuration.
endef

define Build/Compile
endef

define Package/luci-app-ontoneshot/conffiles
/etc/config/ontoneshot
endef

define Package/luci-app-ontoneshot/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/ontoneshot $(1)/etc/config/ontoneshot

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/ontoneshot-bridge $(1)/etc/init.d/ontoneshot-bridge

	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/ontoneshot $(1)/usr/bin/ontoneshot
	$(INSTALL_BIN) ./files/usr/bin/ponwrt-feedfix $(1)/usr/bin/ponwrt-feedfix

	$(INSTALL_DIR) $(1)/usr/share/rpcd/ucode
	$(INSTALL_BIN) ./files/usr/share/rpcd/ucode/ontoneshot $(1)/usr/share/rpcd/ucode/ontoneshot

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./files/usr/share/rpcd/acl.d/luci-app-ontoneshot.json $(1)/usr/share/rpcd/acl.d/luci-app-ontoneshot.json

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./files/usr/share/luci/menu.d/luci-app-ontoneshot.json $(1)/usr/share/luci/menu.d/luci-app-ontoneshot.json

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/ontoneshot
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/ontoneshot/overview.js $(1)/www/luci-static/resources/view/ontoneshot/overview.js

	$(INSTALL_DIR) $(1)/etc/apk
	$(INSTALL_CONF) ./files/etc/apk/config $(1)/etc/apk/config
endef

define Package/luci-app-ontoneshot/postinst
#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] || {
	# 保存"安装前"配置基线（总开关关闭时用于还原）
	BASE=/root/ontoneshot/baseline
	if [ ! -d "$BASE" ]; then
		mkdir -p "$BASE"
		for f in network dhcp firewall system; do
			[ -f "/etc/config/$f" ] && cp -f "/etc/config/$f" "$BASE/$f"
		done
		[ -f /etc/sysctl.conf ] && cp -f /etc/sysctl.conf "$BASE/sysctl.conf"
	fi
	/etc/init.d/ontoneshot-bridge enable >/dev/null 2>&1 || true
	/etc/init.d/rpcd restart >/dev/null 2>&1 || true
	/etc/init.d/uhttpd restart >/dev/null 2>&1 || true
}
exit 0
endef

define Package/luci-app-ontoneshot/postrm
#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] || {
	/etc/init.d/ontoneshot-bridge disable >/dev/null 2>&1 || true
	rm -f /etc/init.d/ontoneshot-bridge
	/etc/init.d/rpcd restart >/dev/null 2>&1 || true
	/etc/init.d/uhttpd restart >/dev/null 2>&1 || true
}
exit 0
endef

$(eval $(call BuildPackage,luci-app-ontoneshot))
