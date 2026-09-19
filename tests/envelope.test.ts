import { describe, it, expect } from 'vitest'
import { packSyncPayload, unpackSyncPayload, __testing } from '@/lib/sync/envelope'

const sample = {
  tasks: [{ id: 't1', title: '压缩与加密', done: false }],
  meta: { version: 1, note: '中文与 emoji 🎉' },
}

describe('packSyncPayload / unpackSyncPayload', () => {
  it('两个选项都关闭时保持旧版明文格式', async () => {
    const raw = JSON.parse(await packSyncPayload(sample, { compress: false, encrypt: false }))
    expect(raw.v).toBeUndefined()
    expect(raw.data).toEqual(sample)
    expect(typeof raw.updatedAt).toBe('string')
    const restored = await unpackSyncPayload(raw)
    expect(restored).toEqual(sample)
  })

  it('仅压缩：v2 gzip 信封往返', async () => {
    const packed = await packSyncPayload(sample, { compress: true, encrypt: false })
    const env = JSON.parse(packed)
    expect(env.v).toBe(2)
    expect(env.comp).toBe('gzip')
    expect(env.enc).toBe('none')
    expect(await unpackSyncPayload(env)).toEqual(sample)
  })

  it('压缩+加密：AES-256-GCM 往返且密文不含明文', async () => {
    const packed = await packSyncPayload(sample, { compress: true, encrypt: true, passphrase: 'correct horse' })
    expect(packed).not.toContain('压缩与加密')
    const env = JSON.parse(packed)
    expect(env.enc).toBe('aes-256-gcm')
    expect(env.salt).toBeTruthy()
    expect(env.iv).toBeTruthy()
    expect(await unpackSyncPayload(env, 'correct horse')).toEqual(sample)
  })

  it('Date 值在明文压缩路径中序列化为 ISO 字符串', async () => {
    const withDate = { due: new Date('2026-01-02T03:04:05.000Z') }
    const packed = await packSyncPayload(withDate, { compress: true, encrypt: false })
    const env = JSON.parse(packed)
    expect(await unpackSyncPayload(env)).toEqual({ due: '2026-01-02T03:04:05.000Z' })
  })

  it('开启加密但未填口令时打包抛错', async () => {
    await expect(packSyncPayload(sample, { compress: false, encrypt: true })).rejects.toThrow('未填写同步口令')
  })

  it('已加密数据缺少口令或口令错误时解包抛错', async () => {
    const env = JSON.parse(await packSyncPayload(sample, { compress: false, encrypt: true, passphrase: 'pw-1' }))
    await expect(unpackSyncPayload(env)).rejects.toThrow('请在同步设置中填写同步口令')
    await expect(unpackSyncPayload(env, 'pw-2')).rejects.toThrow()
  })

  it('不支持的加密算法与畸形输入被安全处理', async () => {
    await expect(unpackSyncPayload({ v: 2, comp: 'none', enc: 'aes-128-cbc', data: '' })).rejects.toThrow('不支持的加密算法')
    expect(await unpackSyncPayload(null)).toBeNull()
    expect(await unpackSyncPayload('string')).toBeNull()
    expect(await unpackSyncPayload({ updatedAt: 'x' })).toBeNull()
  })

  it('gzip 原语可用时压缩产物确实变小且可逆', async () => {
    expect(__testing.supportsGzip()).toBe(true)
    const bytes = new TextEncoder().encode('a'.repeat(5000))
    const gz = await __testing.gzipBytes(bytes)
    expect(gz.length).toBeLessThan(bytes.length)
    const back = await __testing.gunzipBytes(gz)
    expect(new TextDecoder().decode(back)).toBe('a'.repeat(5000))
  })
})
