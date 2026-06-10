// 测试 OSS 签名是否正确
// 用 node 模拟浏览器 fetch 行为

const crypto = require('crypto');

function base64Encode(data) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data instanceof Uint8Array ? data : Buffer.from(data, 'utf-8')).toString('base64');
  }
  return Buffer.from(data).toString('base64');
}

async function hmacSha1Base64(key, message) {
  return crypto.createHmac('sha1', key).update(message, 'utf-8').digest('base64');
}

async function signOSS(method, config, objectKey, extraHeaders = {}) {
  const ossDate = new Date().toUTCString();
  const contentType = extraHeaders['Content-Type'] || '';
  const encodedKey = encodeURIComponent(objectKey)
    .replace(/%2F/g, '/')
    .replace(/\+/g, '%20');
  const objectResource = `/${config.bucket}/${encodedKey}`;
  const stringToSign = [
    method,
    '',
    contentType,
    ossDate,
    '',
    objectResource,
  ].join('\n');
  console.log('StringToSign:');
  console.log(JSON.stringify(stringToSign));
  const signature = await hmacSha1Base64(config.accessKeySecret, stringToSign);
  const authorization = `OSS ${config.accessKeyId}:${signature}`;
  const url = `${config.endpoint}/${config.bucket}/${encodedKey}`;
  return { url, headers: { 'x-oss-date': ossDate, Authorization: authorization, ...extraHeaders } };
}

(async () => {
  // 这里请替换为你的真实 AccessKey / Bucket / Region
  const config = {
    endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
    bucket: 'your-bucket',
    accessKeyId: 'your-id',
    accessKeySecret: 'your-secret',
  };
  const { url, headers } = await signOSS('HEAD', config, 'focusflow-sync.json');
  console.log('\nURL:', url);
  console.log('Headers:', headers);

  // 用 node 18+ 内置 fetch
  try {
    const res = await fetch(url, { method: 'HEAD', headers });
    console.log('\nStatus:', res.status);
    console.log('x-oss-request-id:', res.headers.get('x-oss-request-id'));
    const text = await res.text();
    console.log('Body:', text);
  } catch (e) {
    console.log('Fetch error:', e.message);
  }
})();
