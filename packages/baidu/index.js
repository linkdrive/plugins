//===Sharelist===
// @name         BaiduNetDisk
// @namespace    sharelist.plugin.baidu
// @version      1.0.0
// @license      MIT
// @description  Baidu Net Disk
// @author       reruin@gmail.com
// @supportURL   https://github.com/reruin/sharelist
// @updateURL    https://raw.githubusercontent.com/linkdrive/plugins/master/packages/baidu/index.js
// @icon         https://nd-static.bdstatic.com/m-static/wp-brand/favicon.ico
//===/Sharelist==

// doc: https://pan.baidu.com/union/document/basic#%E8%8E%B7%E5%8F%96%E6%96%87%E4%BB%B6%E5%88%97%E8%A1%A8

const crypto = require('crypto')

const md5 = (v) => crypto.createHash('md5').update(v).digest('hex')

const API = 'https://pan.baidu.com/rest/2.0/xpan'

const UPLOAD_API = 'https://d.pcs.baidu.com/rest/2.0/pcs/superfile2?method=upload'

const ERR_CODE = {
  0: '请求成功',
  2: '参数错误',
  '-6': '身份验证失败, access_token 是否有效? 部分接口需要申请对应的网盘权限',
  '-7': '文件或目录名错误或无权访问',
  '-8': '件或目录已存在',
  '-9': '文件或目录不存在',
  '-10': '云端容量已满',
  '10': '创建文件的superfile失败',
  '31024': '没有申请上传权限',
  '31299': '第一个分片的大小小于4MB',
  '31364': '超出分片大小限制',
  31034: '命中接口频控',
  42000: '访问过于频繁',
  42211: '图片详细信息查询失败',
  42212: '共享目录文件上传者信息查询失败',
  42213: '共享目录鉴权失败',
  42214: '文件基础信息查询失败',
}

/*
  0 为不重命名，返回冲突
  1 为只要path冲突即重命名
  2 为path冲突且block_list不同才重命名
  3 为覆盖 
*/
const RTYPE = {
  0: 0,
  1: 1,
  2: 3
}


const DEFAULT_ROOT_ID = 'root'

const fakeMD5 = () => md5(`${Date.now()}.${Math.random()}`)
const encodePath = v => Buffer.from(encodeURIComponent(v)).toString('base64')

const decodePath = v => decodeURIComponent(Buffer.from(v, 'base64').toString('utf-8'))

const prestream = (readStream, size) => new Promise((resolve, reject) => {
  let buffer = [], count = 0

  const onEnd = () => {
    let head = Buffer.concat(buffer, count)
    let hash = md5(head.subarray(0, size))
    readStream.destroy()
    resolve(hash)
  }

  readStream.on('data', (chunk) => {
    buffer.push(chunk)
    count += chunk.length
    if (count >= size) {
      readStream.pause()
      onEnd()
    }
  })
})
/**
 * auth manager class
 */
class Manager {
  static getInstance(app, config) {
    if (!this.instance) {
      this.instance = new Manager(app)
    }

    return this.instance.createGetter(config)
  }

  constructor(app) {
    this.app = app
    this.keyMaps = {}
  }

  createGetter(config) {
    //May be public client_id
    let [basePart] = config.client_id.split('.')
    if (this.keyMaps[config.client_id]) {
      config.client_id = basePart + '.' + ('' + Math.random()).substring(2)
    }
    this.keyMaps[basePart] = 1
    return async () => {
      if (
        !(config.access_token && config.expires_at && config.expires_at - Date.now() > 5 * 60 * 1000)
      ) {
        await this.refreshAccessToken(config)
      }
      return {
        ...config,
        client_id: basePart
      }
    }
  }

  /**
   * 刷新令牌 / refresh token
   *
   * @param {object} credentials
   * @param {object} { credentials: object } | { error:true, message:string }
   * @api private
   */
  async refreshAccessToken(credentials) {
    let { client_id, client_secret, redirect_uri, refresh_token, ...rest } = credentials

    if (!(client_id && client_secret && refresh_token)) {
      return this.app.error({ message: 'Invalid parameters: An error occurred during refresh access token' })
    }

    let formdata = {
      client_id: client_id.split('.')[0],
      client_secret,
      // redirect_uri,
      refresh_token,
      grant_type: 'refresh_token',
    }

    let { data } = await this.app.request.get(`https://openapi.baidu.com/oauth/2.0/token`, { data: formdata })

    if (data.error) return this.app.error({ message: data.error_description || data.error })

    // expires_in 30 days
    let expires_at = data.expires_in * 1000 + Date.now()

    credentials.access_token = data.access_token
    credentials.refresh_token = data.refresh_token
    credentials.expires_at = expires_at

    // update meta
    let { data: res } = await this.app.request.get(`${API}/nas?method=uinfo?access_token=${credentials.refresh_token}`)

    if (!res.errno) {
      credentials.vipType = data.vip_type
    }

  }

}

// const getRealId = v => [v.split('/').pop().replace('@f', ''), v.endsWith('@f'), v.split('/').slice(0, -1).join('/')]

const getRealId = v => [v.split('/').pop().replace('~', ''), v.includes('~'), v.split('/').slice(0, -1).join('/')]

const fullpath = (basepath, subpath) => {
  return (basepath == '/' ? '' : basepath) + '/' + subpath
}

class Driver {
  static options = {
    protocol: "baidu",

    //支持全局搜索
    globalSearch: true,
    localSearch: false,

    key: 'client_id',
    defaultRoot: DEFAULT_ROOT_ID,

    hash: 'md5',
    uploadHash: 'md5_256k',

    guide: [
      { key: 'client_id', label: '应用ID / AppKey', type: 'string', required: true },
      { key: 'client_secret', label: '应用机密 / SecretKey', type: 'string', required: true },
      { key: 'redirect_uri', label: '回调地址 / Redirect URI', required: true },
      { key: 'refresh_token', label: '刷新令牌 / Refresh Token', type: 'string', required: true },
      { key: 'root_id', label: '初始文件夹ID', help: '', type: 'string', required: false },
      { key: 'access_token', label: '令牌', help: '', type: 'hidden', required: false },
      { key: 'expires_at', label: '有效期', help: '', type: 'hidden', required: false },
    ]
  }

  constructor(app, config) {
    this.app = app
    this.getConfig = Manager.getInstance(app, config)
  }
  /*
  async getOptions() {
    let { vipType } = await this.getConfig()
    // 会员类型，0普通用户、1普通会员、2超级会员
    let chunkSize = (['4', '16', '32'])[vipType || 0]
    return {
      'uploadHash': `md5_256k_${chunkSize}m`
    }
  }
*/
  /**
   * Lists or search files
   *
   * @param {string} [id] folder id  e.g. baidu://{key}/{id}?query
   * @param {object} [options] list options
   * @param {object} [options.sort] sort methods
   * @param {object} [options.search] search key
   * @return {object | error}
   *
   * @api public
   */
  async list(id, { search, orderBy, perPage, nextPage } = {}) {

    let [fid, isFile] = getRealId(id)

    if (isFile) {
      return []
    }

    let usePagination = !!perPage

    const { request } = this.app

    let { access_token } = await this.getConfig()

    let data = await this.meta(fid)
    let dir = data.extra.path || '/'
    if (data.type != 'folder') return []

    // perPage 1000 ~ 10000
    let start = nextPage || 0, limit = perPage || 1000, files = []

    do {
      let { data } = await request(`${API}/file`, {
        data: {
          method: 'list',
          access_token,
          dir,
          web: 'web',
          start,
          limit
        },
        contentType: 'json',
      })
      if (data.errno) return this.app.error({ message: ERR_CODE[data.errno] })
      data.list.forEach((i) => {
        let item = {
          id: id + '/' + (i.isdir ? '' : '~') + i.fs_id,
          name: i.server_filename,
          type: i.isdir ? 'folder' : 'file',
          size: parseInt(i.size),
          ctime: i.server_ctime * 1000,
          mtime: i.server_mtime * 1000,
          thumb: i.thumbs ? i.thumbs.url2 : '',
          extra: {
            fid: id + '/' + (i.isdir ? '' : '~') + i.fs_id,
            parent_id: id,
            path: i.path,
            md5: i.md5,
          },
        }

        files.push(item)
      })

      if (limit <= data.list.length) {
        start += limit
      } else {
        start = null
        break
      }
    } while (!usePagination && start)

    let result = {
      id, files
    }

    if (usePagination && start) {
      result.nextPage = start
    }

    return result
  }

  /**
  * get file
  *
  * @param {string} [id] id
  * @param {string} [key] key
  * @return {object}
  *
  * @api public
  */
  async get(id) {
    let [fid, isFile, parentId] = getRealId(id)

    let result = await this.meta(fid)

    if (result.type == 'file') {
      let { access_token } = await this.getConfig()
      // file.dlink 8 小时有效
      let { headers } = await this.app.request(`${result.extra.dlink}&access_token=${access_token}`, {
        followRedirect: false,
        headers: {
          'user-agent': 'pan.baidu.com',
        },
      })

      //http://xxxx.baidupcs.com/file  expires: 8h
      if (headers.location) {
        result.download_url = headers.location
        result.max_age = 8 * 3600 * 1000 - 60 * 1000
      }
    }

    if (result.download_url) {
      // 50M 以上，直接下载包 sign error, 使用中转
      if (result.size >= 50 * 1024 * 1024) {
        result.extra.proxy = {
          headers: {
            'user-agent': 'pan.baidu.com',
            'referer': 'https://pan.baidu.com'
          },
        }
      }
    }

    result.extra.parent_id = parentId

    return result
  }

  /**
   * 
   */
  async meta(id) {
    if (!id || id === DEFAULT_ROOT_ID) {
      return {
        id,
        type: 'folder',
        extra: {
          path: '/'
        }
      }
    }

    const { request } = this.app

    let { access_token } = await this.getConfig()

    let { data } = await request(`${API}/multimedia`, {
      data: {
        method: 'filemetas',
        access_token,
        fsids: `[${id}]`,
        dlink: 1,
      },
    })

    if (data.errno) return this.app.error({ message: ERR_CODE[data.errno] })

    let file = data.list[0]
    let result = {
      id,
      name: file.filename,
      type: file.isdir ? 'folder' : 'file',
      size: parseInt(file.size),
      ctime: file.server_ctime * 1000,
      mtime: file.server_mtime * 1000,
      thumb: file.thumbs ? file.thumbs.url2 : '',
      extra: {
        fid: file.fs_id,
        path: file.path,
        md5: file.md5,
        dlink: file.dlink
      },
    }

    return result
  }
  /**
   * create folder
   *
   * @param {string} [parent_id] folder id
   * @param {string} [name] folder name
   * @param {object} [options] options
   * @param {object} [options.check_name_mode] 
   * @return {object}
   *
   * @api public
   */
  async mkdir(parent_id, name, { check_name_mode = 'refuse' }) {
    let [id, isFile] = getRealId(parent_id)

    let filedata = await this.meta(id)

    let { access_token } = await this.getConfig()
    let { data } = await this.app.request.post(`${API}/file?method=create&access_token=${access_token}`, {
      data: {
        isdir: 1,
        size: 0,
        path: fullpath(filedata.extra.path, name)
      },
      contentType: 'form',
    })

    if (data.errno) return this.app.error({ message: ERR_CODE[data.errno] })

    return {
      id: (parent_id ? `${parent_id}/` : '') + data.fs_id,
      name: data.server_filename,
      parent_id
    }
  }


  /**
   * rename file/folder
   *
   * @param {string} [id] folder id
   * @param {string} [name] new name
   * @return {object}
   *
   * @api public
   */
  async rename(id, name, { check_name_mode = 'refuse' } = {}) {

    let [fid, isFile, parent_id] = getRealId(id)

    let filedata = await this.meta(fid)

    let { access_token } = await this.getConfig()
    let { data } = await this.app.request.post(`${API}/file?method=filemanager&access_token=${access_token}&opera=rename`, {
      data: {
        async: 0,
        filelist: [{ path: filedata.extra.path, newname: name }],
        ondup: 'fail'
      },
      contentType: 'form',
    })

    // console.log(data, {
    //   async: 0,
    //   filelist: JSON.stringify([{ path: filedata.extra.path, newname: name }]),
    // })
    if (data.errno) return this.app.error({ message: ERR_CODE[data.errno] })

    return {
      id: id,
      name: name,
      parent_id
    }
  }

  /**
   * rm file/folder
   *
   * @param {string} [id] folder id
   * @return {object}
   *
   * @api public
   */
  async rm(id) {
    let [fid, isFile, parent_id] = getRealId(id)

    let filedata = await this.meta(fid)

    let { access_token } = await this.getConfig()
    let { data } = await this.app.request.post(`${API}/file?method=filemanager&access_token=${access_token}&opera=delete`, {
      data: {
        filelist: [filedata.extra.path],
      },
      contentType: 'form',
    })

    if (data.errno) return this.app.error({ message: ERR_CODE[data.errno] })

    return { id, name: filedata.name, parent_id }
  }

  /**
   * mv file/folder
   *
   * @param {string} [id] file/folder id
   * @param {string} [target_id] folder id
   * @return {string | error}
   *
   * @api public
   */
  async mv(id, target_id) {
    let [fid, isFile, parent_id] = getRealId(id)

    let [target_fid] = getRealId(target_id)

    let { access_token } = await this.getConfig()

    let filedata = await this.meta(fid)

    let targetData = await this.meta(target_fid)

    let { data } = await this.app.request.post(`${API}/file?method=filemanager&access_token=${access_token}&opera=move`, {
      data: {
        filelist: [{ path: filedata.extra.path, dest: targetData.extra.path }],
      },
      contentType: 'form',
    })

    if (data.errno) return this.app.error({ message: ERR_CODE[data.errno] })

    let newId = target_id + '/' + id.split('/').pop()

    return { id: newId, parent_id }
  }

  async beforeUpload(taskId, { id, name, size, rtype, hash, filepath, UPLOAD_PART_SIZE }) {
    let { access_token } = await this.getConfig()
    let { app } = this

    // baidu pan 没有进度查询接口,直接计算未上传部分
    if (taskId) {
      let [uploadId, path, partStart, partSize] = taskId.split('|')
      partSize = parseInt(partSize)
      let len = Math.ceil(size / partSize)
      let partsList = new Array(len - partStart).fill(0).map((i, idx) => idx + parseInt(partStart))
      console.log(uploadId, partsList, partSize)
      return { uploadId, partsList, path: decodePath(path), partSize }
    }

    let { md5, head, parts } = hash

    //实测不会 合并分片时 不会校验切片MD5
    if (!parts?.length) {
      parts = new Array(Math.ceil(size / UPLOAD_PART_SIZE)).fill(md5 || fakeMD5())
    }

    const params = {
      path: filepath,
      size,
      isdir: 0,
      autoinit: 1,
      rtype,

      block_list: parts,
    }
    if (head) {
      params['slice-md5'] = head
    }
    if (md5) {
      params['content-md5'] = md5
    }
    console.log('params', params)
    let { data } = await app.request.post(`${API}/file?method=precreate&access_token=${access_token}`, {
      data: params,
      contentType: 'form',
    })
    if (data.errno) return this.app.error({ message: ERR_CODE[data.errno] })

    if (!data.path) data.path = filepath

    return { ...data, uploadId: data.uploadid, partsList: data.block_list }

  }

  async afterUpload({ uploadId, path, rtype, size, hash, partsMD5 }) {
    let { access_token } = await this.getConfig()

    let { data } = await this.app.request.post(`${API}/file?method=create&access_token=${access_token}`, {
      data: {
        path,
        size,
        rtype,
        isdir: 0,
        uploadid: uploadId,
        block_list: partsMD5
      },
      contentType: 'form',
    })

    if (data.errno) return this.app.error({ message: ERR_CODE[data.errno] })

    return data
  }

  async upload(id, stream, { size, name, manual, conflictBehavior, hash, hash_type, state, ...rest }) {
    const app = this.app

    let [fid, isFile, parent_id] = getRealId(id)

    let filedata = await this.meta(fid)

    let filepath = fullpath(filedata.extra.path, name)

    let { access_token, vipType } = await this.getConfig()

    let UPLOAD_PART_SIZE = (vipType == 0 ? 4 : vipType == 1 ? 16 : vipType == 2 ? 32 : 4) * 1024 * 1024

    let rtype = RTYPE[conflictBehavior] || 1

    // 仅当存在md5 时，获取 slice-content hash 用于快速校验
    if (!hash.head && hash.md5) {
      hash.head = await prestream((typeof stream == 'function') ? await stream(0) : stream, 256 * 1024)
    }

    let { uploadId, partsList, path, info, return_type, partSize } = await this.beforeUpload(state?.uploadId, { id, name, size, hash, hash_type, rtype, filepath, UPLOAD_PART_SIZE })
    //上传期间用户会员等级发生变化，当从高级降到普通时，分片大小将无法兼容
    if (partSize) {
      if (partSize <= UPLOAD_PART_SIZE) {
        UPLOAD_PART_SIZE = partSize
      } else {
        return this.app.error({ message: ERR_CODE['31364'] })
      }
    }

    let pathId = encodePath(path)

    // file exists
    if (return_type == 2) {
      return {
        id: (parent_id ? `${parent_id}/` : '') + info.fs_id,
        name: name,
        parent_id,
        completed: true,
      }
    }

    let start = partsList[0] * UPLOAD_PART_SIZE

    if (!stream) {
      return { uploadId: [uploadId, pathId, partsList[0], UPLOAD_PART_SIZE].join('|'), start }
    }

    let readStream = (typeof stream == 'function') ? await stream(start) : stream

    let passStream = app.streamReader(readStream, { highWaterMark: 2 * UPLOAD_PART_SIZE })

    let partsMD5 = (state?.partsMD5 || [])

    for (let part of partsList) {
      rest.setState?.({ uploadId: [uploadId, pathId, part, UPLOAD_PART_SIZE].join('|'), partsMD5 })

      let partUploadUrl = UPLOAD_API + `&access_token=${access_token}&type=tmpfile&path=${encodeURIComponent(path)}&uploadid=${uploadId}&partseq=${part}`

      let chunk = await passStream.read(UPLOAD_PART_SIZE)

      let res

      let retryTimes = 3

      while (retryTimes-- > 0) {
        res = await app.request(partUploadUrl, {
          // TODO 文档要求使用POST，会触发 { error_code: 31208, error_msg: 'content_type error' } 
          // 实测应为 PUT !
          method: 'put',
          data: chunk,
          contentType: 'buffer',
          signal: rest.signal,
        })
        if (res.data.errno) {
          await sleep(app.utils.retryTime(3 - retryTimes))
          continue
        } else {
          partsMD5.push(res.data.md5)
          break
        }
      }
      // console.log(res.data)
      if (res.data.errno) return this.app.error({ message: ERR_CODE[res.data.errno] })
    }

    let res = await this.afterUpload({ uploadId, path, rtype, size, partsMD5, uploadId, hash })

    return {
      id: (parent_id ? `${parent_id}/` : '') + res.fs_id,
      name: res.server_filename || name,
      parent_id
    }
  }

}

module.exports = { driver: Driver }
