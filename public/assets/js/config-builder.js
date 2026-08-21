/*
 * config-builder.js — 等价于原 PHP 版 src/ConfigBuilder.php
 *
 * buildLuaConfig(data) 接收与表单字段同名的对象，返回与 PHP build() 完全一致的 Lua 配置文本。
 * 所有默认值、分支、注释格式都与原版保持一致，确保设备端能正常解析。
 *
 * 同时提供 collectForm(formEl)：从 <form> 收集字段，方便前端直接调用。
 */
(function (global) {
  'use strict';

  function escapeLuaString(str) {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
  }

  // 读取数值，提供默认值，并在需要时做范围约束
  function intVal(v, def) {
    if (v === undefined || v === null || v === '') return def;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? def : n;
  }
  function strVal(v, def) {
    if (v === undefined || v === null) return def === undefined ? '' : def;
    return String(v);
  }
  // 收集文本框字符串并 trim
  function trimStr(data, key, def) {
    const raw = data[key];
    if (raw === undefined || raw === null) return def === undefined ? '' : def;
    return String(raw).trim();
  }

  function buildLuaConfig(data) {
    const bool = (v) => (v ? 'true' : 'false');

    // 1. 通知类型开关（与前端勾选框一一对应）
    const notifyCustomPost = !!data['notify-custom-post'];
    const notifyTelegram  = !!data['notify-telegram'];
    const notifyBark      = !!data['notify-bark'];
    const notifyDingtalk  = !!data['notify-dingtalk'];
    const notifyPushdeer  = !!data['notify-pushdeer'];
    const notifyFeishu    = !!data['notify-feishu'];
    const notifyWecom     = !!data['notify-wecom'];
    const notifyWecomApp  = !!data['notify-wecom-app'];
    const notifyGotify    = !!data['notify-gotify'];
    const notifyServerchan = !!data['notify-serverchan'];
    const notifyPushplus  = !!data['notify-pushplus'];
    const notifyPushover  = !!data['notify-pushover'];
    const notifyInotify   = !!data['notify-inotify'];
    const notifyNextSmtp  = !!data['notify-next-smtp-proxy'];
    const notifyWxpusher  = !!data['notify-wxpusher'];

    // 2. 通知类型数组（NOTIFY_TYPE）
    const notifyTypes = [];
    if (notifyCustomPost) notifyTypes.push('"custom_post"');
    if (notifyTelegram)   notifyTypes.push('"telegram"');
    if (notifyBark)       notifyTypes.push('"bark"');
    if (notifyDingtalk)   notifyTypes.push('"dingtalk"');
    if (notifyPushdeer)   notifyTypes.push('"pushdeer"');
    if (notifyFeishu)     notifyTypes.push('"feishu"');
    if (notifyWecom)      notifyTypes.push('"wecom"');
    if (notifyWecomApp)   notifyTypes.push('"wecom_app"');
    if (notifyServerchan) notifyTypes.push('"serverchan"');

    const gotifyApiForType = trimStr(data, 'gotify-api');
    if (notifyGotify && gotifyApiForType !== '') {
      notifyTypes.push('"gotify"');
    }

    if (notifyPushplus)   notifyTypes.push('"pushplus"');
    if (notifyPushover)   notifyTypes.push('"pushover"');
    if (notifyInotify)    notifyTypes.push('"inotify"');
    if (notifyNextSmtp)   notifyTypes.push('"next-smtp-proxy"');
    if (notifyWxpusher)   notifyTypes.push('"wxpusher"');

    // 3. 短信白名单
    const whitelistRaw = trimStr(data, 'sms-control-whitelist');
    const whitelistNumbers = [];
    if (whitelistRaw !== '') {
      const lines = whitelistRaw.split(/\r?\n/);
      for (const line of lines) {
        const n = line.trim();
        if (n !== '') whitelistNumbers.push('"' + escapeLuaString(n) + '"');
      }
    }
    const whitelistNumbersStr = whitelistNumbers.join(', ');

    // 4. CUSTOM_POST_BODY_TABLE 相关
    const customPostBodyText = trimStr(data, 'custom-post-body');
    const customPostBody = customPostBodyText !== ''
      ? customPostBodyText
      : '{ ["title"] = "来自 Air724UG 的通知", ["desp"] = "{msg}" }';

    // 5. 数值 / 布尔配置
    const queryMinutes = intVal(data['query-traffic-interval'], 0);
    const queryMs = queryMinutes * 60 * 1000;
    const bootNotify = !!data['boot-notify'];
    const notifyAppendMore = !!data['notify-append-info'];
    const notifyRetryMax = intVal(data['notify-retry-max'], 100);

    let recordMaxTime = intVal(data['record-max-time'], 50);
    if (recordMaxTime < 0) recordMaxTime = 0;
    if (recordMaxTime > 50) recordMaxTime = 50;

    const smsTts = intVal(data['sms-tts'], 0);
    const callInAction = intVal(data['call-in-action'], 0);

    const audioVolume = intVal(data['audio-volume'], 0);
    const callVolume = intVal(data['call-volume'], 0);
    const micVolume = intVal(data['mic-volume'], 0);

    const rndisEnable = !!data['rndis-enable'];
    const ledEnable = !!data['led-enable'];

    // 文本配置
    const customPostUrl = trimStr(data, 'custom-post-url');
    const customPostContentType = trimStr(data, 'custom-post-content-type', 'application/json');
    const telegramApi = trimStr(data, 'telegram-api');
    const telegramChatId = trimStr(data, 'telegram-chat-id');
    const pushdeerApi = trimStr(data, 'pushdeer-api', 'https://api2.pushdeer.com/message/push');
    const pushdeerKey = trimStr(data, 'pushdeer-key');
    const barkApi = trimStr(data, 'bark-api', 'https://api.day.app');
    const barkKey = trimStr(data, 'bark-key');
    const dingtalkWebhook = trimStr(data, 'dingtalk-webhook');
    const dingtalkSecret = trimStr(data, 'dingtalk-secret');
    const feishuWebhook = trimStr(data, 'feishu-webhook');
    const wecomWebhook = trimStr(data, 'wecom-webhook');
    const wecomCorpid = trimStr(data, 'wecom-corpid');
    const wecomCorpsecret = trimStr(data, 'wecom-corpsecret');
    const wecomAgentid = intVal(data['wecom-agentid'], 0);
    const wecomAppTouser = trimStr(data, 'wecom-app-touser');
    const wecomAppSafe = intVal(data['wecom-app-safe'], 0);
    const uploadUrl = trimStr(data, 'upload-url');
    const ttsText = trimStr(data, 'tts-text');
    const pinCode = trimStr(data, 'pin-code');
    const number = trimStr(data, 'NUMBER') || trimStr(data, 'number');

    const gotifyApi = trimStr(data, 'gotify-api');
    const gotifyTitle = trimStr(data, 'gotify-title', '转发器');
    const gotifyPriority = intVal(data['gotify-priority'], 8);
    const gotifyToken = trimStr(data, 'gotify-token');
    const gotifyClientToken = trimStr(data, 'gotify-client-token');

    const serverchanTitle = trimStr(data, 'serverchan-title');
    const serverchanApi = trimStr(data, 'serverchan-api');
    const pushplusToken = trimStr(data, 'pushplus-token');
    const pushplusTitle = trimStr(data, 'pushplus-title');

    const wxpusherAppToken = trimStr(data, 'wxpusher-apptoken');
    const wxpusherUids = trimStr(data, 'wxpusher-uids');
    const wxpusherSummary = trimStr(data, 'wxpusher-summary', '来自 Air724UG 的通知');
    const wxpusherContentType = intVal(data['wxpusher-content-type'], 1);

    const pushoverApiToken = trimStr(data, 'pushover-api-token');
    const pushoverUserKey = trimStr(data, 'pushover-user-key');
    const inotifyApi = trimStr(data, 'inotify-api');
    const nextSmtpApi = trimStr(data, 'next-smtp-proxy-api');
    const nextSmtpUser = trimStr(data, 'next-smtp-proxy-user');
    const nextSmtpPassword = trimStr(data, 'next-smtp-proxy-password');
    const nextSmtpHost = trimStr(data, 'next-smtp-proxy-host', 'smtp-mail.outlook.com');
    const nextSmtpPort = intVal(data['next-smtp-proxy-port'], 587);
    const nextSmtpFormName = trimStr(data, 'next-smtp-proxy-form-name', 'Air724UG');
    const nextSmtpToEmail = trimStr(data, 'next-smtp-proxy-to-email');
    const nextSmtpSubject = trimStr(data, 'next-smtp-proxy-subject', '来自 Air724UG 的通知');

    const voiceSendEnable = !!data['voice-send-enable'];

    // 组装 Lua 文本
    let lua = "module(...)\n\n";
    lua += "-------------------------------------------------- 功能及使用说明 --------------------------------------------------\n\n";
    lua += "-- 本项目支持外接扬声器和麦克风, 可以实现接打电话等功能, 推荐连接后使用\n\n";
    lua += "-- 连接扬声器后, 可以通过短按/双击/长按 POWERKEY 来切换选择菜单项\n";
    lua += "-- 菜单项包含: 扬声器音量/通话音量/麦克音量/回拨电话/测试通知/网卡/短信播报/历史短信/来电动作/开机通知/查询流量/查询温度/查询时间/查询信号/查询内存/查询电压/状态指示灯/切换卡槽/重启/关机\n";
    lua += "-- 连接扬声器后, 可以播放: 通知发送成功提示音/来电铃声/通话外放声/短信验证码/短信内容\n";
    lua += "-- 来电动作配置为无操作时, 如果来电话, 可以通过短按/长按 POWERKEY 来手动接听/挂断电话\n\n";
    lua += "-- 支持虚拟U盘来存储历史短信, 需要使用 core 目录下的底层固件\n\n";
    lua += "-- 下面配置文件编辑时注意删除注释 (两个短横杠--是lua的注释), 推荐使用 VSCode 代码编辑器\n\n";

    lua += "-------------------------------------------------- 通知相关配置 --------------------------------------------------\n\n";
    lua += "-- 通知类型, 支持配置多个\n";
    lua += 'NOTIFY_TYPE = { ' + notifyTypes.join(', ') + " }\n\n";

    // custom_post
    lua += "-- custom_post 通知配置, 自定义 POST 请求\n";
    lua += "-- CUSTOM_POST_CONTENT_TYPE 支持 application/x-www-form-urlencoded 和 application/json\n";
    lua += "-- CUSTOM_POST_BODY_TABLE 中的 {msg} 会被替换为通知内容\n";
    if (notifyCustomPost) {
      lua += 'CUSTOM_POST_URL = "' + escapeLuaString(customPostUrl) + "\"\n";
      lua += 'CUSTOM_POST_CONTENT_TYPE = "' + escapeLuaString(customPostContentType) + "\"\n";
      lua += 'CUSTOM_POST_BODY_TABLE = ' + customPostBody + "\n\n";
    } else {
      lua += '-- CUSTOM_POST_URL = "https://sctapi.ftqq.com/<SENDKEY>.send"\n';
      lua += '-- CUSTOM_POST_CONTENT_TYPE = "application/json"\n';
      lua += '-- CUSTOM_POST_BODY_TABLE = { ["title"] = "这里是标题", ["desp"] = "{msg}" }\n\n';
    }

    // telegram
    lua += "-- telegram 通知配置, https://github.com/0wQ/telegram-notify 或者自行反代\n";
    if (notifyTelegram) {
      lua += 'TELEGRAM_API = "' + escapeLuaString(telegramApi) + "\"\n";
      lua += 'TELEGRAM_CHAT_ID = "' + escapeLuaString(telegramChatId) + "\"\n\n";
    } else {
      lua += '-- TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"\n';
      lua += '-- TELEGRAM_CHAT_ID = ""\n\n';
    }

    // pushdeer
    lua += "-- pushdeer 通知配置, https://www.pushdeer.com/\n";
    if (notifyPushdeer) {
      lua += 'PUSHDEER_API = "' + escapeLuaString(pushdeerApi) + "\"\n";
      lua += 'PUSHDEER_KEY = "' + escapeLuaString(pushdeerKey) + "\"\n\n";
    } else {
      lua += '-- PUSHDEER_API = "https://api2.pushdeer.com/message/push"\n';
      lua += '-- PUSHDEER_KEY = ""\n\n';
    }

    // bark
    lua += "-- bark 通知配置, https://github.com/Finb/Bark\n";
    if (notifyBark) {
      lua += 'BARK_API = "' + escapeLuaString(barkApi) + "\"\n";
      lua += 'BARK_KEY = "' + escapeLuaString(barkKey) + "\"\n\n";
    } else {
      lua += '-- BARK_API = "https://api.day.app"\n';
      lua += '-- BARK_KEY = ""\n\n';
    }

    // dingtalk
    lua += "-- dingtalk 通知配置, https://open.dingtalk.com/document/robots/custom-robot-access\n";
    lua += "-- 自定义关键词方式可填写 \":\" \"#\" \"号码\"\n";
    lua += "-- 如果是加签方式, 请填写 DINGTALK_SECRET, 否则留空为自定义关键词方式, https://open.dingtalk.com/document/robots/customize-robot-security-settings\n";
    if (notifyDingtalk) {
      lua += 'DINGTALK_WEBHOOK = "' + escapeLuaString(dingtalkWebhook) + "\"\n";
      lua += 'DINGTALK_SECRET = "' + escapeLuaString(dingtalkSecret) + "\"\n\n";
    } else {
      lua += '-- DINGTALK_WEBHOOK = "https://oapi.dingtalk.com/robot/send?access_token=xxx"\n';
      lua += '-- DINGTALK_SECRET = ""\n\n';
    }

    // feishu
    lua += "-- feishu 通知配置, https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN\n";
    if (notifyFeishu) {
      lua += 'FEISHU_WEBHOOK = "' + escapeLuaString(feishuWebhook) + "\"\n\n";
    } else {
      lua += '-- FEISHU_WEBHOOK = "https://open.feishu.cn/open-apis/bot/v2/hook/xxx"\n\n';
    }

    // wecom 机器人
    lua += "-- wecom 通知配置, https://developer.work.weixin.qq.com/document/path/91770\n";
    if (notifyWecom && wecomWebhook !== '') {
      lua += 'WECOM_WEBHOOK = "' + escapeLuaString(wecomWebhook) + "\"\n";
    } else {
      lua += '-- WECOM_WEBHOOK = ""\n';
    }
    lua += "\n";

    // wecom 应用
    lua += "-- wecom 应用通知配置, https://developer.work.weixin.qq.com/document/path/90236\n";
    if (wecomCorpid !== '') {
      lua += 'WECOM_CORPID = "' + escapeLuaString(wecomCorpid) + "\"\n";
    } else {
      lua += '-- WECOM_CORPID = ""\n';
    }
    if (wecomCorpsecret !== '') {
      lua += 'WECOM_CORPSECRET = "' + escapeLuaString(wecomCorpsecret) + "\"\n";
    } else {
      lua += '-- WECOM_CORPSECRET = ""\n';
    }
    if (wecomAgentid > 0) {
      lua += 'WECOM_AGENTID = ' + wecomAgentid + "\n";
    } else {
      lua += '-- WECOM_AGENTID = 0\n';
    }
    if (wecomAppTouser !== '') {
      lua += 'WECOM_APP_TOUSER = "' + escapeLuaString(wecomAppTouser) + "\"\n";
    } else {
      lua += '-- WECOM_APP_TOUSER = ""\n';
    }
    if (wecomAppSafe > 0) {
      lua += 'WECOM_APP_SAFE = ' + wecomAppSafe + "\n\n";
    } else {
      lua += '-- WECOM_APP_SAFE = 0\n\n';
    }

    // pushover
    lua += "-- pushover 通知配置, https://pushover.net/api\n";
    if (pushoverApiToken !== '') {
      lua += 'PUSHOVER_API_TOKEN = "' + escapeLuaString(pushoverApiToken) + "\"\n";
    } else {
      lua += '-- PUSHOVER_API_TOKEN = ""\n';
    }
    if (pushoverUserKey !== '') {
      lua += 'PUSHOVER_USER_KEY = "' + escapeLuaString(pushoverUserKey) + "\"\n\n";
    } else {
      lua += '-- PUSHOVER_USER_KEY = ""\n\n';
    }

    // inotify
    lua += "-- inotify 通知配置, https://github.com/xpnas/Inotify 或者使用合宙提供的 https://push.luatos.org\n";
    if (inotifyApi !== '') {
      lua += 'INOTIFY_API = "' + escapeLuaString(inotifyApi) + "\"\n\n";
    } else {
      lua += '-- INOTIFY_API = ""\n\n';
    }

    // next-smtp-proxy
    lua += "-- next-smtp-proxy 通知配置, https://github.com/0wQ/next-smtp-proxy\n";
    if (nextSmtpApi !== '') {
      lua += 'NEXT_SMTP_PROXY_API = "' + escapeLuaString(nextSmtpApi) + "\"\n";
      lua += 'NEXT_SMTP_PROXY_USER = "' + escapeLuaString(nextSmtpUser) + "\"\n";
      lua += 'NEXT_SMTP_PROXY_PASSWORD = "' + escapeLuaString(nextSmtpPassword) + "\"\n";
      lua += 'NEXT_SMTP_PROXY_HOST = "' + escapeLuaString(nextSmtpHost) + "\"\n";
      lua += 'NEXT_SMTP_PROXY_PORT = ' + nextSmtpPort + "\n";
      lua += 'NEXT_SMTP_PROXY_FORM_NAME = "' + escapeLuaString(nextSmtpFormName) + "\"\n";
      lua += 'NEXT_SMTP_PROXY_TO_EMAIL = "' + escapeLuaString(nextSmtpToEmail) + "\"\n";
      lua += 'NEXT_SMTP_PROXY_SUBJECT = "' + escapeLuaString(nextSmtpSubject) + "\"\n\n";
    } else {
      lua += '-- NEXT_SMTP_PROXY_API = ""\n';
      lua += '-- NEXT_SMTP_PROXY_USER = ""\n';
      lua += '-- NEXT_SMTP_PROXY_PASSWORD = ""\n';
      lua += '-- NEXT_SMTP_PROXY_HOST = "smtp-mail.outlook.com"\n';
      lua += '-- NEXT_SMTP_PROXY_PORT = 587\n';
      lua += '-- NEXT_SMTP_PROXY_FORM_NAME = "Air724UG"\n';
      lua += '-- NEXT_SMTP_PROXY_TO_EMAIL = ""\n';
      lua += '-- NEXT_SMTP_PROXY_SUBJECT = "来自 Air724UG 的通知"\n\n';
    }

    // gotify
    lua += "-- gotify 通知配置, https://gotify.net/\n";
    if (gotifyApi !== '') {
      lua += 'GOTIFY_API = "' + escapeLuaString(gotifyApi) + "\"\n";
      lua += 'GOTIFY_TITLE = "' + escapeLuaString(gotifyTitle) + "\"\n";
      lua += 'GOTIFY_PRIORITY = ' + gotifyPriority + "\n";
      lua += 'GOTIFY_TOKEN = "' + escapeLuaString(gotifyToken) + "\"\n";
      lua += 'GOTIFY_CLIENT_TOKEN = "' + escapeLuaString(gotifyClientToken) + "\"\n\n";
    } else {
      lua += '-- GOTIFY_API = ""\n';
      lua += '-- GOTIFY_TITLE = "转发器"\n';
      lua += '-- GOTIFY_PRIORITY = 8\n';
      lua += '-- GOTIFY_TOKEN = ""\n';
      lua += '-- GOTIFY_CLIENT_TOKEN = ""\n\n';
    }

    // serverchan
    lua += "-- serverchan 通知配置\n";
    if (notifyServerchan) {
      lua += 'SERVERCHAN_TITLE = "' + escapeLuaString(serverchanTitle !== '' ? serverchanTitle : '来自 Air724UG 的通知') + "\"\n";
      lua += 'SERVERCHAN_API = "' + escapeLuaString(serverchanApi) + "\"\n\n";
    } else {
      lua += '-- SERVERCHAN_TITLE = "来自 Air724UG 的通知"\n';
      lua += '-- SERVERCHAN_API = ""\n\n';
    }

    // pushplus
    lua += "-- pushplus 通知配置\n";
    if (pushplusToken !== '') {
      lua += 'PUSHPLUS_TOKEN = "' + escapeLuaString(pushplusToken) + "\"\n";
    } else {
      lua += '-- PUSHPLUS_TOKEN = ""\n';
    }
    if (pushplusTitle !== '') {
      lua += 'PUSHPLUS_TITLE = "' + escapeLuaString(pushplusTitle) + "\"\n\n";
    } else {
      lua += '-- PUSHPLUS_TITLE = ""\n\n';
    }

    // wxpusher
    lua += "-- wxpusher 通知配置, https://wxpusher.zjiecode.com/\n";
    if (notifyWxpusher) {
      lua += 'WXPUSHER_APPTOKEN = "' + escapeLuaString(wxpusherAppToken) + "\"\n";
      lua += 'WXPUSHER_UIDS = "' + escapeLuaString(wxpusherUids) + "\"\n";
      lua += 'WXPUSHER_SUMMARY = "' + escapeLuaString(wxpusherSummary) + "\"\n";
      lua += 'WXPUSHER_CONTENT_TYPE = ' + wxpusherContentType + "\n\n";
    } else {
      lua += '-- WXPUSHER_APPTOKEN = ""\n';
      lua += '-- WXPUSHER_UIDS = ""\n';
      lua += '-- WXPUSHER_SUMMARY = "来自 Air724UG 的通知"\n';
      lua += '-- WXPUSHER_CONTENT_TYPE = 1\n\n';
    }

    // 其他系统配置
    lua += 'NUMBER = "' + escapeLuaString(number) + "\"\n";
    lua += '-- NUMBER = "13800000000"\n\n';

    lua += "-- 定时查询流量间隔, 单位毫秒, 设置为 0 关闭 (建议检查 util_mobile.lua 文件中运营商号码和查询流量代码是否正确, 以免发错短信导致扣费)\n";
    lua += 'QUERY_TRAFFIC_INTERVAL = ' + queryMs + "\n\n";

    lua += "-- 开机通知\n";
    lua += 'BOOT_NOTIFY = ' + bool(bootNotify) + "\n\n";

    lua += "-- 通知内容追加更多信息\n";
    lua += 'NOTIFY_APPEND_MORE_INFO = ' + bool(notifyAppendMore) + "\n\n";

    lua += "-- 通知最大重发次数\n";
    lua += 'NOTIFY_RETRY_MAX = ' + notifyRetryMax + "\n\n";

    // 发送语音消息配置
    lua += "-- 发送语音消息配置\n";
    lua += 'VOICE_SEND_ENABLE = ' + bool(voiceSendEnable) + "\n\n";

    // 录音上传配置
    lua += "-------------------------------------------------- 录音上传配置 --------------------------------------------------\n\n";
    lua += "-- 录音最长时间, 单位秒, 0-50\n";
    lua += 'RECORD_MAX_TIME = ' + recordMaxTime + "\n\n";

    lua += "-- 腾讯云 COS / 阿里云 OSS / AWS S3 等对象存储上传地址, 以下为腾讯云 COS 示例, 请自行修改\n";
    lua += "-- 存储桶需设置为: <私有读写>\n";
    lua += "-- 存储桶 Policy 权限: <用户类型: 所有用户> <授权资源: xxx-123456/{录音文件目录}/*> <授权操作: PutObject,GetObject>\n";
    lua += "-- 提示: 本项目未使用签名认证上传, 请勿泄露自己的地址及目录名\n";
    lua += "-- 当注释掉或者为空则不启用上传, 并且会将来电动作配置项覆盖为: 接听 -> 接听后挂断\n";
    if (uploadUrl !== '') {
      lua += 'UPLOAD_URL = "' + escapeLuaString(uploadUrl) + "\"\n\n";
    } else {
      lua += '-- UPLOAD_URL = "http://sg.1992418.xyz:9527/{录音文件目录}"\n\n';
    }

    // 短信 / 来电配置
    lua += "-------------------------------------------------- 短信来电配置 --------------------------------------------------\n\n";
    lua += "-- 允许发短信控制设备的号码, 如果注释掉或者为空, 则禁止所有号码, 短信格式示例:\n";
    lua += "-- 拨打电话 CALL,10086\n";
    lua += "-- 发送短信 SMS,10086,查询流量\n";
    lua += "-- 查询所有呼转状态 CCFC,?\n";
    lua += "-- 设置无条件呼转 CCFC,18888888888\n";
    lua += "-- 关闭所有呼转 CCFC,18888888888\n";
    lua += "-- 切换卡槽优先级 SIMSWITCH\n";
    lua += 'SMS_CONTROL_WHITELIST_NUMBERS = { ' + whitelistNumbersStr + " }\n\n";

    lua += "-- 扬声器 TTS 播放短信内容, 0:关闭(默认), 1:仅验证码, 2:全部\n";
    lua += 'SMS_TTS = ' + smsTts + "\n\n";

    lua += "-- 电话接通后 TTS 语音内容, 在播放完后开始录音, 如果注释掉或者为空则播放 audio_pickup_record.amr 或 audio_pickup_hangup.amr 文件\n";
    if (ttsText !== '') {
      lua += 'TTS_TEXT = "' + escapeLuaString(ttsText) + "\"\n";
    } else {
      lua += '-- TTS_TEXT = "您好，请在语音结束后留言，稍后将发送到机主，结束请挂机。"\n';
    }
    lua += "\n";

    lua += "-- 来电动作, 0:无操作, 1:自动接听(默认), 2:挂断, 3:自动接听后挂断, 4:等待30秒后自动接听\n";
    lua += "-- 无操作 / 等待30秒后自动接听, 可以长按 POWERKEY 来手动接听挂断电话\n";
    lua += 'CALL_IN_ACTION = ' + callInAction + "\n\n";

    // 其他配置
    lua += "-------------------------------------------------- 其他配置 --------------------------------------------------\n\n";
    lua += "-- 扬声器音量, 0-7\n";
    lua += 'AUDIO_VOLUME = ' + audioVolume + "\n\n";
    lua += "-- 通话音量 0-7\n";
    lua += 'CALL_VOLUME = ' + callVolume + "\n\n";
    lua += "-- 麦克风音量 0-7\n";
    lua += 'MIC_VOLUME = ' + micVolume + "\n\n";

    lua += "-- 开启 RNDIS 网卡\n";
    lua += 'RNDIS_ENABLE = ' + bool(rndisEnable) + "\n\n";

    lua += "-- 状态指示灯开关\n";
    lua += 'LED_ENABLE = ' + bool(ledEnable) + "\n\n";

    lua += "-- SIM 卡 pin 码\n";
    lua += 'PIN_CODE = "' + escapeLuaString(pinCode) + "\"\n";

    return lua;
  }

  // 从 <form> 收集字段为与 PHP $_POST 同结构的对象
  function collectForm(form) {
    const data = {};
    if (!form) return data;
    const elements = form.querySelectorAll('input, select, textarea');
    for (const el of elements) {
      const name = el.name || el.id;
      if (!name) continue;
      if (el.type === 'checkbox') {
        if (el.checked) data[name] = '1';
      } else if (el.type === 'radio') {
        if (el.checked) data[name] = el.value;
      } else {
        data[name] = el.value;
      }
    }
    return data;
  }

  const API = { buildLuaConfig, collectForm, escapeLuaString };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.ConfigBuilder = API;
  }
})(typeof window !== 'undefined' ? window : globalThis);
