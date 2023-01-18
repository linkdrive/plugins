//===Sharelist===
// @name         AliyunDrive
// @namespace    sharelist.plugin.aliyundrive
// @version      1.0.0
// @license      MIT
// @description  Aliyun Drive
// @author       reruin@gmail.com
// @supportURL   https://github.com/reruin/sharelist
// @updateURL    https://raw.githubusercontent.com/linkdrive/plugins/master/packages/aliyundrive/index.js
// @icon         data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTIyLjAzNTUgMTMuODA2MUMyMS43NjQ2IDEzLjczMzggMjEuNTkxIDEzLjQ2MjEgMjEuNjUxNSAxMy4xODlDMjIuODc4MSA3LjU1NjU1IDE5LjQ1MDkgMS44Nzk1MSAxMy44MDU1IDAuMzcxOTc5QzcuOTk5NTEgLTEuMTc4NDQgMi4wMDgzNyAyLjI2MDA0IDAuNDM5MTc3IDguMDM5MDhDMC40Mzg1MzUgOC4wNDE0NyAwLjQzNzg5MiA4LjA0Mzg2IDAuNDM2NjA4IDguMDQ4NjNDMC40MzUzMjMgOC4wNTM0MSAwLjQzMzM5NyA4LjA2MDU4IDAuNDMyMTEyIDguMDY1MzZDLTAuNTIzMzgxIDExLjY0NzggMC4xMTY1MSAxNS40MDI5IDIuMjQ0NjcgMTguNTA1N0MzLjcyNzEzIDIwLjY2NTUgNS44NjcwNCAyMi4zMTk5IDguMzMwOTEgMjMuMjE4NUMxNS4yMTgyIDI1LjcyNTkgMjIuNjMzNiAyMS45Njg4IDI0LjgyNTUgMTUuMjVDMjQuOTM5NyAxNC45MDE2IDI0LjczNDcgMTQuNTI2OSAyNC4zNzc1IDE0LjQzMTVMMjIuMDM1NSAxMy44MDYxWk0xMC41OTQyIDE5LjI2MzNDOC40Nzk4NyAxOC42OTg3IDYuNzEyODggMTcuMzQ4NyA1LjYyMDE4IDE1LjQ1OTRDNC41MjY4MyAxMy41NzI1IDQuMjM1NzEgMTEuMzc3NSA0Ljc5OTExIDkuMjcyNDdDNS43MzQ3NyA1LjgzMDYyIDkuMzAxNzUgMy43ODI2NiAxMi43NjA5IDQuNzA2MzhDMTYuMDQ1IDUuNTgzMzcgMTguMDY4NSA4LjgyNzIxIDE3LjQ4MDYgMTIuMTAzM0MxNy40MjYgMTIuNDExNCAxNy42MSAxMi43MTE0IDE3LjkxNDQgMTIuNzkyN0wyMC4xMTk4IDEzLjM4MTZDMjAuNDAwMyAxMy40NTY1IDIwLjU1NzMgMTMuNzUxOSAyMC40NjM2IDE0LjAyMzhDMTkuMDgzNSAxOC4wNDg1IDE0Ljc3NDkgMjAuMzc5NyAxMC41OTQyIDE5LjI2MzNaIiBmaWxsPSJyZ2IoMTAzLDEyNSwyMzgpIj48L3BhdGg+PC9zdmc+
//===/Sharelist==


const UPLOAD_PART_SIZE = 10 * 1024 * 1024

const API_ENDPOINT = 'https://api.aliyundrive.com'

const DEFAULT_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36`

const REFERER = `https://www.aliyundrive.com/`

const atob = v => Buffer.from(v, 'base64').toString()

const isMobileToken = (access_token) => {
  try {
    return !JSON.parse(JSON.parse(atob(access_token.split('.')[1])).customJson).ref
  } catch (e) {

  }
  return false
}

const replaceCDNUrl = (url) => {
  return url.replace(/https:\/\/([\w\W]+?)\./, (_, srv) => `https://${srv}-enet.`)
}

/**
 * auth manager class
 */
class Manager {
  static getInstance(app, config) {
    if (!this.instance) {
      this.instance = new Manager(app)
    }

    // this.instance.add(config)
    const getter = this.instance.createGetter(config)

    // lazy load config
    // getter()

    return getter
  }

  constructor(app) {
    this.app = app
  }

  createGetter(config) {
    let DRIVE_KEY = this.app.DRIVE_KEY

    if (!config[DRIVE_KEY] && config.user_id) {
      config[DRIVE_KEY] = config.user_id
    }

    return async () => {
      if (
        !config.user_id ||
        !(config.access_token && config.expires_at && config.expires_at - Date.now() > 5 * 60 * 1000)
      ) {
        await this.refreshAccessToken(config)
      }
      if (!config[DRIVE_KEY]) {
        config[DRIVE_KEY] = config.user_id
      }

      return {
        ...config
      }
    }
  }


  /**
   * refreshAccessToken
   *
   * @param {object} options
   * @param {string} options.refresh_token
   * @return {object} [credentials]
   * @api private
   */
  async refreshAccessToken(config) {
    let { refresh_token: lastRefeshToken } = config
    //TODO: Web client API CAN NOT support mobile token
    // https://auth.aliyundrive.com/v2/account/token
    // mobile: ${API_ENDPOINT}/v2/account/token
    // web: ${API_ENDPOINT}/token/refresh
    let { data, headers } = await this.app.request.post(`${API_ENDPOINT}/v2/account/token`, {
      data: {
        refresh_token: lastRefeshToken,
        grant_type: "refresh_token"
      },
      headers: {
        'User-Agent': 'None',
      },
      contentType: 'json',
    })
    if (data && !data.access_token) {
      throw new Error({ message: data.message || 'An error occurred during refresh access token' })
    }
    let { user_id, access_token, default_drive_id: drive_id, expires_in, refresh_token, device_id } = data

    // expires_in 7200s
    let expires_at = Date.now() + expires_in * 1000

    config.user_id = user_id
    config.refresh_token = refresh_token
    config.access_token = access_token
    config.expires_at = expires_at
    config.drive_id = drive_id
    config.token_type = isMobileToken(access_token) ? 'mobile' : 'web'
    config.device_id = device_id

    // key 内部属性, 区分不同挂载盘
    if (!config.key) {
      config.key = user_id
    }
  }
}

class Driver {
  static options = {
    protocol: "aliyun",

    //支持全局搜索
    globalSearch: true,
    localSearch: false,

    hash: 'sha1',
    uploadHash: 'sha1',
    // key: 'user_id',
    defaultRoot: 'root',

    guide: [
      { key: 'refresh_token', label: 'Refresh Token', type: 'string', required: true },
      {
        key: 'root_id',
        label: '初始文件夹ID / Root ID',
        help: 'https://www.aliyundrive.com/drive/folder/xxxxxxxxxxx 地址中 xxxx 的部分',
        type: 'string',
      },
    ]
  }

  constructor(app, config) {
    this.app = app
    this.getConfig = Manager.getInstance(app, config)

  }
  /**
   * list files
   *
   * @param {string} [id] folder id
   * @param {object} [options] list options
   * @param {object} [options.sort] sort methods
   * @param {object} [options.search] search
   * @return {object}
   *
   * @api public
   */
  async list(id, { search, orderBy, perPage, nextPage }) {

    const {
      request,
      utils: { timestamp },
    } = this.app

    let { drive_id, access_token, device_id } = await this.getConfig()

    let isSearch = !!search

    let usePagination = !!perPage

    let url = `${API_ENDPOINT}/adrive/v3/file/${isSearch ? 'search' : 'list'}`
    let params = isSearch ? {
      drive_id,
      limit: 100, // max 100
      query: `name match \"${search}\"`,
      order_by: "updated_at DESC"
    } : {
      drive_id,
      parent_file_id: id,
      limit: 200,
      fields: "*",
      url_expire_sec: 1600
    }

    if (orderBy) {
      let [sortKey, isASC] = orderBy
      if (isSearch) {
        params.order_by = `${sortKey || 'name'} ${isASC ? 'ASC' : 'DESC'}`
      } else {
        params.order_by = sortKey || 'name'
        params.order_direction = isASC ? 'ASC' : 'DESC'
      }
    }

    let marker = nextPage, files = []

    do {
      let { data } = await request.post(url, {
        data: { ...params, ...(marker ? { marker } : {}) },

        headers: {
          Authorization: access_token,
          'user-agent': DEFAULT_UA,
          'x-canary': 'client=web,app=adrive,version=v3.6.1',
          'x-device-id': device_id,
          'referer': REFERER
        },
        contentType: 'json',
      })

      // if (!data.items) return { error: { message: 'An error occurred when list folder' } }
      if (data.error) return data

      if (!data.items) return this.app.error({ message: data.message })

      for (let i of data.items) {
        files.push({
          id: i.file_id,
          name: i.name,
          type: i.type == 'folder' ? 'folder' : 'file',
          size: i.size,
          ctime: timestamp(i.created_at),
          mtime: timestamp(i.updated_at),
          download_url: i.url,
          extra: {
            fid: i.file_id,
            parent_id: i.parent_file_id,
            sha1: i.content_hash
          },
        })
      }

      marker = data.next_marker
    } while (!usePagination && marker)


    let result = {
      id, files
    }

    if (usePagination && marker) {
      result.nextPage = marker
    }

    return result
  }

  /**
   * get file
   *
   * @param {string} [file_id] folder/file id
   * @return {object}
   *
   * @api public
   */
  async get(file_id) {
    const {
      request,
      utils: { timestamp },
    } = this.app

    let { drive_id, access_token } = await this.getConfig()

    let { data } = await request.post(`${API_ENDPOINT}/v2/file/get`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        drive_id,
        file_id,
      },
      contentType: 'json',
    })

    if (data.error) return data.error
    let result = {
      id: data.file_id,
      name: data.name,
      type: data.type,
      size: data.size,
      ctime: timestamp(data.created_at),
      mtime: timestamp(data.updated_at),
      download_url: data.download_url,
      extra: {
        fid: data.file_id,
        parent_id: data.parent_file_id,
      },
    }




    if (result.type == 'file') {
      // if (data.category == 'video') {
      //   let sources = await this.video_preview(access_token, id, drive_id)
      //   result.extra.category = 'video'
      //   if (sources.length) {
      //     result.extra.sources = sources
      //   }
      // }

      if (!result.download_url) {
        let res = await this.get_download_url(file_id)
        result.download_url = res.url
      } else {
        // result.download_url = replaceCDNUrl(result.download_url)
      }

      //The referer needs to be verified when using web refresh_token
      if (result.download_url?.includes('x-oss-additional-headers=referer')) {
        result.extra.proxy = {
          headers: {
            referer: REFERER,
            //'user-agent': 'SmartDrive/24732503 CFNetwork/1331.0.7 Darwin/21.4.0'
          },
        }
      }
      let expired_at = +(result.download_url.match(/x\-oss\-expires=(\d+)/)?.[1] || 0) * 1000

      // The download link will expire after 15 minutes.
      result.max_age = expired_at - Date.now()
    } else {
      result.max_age = 1 * 3600 * 1000
    }

    return result
  }

  async get_path(file_id) {
    let { drive_id, access_token } = await this.getConfig()
    const { request } = this.app

    try {
      let { data } = await request.post(`${API_ENDPOINT}/adrive/v1/file/get_path`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        data: {
          drive_id,
          file_id,
        },
        contentType: 'json',
      })

      return data?.items || []
    } catch (e) {
    }
  }

  /**
   * get download url
   *
   * @param {string} [file_id] file id
   * @return {object}
   *
   * @api public
   */
  async get_download_url(file_id) {
    let { drive_id, access_token } = await this.getConfig()
    const { request } = this.app

    try {
      let { data } = await request.post(`${API_ENDPOINT}/v2/file/get_download_url`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        data: {
          drive_id,
          file_id,
        },
        contentType: 'json',
      })

      const ret = { url: data?.cdn_url || data?.url, size: data.size, max_age: new Date(data.expiration).getTime() - Date.now() }
      if (ret.url?.includes('x-oss-additional-headers=referer')) {
        ret.proxy = {
          headers: {
            referer: REFERER,
          },
        }
      }
      return ret
    } catch (e) {
      return {}
    }
  }

  /**
   * create folder
   *
   * @param {string} [id] folder id
   * @param {string} [name] folder name
   * @param {object} [options] options
   * @param {object} [options.check_name_mode] 
   * @return {object}
   *
   * @api public
   */
  async mkdir(parent_file_id, name, { check_name_mode = 'refuse' }) {
    let { drive_id, access_token } = await this.getConfig()

    let { data } = await this.app.request.post(`${API_ENDPOINT}/adrive/v2/file/createWithFolders`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        drive_id,
        parent_file_id,
        name,
        type: 'folder',
        check_name_mode,
      },
      contentType: 'json',
    })

    if (data.error) return data.error

    return {
      id: data.file_id,
      name,
      parent_id: parent_file_id
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
  async rename(file_id, name, { check_name_mode = 'refuse' } = {}) {
    let { drive_id, access_token } = await this.getConfig()

    let { data, status } = await this.app.request.post(`${API_ENDPOINT}/v3/file/update`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        drive_id,
        file_id,
        name,
        check_name_mode,
      },
      contentType: 'json',
    })

    if (data.code) {
      if (data.code === 'AlreadyExist.File') {
        return this.app.error({ code: 409 })
      } else {
        return this.app.error(data)
      }
    }

    return {
      id: data.file_id,
      name: data.name,
      parent_id: data.parent_file_id
    }
  }

  /**
   * remove file/folder
   *
   * @param {string} [id] folder id
   * @return {string}
   *
   * @api public
   */
  async rm(file_id) {
    let { drive_id, access_token } = await this.getConfig()

    let { data } = await this.app.request.post(`${API_ENDPOINT}/v2/batch`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        "requests":
          [{ "body": { drive_id, file_id }, "headers": { "Content-Type": "application/json" }, "id": file_id, "method": "POST", "url": "/recyclebin/trash" }],
        "resource": "file"
      }
      ,
      contentType: 'json',
    })

    if (data.code) {
      return this.app.error(data)
    }

    return { id: file_id }
  }


  /**
   * mv file/folder
   *
   * @param {string} [file_id] folder id
   * @param {string} [target_id] folder id
   * @return {string | error}
   *
   * @api public
   */
  async mv(file_id, target_id, options = {}) {
    if (options.copy) {
      throw { code: 501, message: "Not implemented" }
    }

    let { drive_id, access_token } = await this.getConfig()

    let { data } = await this.app.request.post(`${API_ENDPOINT}/v3/batch`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        "requests":
          [
            {
              "body": { drive_id, file_id, to_drive_id: drive_id, to_parent_file_id: target_id },
              "headers": { "Content-Type": "application/json" },
              "id": file_id,
              "method": "POST",
              "url": "/file/move"
            }],
        "resource": "file"
      }
      ,
      contentType: 'json',
    })

    if (data.code) {
      return this.app.error(data)
    }

    if (options.name) {
      await this.rename(file_id, options.name)
    }

    return { id: file_id }
  }

  /**
   * upload file
   *
   * @param {string} [id] folder id
   * @param {object} [options] upload file meta
   * @param {ReadableStream} [options.stream] upload file stream
   * @param {number} [options.size] upload file size
   * @param {string} [options.name] upload file name
   * @param {string} [options.sha1] file sha1 hash
   * @param {string} [options.taskId] task id
   * @return {object}
   *
   * @api public
   */
  async upload(id, stream, { size, name, uploadId, conflictBehavior, ...rest }) {
    const { app } = this

    let res = await this.beforeUpload(uploadId, { id, name, size, ...rest })

    let { file_id, upload_id, file_name, rapid_upload, start = 0 } = res

    uploadId = upload_id + '-' + file_id + '-1'

    if (rapid_upload) {
      return {
        id: file_id,
        name: file_name,
        parent_id: id,
        completed: true,
      }
    }

    if (!stream) {
      return { uploadId, start }
    }


    let readStream = (typeof stream == 'function') ? await stream(start, { uploadId }) : stream

    let uploadParts = res.part_info_list
    let passStream = app.streamReader(readStream, { highWaterMark: 2 * UPLOAD_PART_SIZE })
    for (let part of uploadParts) {
      let uploadUrl = part.upload_url
      rest.setState?.({ uploadId: upload_id + '-' + file_id + '-' + part.part_number })

      let chunk = await passStream.read(UPLOAD_PART_SIZE)
      let headers = {
        'Referer': REFERER,
        'Origin': 'https://www.aliyundrive.com',
        'User-Agent': DEFAULT_UA,
        'Content-Type': ''
      }

      headers['Content-Length'] = chunk.length

      let res = await app.request(uploadUrl, {
        method: 'put',
        data: chunk,
        contentType: 'buffer',
        responseType: 'text',
        headers
      })
      if (res.status != 200) {
        let message = res.data.match(/<Code>([\w\W]+?)<\/Code>/)?.[1] || 'unknown'
        return this.app.error({ message: 'An error occurred during upload: ' + message })
      }
    }

    await this.afterUpload(file_id, upload_id)

    return { id: file_id, name: file_name, parent_id: id }

  }

  async haveSameFile(parent_id, name, size) {
    try {
      let files = this.list(parent_id, {})
      return files.find(i => i.name === name && i.size === size)
    } catch (e) {

    }
    return false
  }

  async beforeUpload(uploadId, { id, name, size, conflictBehavior, hash, ...rest } = { conflictBehavior: 1 }) {
    let { drive_id, access_token } = await this.getConfig()
    //resume upload progress
    let partCount = Math.ceil(size / UPLOAD_PART_SIZE)

    if (uploadId) {
      let [taskId, fileId, partNumber] = uploadId.split('-')
      partNumber = partNumber ? +partNumber : 1

      const partList = new Array(partCount - partNumber + 1).fill(0).map((i, idx) => ({ part_number: idx + partNumber }))

      let { data } = await this.app.request.post(`${API_ENDPOINT}/v2/file/get_upload_url`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        data: {
          drive_id,
          upload_id: taskId,
          file_id: fileId,
          part_info_list: partList
        },
        signal: rest.signal,
        contentType: 'json',
      })

      if (data) {
        data.start = (partNumber - 1) * UPLOAD_PART_SIZE
        return data
      }
    }

    const partList = new Array(Math.ceil(size / UPLOAD_PART_SIZE)).fill(0).map((i, idx) => ({ part_number: idx + 1 }))

    const checkNameMap = {
      0: 'fail',
      1: 'auto_rename',
      2: 'overwrite'
    }
    let params = {
      parent_file_id: id,
      drive_id,
      name,
      size,
      type: "file",
      check_name_mode: checkNameMap[conflictBehavior],
      part_info_list: partList,
    }

    if (hash?.sha1) {
      params.pre_hash = hash.sha1.toUpperCase()
    }
    let { data } = await this.app.request.post(`${API_ENDPOINT}/adrive/v2/file/createWithFolders`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: params,
      contentType: 'json',
    })
    if (data.code) {
      return this.app.error(data)
    }

    return data
  }

  async afterUpload(file_id, upload_id) {
    let { drive_id, access_token } = await this.getConfig()

    const {
      request,
    } = this.app
    let { data } = await request.post(`${API_ENDPOINT}/v2/file/complete`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        drive_id,
        upload_id,
        file_id
      },
      contentType: 'json',
    })

    if (data.code) {
      return this.app.error(data)
    }

    return data
  }

  async video_preview(id) {
    let { drive_id, access_token } = await this.getConfig()

    const {
      request,
      utils: { videoQuality },
    } = this.app

    let data = []
    try {
      let res = await request.post(`${API_ENDPOINT}/v2/file/get_video_preview_play_info`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        data: {
          category: 'live_transcoding',
          drive_id,
          file_id: id,
          template_id: '',
        },
        contentType: 'json',
      })

      data = res.data
    } catch (e) {
    }

    return data.video_preview_play_info.live_transcoding_task_list
      .filter((i) => !!i.url)
      .map((i) => ({ size: videoQuality(i.template_id), type: 'video/mp4', quality: i.template_id, src: i.url }))
  }

}

module.exports = { driver: Driver }