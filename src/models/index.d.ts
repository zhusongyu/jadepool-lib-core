import mongoose from 'mongoose'

interface Rule {
  action: string
  permission: '' | 'r' | 'rw'
}

interface KeyData {
  category: 'ecc'
  key: string
  encode: string
}

export declare interface AppDocument extends mongoose.Document {
  /** 唯一ID */
  id: string
  /** 应用描述 */
  desc?: string
  /** RESTFUL权限 */
  resouces: Rule[]
  /** 验签公钥 */
  accepts: KeyData[]
  /** 回调地址 */
  callbacks: Object
  /** 额外信息 */
  data: Object
  /**
   * 验证是否具有某权限
   * @param action 权限名
   * @param permission 权限类型
   */
  checkPermission (action: string, permission: '' | 'r' | 'rw'): boolean
  /**
   * 返回全部可接受的公钥
   */
  getPublicKeys (): Buffer[]
  /**
   * 获取category对应的callback url
   * @param category
   */
  getCallbackUrl (category: string): string | undefined
  /**
   * 获取App参数
   * @param path
   */
  getData (path: string): string
}
