'use strict';
'require view';
'require rpc';
'require ui';
'require uci';

var callStatus  = rpc.declare({ object: 'ontoneshot', method: 'status',      expect: { '': {} } });
var callSave    = rpc.declare({ object: 'ontoneshot', method: 'save',        params: [ 'settings' ], expect: { '': {} } });
var callWan     = rpc.declare({ object: 'ontoneshot', method: 'apply_wan',   expect: { '': {} } });
var callIptv    = rpc.declare({ object: 'ontoneshot', method: 'apply_iptv',  expect: { '': {} } });
var callIpv6    = rpc.declare({ object: 'ontoneshot', method: 'apply_ipv6',  expect: { '': {} } });
var callAll     = rpc.declare({ object: 'ontoneshot', method: 'apply_all',   expect: { '': {} } });
var callRestore = rpc.declare({ object: 'ontoneshot', method: 'restore',     expect: { '': {} } });

var FIELDS = [
	'enabled', 'wan_mode', 'wan_bridge_port', 'wan_proto', 'wan_vlan', 'wan_user', 'wan_pass', 'wan_ip', 'wan_gw',
	'iptv_enabled', 'iptv_vlan', 'iptv_mcast_vlan', 'iptv_port', 'iptv_priority',
	'ipv6_enabled', 'ipv6_ra_default', 'ipv6_pd', 'ipv6_pd_size'
];

function byId(key) {
	return document.getElementById('ontoneshot-' + key);
}

// 这几个字段"留空"本身有含义，必须如实下发
var ALWAYS_SEND = [ 'iptv_mcast_vlan' ];

function readSettings() {
	var out = {};

	for (var i = 0; i < FIELDS.length; i++) {
		var key = FIELDS[i];
		var el  = byId(key);

		if (!el)
			continue;

		if (el.type === 'checkbox') {
			out[key] = el.checked ? '1' : '0';
			continue;
		}

		var val = (el.value == null) ? '' : String(el.value);

		// 文本输入框留空 = 保持设备上现有值，不下发（避免把配置清空）
		if (val === '' && ALWAYS_SEND.indexOf(key) < 0)
			continue;

		// 桥接网口只在桥接模式下有意义，路由模式不下发
		if (key === 'wan_bridge_port') {
			var wm = byId('wan_mode');
			if (!wm || wm.value !== 'bridge')
				continue;
		}

		out[key] = val;
	}

	return out;
}

function badge(text, ok) {
	return E('span', {
		'style': 'display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;color:#fff;' +
			(ok ? 'background:#2e7d32' : 'background:#8d8d8d')
	}, text);
}

function showLog(title, res) {
	var ok   = !res || res.ok !== false;
	var text = (res && (res.log || res.error)) || (ok ? _('完成') : _('失败，无输出'));

	ui.showModal(title, [
		E('pre', {
			'style': 'white-space:pre-wrap;word-break:break-all;max-height:420px;overflow:auto;' +
				'background:rgba(0,0,0,.06);padding:10px;border-radius:4px;font-size:12px;margin:0 0 12px'
		}, text),
		E('div', { 'class': 'right' }, E('button', {
			'class': 'btn cbi-button',
			'click': ui.hideModal
		}, _('关闭')))
	]);
}

function field(label, control, help) {
	return E('div', { 'class': 'cbi-value' }, [
		E('label', { 'class': 'cbi-value-title' }, label),
		E('div', { 'class': 'cbi-value-field' }, [ control, help ? E('div', { 'class': 'cbi-value-description' }, help) : '' ])
	]);
}

var CFG = {};

// 文本输入框：回填已保存的值；没保存过就是空的。
// placeholder 固定为空，不显示任何"看起来像已填"的灰色提示文字。
function textField(key, password) {
	var el = E('input', {
		'id': 'ontoneshot-' + key,
		'type': password ? 'password' : 'text',
		'class': 'cbi-input-text',
		'placeholder': '',
		'style': 'width:100%;max-width:320px'
	});

	el.value = (CFG[key] == null) ? '' : String(CFG[key]);

	return el;
}

// allowEmpty=true 时首项为空值（"-"），表示未选择，不会被下发
function selectField(key, options, allowEmpty) {
	var sel = E('select', {
		'id': 'ontoneshot-' + key,
		'class': 'cbi-input-select',
		'style': 'min-width:320px'
	});

	if (allowEmpty)
		sel.appendChild(E('option', { 'value': '' }, '-'));

	for (var i = 0; i < options.length; i++)
		sel.appendChild(E('option', { 'value': options[i][0] }, options[i][1]));

	sel.value = (CFG[key] == null) ? (allowEmpty ? '' : options[0][0]) : String(CFG[key]);

	return sel;
}

function checkField(key, label) {
	var el = E('input', { 'id': 'ontoneshot-' + key, 'type': 'checkbox' });

	el.checked = (CFG[key] === '1' || CFG[key] === 1 || CFG[key] === true);

	return E('div', { 'class': 'cbi-value' }, [
		E('label', { 'class': 'cbi-value-title' }, label),
		E('div', { 'class': 'cbi-value-field' }, el)
	]);
}

return view.extend({
	load: function() {
		return Promise.all([ uci.load('ontoneshot'), callStatus() ]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	applyConfig: function(st) {
		var c = (st && st.config) || {};

		for (var i = 0; i < FIELDS.length; i++) {
			var key = FIELDS[i];
			var el  = byId(key);
			var v   = c[key];

			if (!el)
				continue;

			if (el.type === 'checkbox')
				el.checked = (v === '1' || v === 1 || v === true);
			else
				el.value = (v == null) ? '' : String(v);
		}
	},

	refreshStatus: function() {
		return callStatus().then(L.bind(function(st) {
			var box = document.getElementById('ontoneshot-status');
			if (box && box.parentNode)
				box.parentNode.replaceChild(this.buildStatus(st), box);
			ui.hideModal();
		}, this));
	},

	runAction: function(label, rpcfn, needConfirm) {
		var self = this;

		if (needConfirm && !confirm(needConfirm))
			return Promise.resolve();

		ui.showModal(label, [ E('p', { 'class': 'spinning' }, _('正在执行，请稍候…')) ]);

		return Promise.resolve().then(function() {
			return callSave({ settings: readSettings() });
		}).then(function() {
			return rpcfn();
		}).then(function(res) {
			ui.hideModal();
			showLog(label, res);
			return self.refreshStatus().catch(function() {});
		}).catch(function(err) {
			ui.hideModal();
			showLog(label, { ok: false, error: (err && err.message) || String(err) });
		});
	},

	buildStatus: function(st) {
		st = st || {};

		var row = function(label, value) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '26%' }, label),
				E('td', { 'class': 'td left' }, value || '-')
			]);
		};

		return E('div', { 'class': 'cbi-section', 'id': 'ontoneshot-status' }, [
			E('h3', {}, _('当前状态')),
			E('table', { 'class': 'table' }, [
				row(_('上网 (WAN)'), [ badge(st.wan_up ? _('已连接') : _('未连接'), st.wan_up), ' ',
					st.wan_ip ? E('code', {}, st.wan_ip) : '' ]),
				row(_('IPTV'), badge(st.iptv_up ? _('已启用') : _('未启用'), st.iptv_up)),
				row(_('IPv6'), [ badge(st.ipv6_ok ? _('正常') : _('未获取'), st.ipv6_ok), ' ',
					st.ipv6_prefix ? E('code', {}, st.ipv6_prefix) : '' ]),
				st.ipv6_lan ? row(_('LAN IPv6'), E('code', { 'style': 'font-size:11px' }, st.ipv6_lan)) : '',
				st.wan_bridge ? row(_('WAN 模式'), E('code', {}, _('桥接 (%s)').format(st.wan_bridge)))
					: (st.wan_device ? row(_('WAN 接口'), E('code', {}, st.wan_device)) : ''),
				st.wan_account ? row(_('PPPoE 账号'), E('code', {}, st.wan_account)) : '',
				st.mcast_vlan ? row(_('组播接口'), E('code', {}, st.mcast_vlan)) : '',
				row(_('最近备份'), st.backup ? E('code', { 'style': 'font-size:11px' }, st.backup) : _('无'))
			])
		]);
	},

	buildForm: function() {
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('总开关')),
			E('div', { 'class': 'cbi-section-node' }, [
				checkField('enabled', _('启用插件配置')),
				E('div', { 'class': 'cbi-value-description', 'style': 'margin-left:26%' },
					_('关闭并应用后，将恢复到插件安装前的状态（原厂/原有网络配置）。<br>开启则按下方参数重新配置。'))
			]),

			E('h3', {}, _('配置参数')),

			E('div', { 'class': 'cbi-section-node' }, [
				E('h4', {}, _('上网')),
				field(_('上网模式'), selectField('wan_mode', [
					[ 'route',  _('路由：本机拨号并分配给内网（默认）') ],
					[ 'bridge', _('桥接：上网 VLAN 直通指定网口，由下游设备拨号') ]
				])),
				field(_('上网桥接网口'), selectField('wan_bridge_port', [
					[ 'lan1', 'lan1' ], [ 'lan2', 'lan2' ], [ 'lan3', 'lan3' ], [ 'lan4', 'lan4' ]
				], true), _('仅「桥接」模式需要。该网口上的设备自行 PPPoE / DHCP，不能与 IPTV 出口网口相同。<br><b style="color:#c62828">注意：所选网口不能是当前管理入口（例如从该网口接的电脑访问本页），否则提交后会立刻失联。</b><br>应用后有 180 秒自动回滚保护，确认无误请执行 <code>ontoneshot confirm</code>。')),
				field(_('上网方式'), selectField('wan_proto', [
					[ 'pppoe',  _('PPPoE 拨号（多数宽带）') ],
					[ 'dhcp',   _('DHCP 自动获取') ],
					[ 'static', _('静态 IP') ]
				]), _('仅「路由」模式需要。')),
				field(_('上网 VLAN ID'), textField('wan_vlan'),
					_('运营商上网业务 VLAN。留空则保持当前配置。')),
				field(_('PPPoE 账号'), textField('wan_user'),
					_('留空则保持当前账号。当前账号在状态栏以掩码显示。')),
				field(_('PPPoE 密码'), textField('wan_pass', true)),
				field(_('静态 IP / 掩码'), textField('wan_ip'),
					_('仅“静态 IP”方式需要。')),
				field(_('默认网关'), textField('wan_gw'),
					_('仅“静态 IP”方式需要。')),

				E('h4', {}, _('IPTV')),
				checkField('iptv_enabled', _('启用 IPTV')),
				field(_('IPTV VLAN ID'), textField('iptv_vlan'),
					_('运营商 IPTV 业务 VLAN（点播/信令）。留空则保持当前配置。')),
				field(_('组播 VLAN ID'), textField('iptv_mcast_vlan'),
					_('运营商把直播组播放在独立 VLAN 时填写。<br>留空表示与 IPTV VLAN 相同。')),
				field(_('IPTV 出口网口'), selectField('iptv_port', [
					[ 'lan1', 'lan1' ], [ 'lan2', 'lan2' ], [ 'lan3', 'lan3' ], [ 'lan4', 'lan4' ]
				])),
				field(_('IPTV 802.1p 优先级'), textField('iptv_priority'),
					_('运营商按 802.1p 优先级区分业务时填写（常见 0-7）。留空保持当前配置。')),

				E('h4', {}, _('IPv6')),
				checkField('ipv6_enabled', _('一键开启 IPv6')),
				E('div', { 'class': 'cbi-value-description', 'style': 'margin-left:26%' },
					_('为 LAN 下发 /64，启用 RA 与 DHCPv6，放行 ICMPv6/DHCPv6，并持久化内核参数。')),
				checkField('ipv6_ra_default', _('向下游设备通告默认路由')),
				E('div', { 'class': 'cbi-value-description', 'style': 'margin-left:26%' },
					_('接二级路由（或需要下游设备用本机当 IPv6 网关）时必须开启。<br>关闭会导致下游路由拿不到 IPv6 默认路由，表现为“本机能用 IPv6、二级路由下不行”。')),
				checkField('ipv6_pd', _('向下游路由器委派前缀（PD）')),
				E('div', { 'class': 'cbi-value-description', 'style': 'margin-left:26%' },
					_('二级路由自己还要给它的设备分 IPv6 时需要。<br>开启后 LAN 前缀长度改为下方值，给下游留出可委派的子前缀。')),
				field(_('LAN 前缀长度'), textField('ipv6_pd_size'),
					_('按运营商实际委派长度填写。需比运营商给你的前缀更短，<br>才能给下游留出可委派的子前缀。'))
			])
		]);
	},

	buildButtons: function() {
		var self = this;

		var btn = function(label, cls, title, fn, confirmText) {
			return E('button', {
				'class': 'btn cbi-button ' + (cls || ''),
				'style': 'margin:0 8px 8px 0',
				'click': ui.createHandlerFn(self, function() {
					return self.runAction(title, fn, confirmText);
				})
			}, label);
		};

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('一键操作')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('p', { 'class': 'cbi-value-description' },
					_('按钮会先保存上方参数，再执行对应配置。每次执行前会自动备份，可通过“恢复上次备份”回滚。')),
				btn(_('① 一键配置全部'), 'cbi-button-apply important', _('一键配置全部'), callAll,
					_('将一键配置上网、IPTV 与 IPv6，并自动备份当前配置。继续？')),
				btn(_('② 只配置上网'), 'cbi-button-apply', _('配置上网'), callWan),
				btn(_('③ 只配置 IPTV'), 'cbi-button-apply', _('配置 IPTV'), callIptv),
				btn(_('④ 只开启 IPv6'), 'cbi-button-apply', _('开启 IPv6'), callIpv6),
				btn(_('恢复上次备份'), 'cbi-button-reset', _('恢复备份'), callRestore,
					_('用最近一次备份恢复网络配置？可能造成短暂断网。'))
			])
		]);
	},

	render: function(data) {
		var st = data[1] || {};
		var self = this;

		CFG = st.config || {};

		window.setTimeout(function() { self.applyConfig(st); }, 60);

		return E('div', {}, [
			self.buildStatus(st),
			self.buildForm(),
			self.buildButtons()
		]);
	}
});