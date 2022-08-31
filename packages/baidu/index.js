//===Sharelist===
// @name         BaiduNetDisk
// @namespace    sharelist.plugin.baidu
// @version      1.0.0
// @license      MIT
// @description  Baidu Net Disk
// @author       reruin@gmail.com
// @supportURL   https://github.com/reruin/sharelist
// @updateURL    https://raw.githubusercontent.com/linkdrive/sharelist-plugin/master/packages/baidu/index.js
// @icon         https://nd-static.bdstatic.com/m-static/wp-brand/favicon.ico
//===/Sharelist==

const API = 'https://pan.baidu.com/rest/2.0/xpan'

const ERR_CODE = {
  0: '请求成功',
  2: '参数错误',
  '-6': '身份验证失败, access_token 是否有效? 部分接口需要申请对应的网盘权限',
  '-7': '文件或目录无权访问',
  '-9': '文件或目录不存在',
  31034: '命中接口频控',
  42000: '访问过于频繁',
  42211: '图片详细信息查询失败',
  42212: '共享目录文件上传者信息查询失败',
  42213: '共享目录鉴权失败',
  42214: '文件基础信息查询失败',
}

const DEFAULT_ROOT_ID = 'root'

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
  }

  createGetter(config) {
    return async () => {
      if (
        !(config.access_token && config.expires_at && config.expires_at - Date.now() > 5 * 60 * 1000)
      ) {
        await this.refreshAccessToken(config)
      }
      return {
        ...config
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
    console.log('refreshAccessToken')
    let { client_id, client_secret, redirect_uri, refresh_token, ...rest } = credentials

    if (!(client_id && client_secret && refresh_token)) {
      return this.app.error({ message: 'Invalid parameters: An error occurred during refresh access token' })
    }

    let formdata = {
      client_id: client_id.split('::')[0],
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
  // doc: https://pan.baidu.com/union/document/basic#%E8%8E%B7%E5%8F%96%E6%96%87%E4%BB%B6%E5%88%97%E8%A1%A8
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
}

module.exports = { driver: Driver }
