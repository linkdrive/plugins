//===Sharelist===
// @name         CTCCloud
// @namespace    sharelist.plugin.ctc
// @version      1.0.0
// @license      MIT
// @description  天翼云盘
// @author       reruin@gmail.com
// @supportURL   https://github.com/reruin/sharelist
// @updateURL    https://raw.githubusercontent.com/linkdrive/plugins/master/packages/ctc/index.js
// @icon         https://cloud.189.cn/web/logo.ico
//===/Sharelist==

const API_ENDPOINT = 'https://cloud.189.cn'

const UPLOAD_PART_SIZE = 10 * 1024 * 1024

const DEFAULT_ROOT = '-11'

const crypto = require('crypto')

const NodeRSA = require('node-rsa')

const safeJSONParse = (data) =>
  JSON.parse(
    data.replace(/(?<=:\s*)(\d+)/g, ($0, $1) => {
      if (!Number.isSafeInteger(+$1)) {
        return `"${$1}"`
      } else {
        return $1
      }
    }),
  )

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

const hmac = (v, key) => {
  return crypto.createHmac('sha1', key).update(v).digest('hex')
}

const md5 = (v) => crypto.createHash('md5').update(v).digest('hex')

const aesEncrypt = (data, key, iv = "") => {
  let cipher = crypto.createCipheriv('aes-128-ecb', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted
}

const rsaEncrypt = (data, publicKey, charset = 'base64') => {
  publicKey = '-----BEGIN PUBLIC KEY-----\n' + publicKey + '\n-----END PUBLIC KEY-----'

  let key = new NodeRSA(publicKey, { encryptionScheme: 'pkcs1' })
  return key.encrypt(data, charset)
}

const uuid = (v) => {
  return v.replace(/[xy]/g, (e) => {
    var t = 16 * Math.random() | 0
      , i = "x" === e ? t : 3 & t | 8;
    return i.toString(16)
  })
}

const qs = d => Object.keys(d).map(i => `${i}=${encodeURI(d[i])}`).join('&')

const parseHeaders = v => {
  let ret = {}
  for (let pair of decodeURIComponent(v).split('&').map(i => i.split('='))) {
    ret[pair[0].toLowerCase()] = pair.slice(1).join('=')
  }
  return ret
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
    return this.instance.createGetter(config, app)
  }

  constructor(app) {
    this.app = app
  }

  createGetter(config, app) {
    let safeRequest = async (url, options, retry = 3) => {
      let { data, status, headers } = await app.request(url, options)
      if (JSON.stringify(data).includes('InvalidSessionKey')) {
        if (retry > 0) {
          await this.refreshCookie(config)
          options.headers.cookie = config.cookie
          return await safeRequest(url, options, --retry)
        } else {
          app.error({ message: 'Invalid Session Key' })
        }
      }

      return { data, status, headers }
    }
    return async () => {
      if (
        !config.account ||
        !config.cookie
      ) {
        await this.refreshCookie(config)
      }
      return {
        ...config,
        safeRequest
      }
    }
  }

  async needCaptcha(data, cookie) {
    let resp = await this.app.request.post('https://open.e.189.cn/api/logbox/oauth2/needcaptcha.do', {
      data,
      headers: {
        cookie: cookie,
        referer: 'https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do',
      },
      contentType: 'form',
      responseType: 'text'
    })

    if (resp?.data == '1') {
      return true
    } else {
      return false
    }
  }

  async getCaptcha(captchaToken, reqId, cookie) {
    let resp = await this.app.request(
      `https://open.e.189.cn/api/logbox/oauth2/picCaptcha.do?token=${captchaToken}&REQID=${reqId}&rnd=${Date.now()}`,
      {
        headers: {
          cookie,
          Referer: 'https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do',
        },
        responseType: 'buffer',
      },
    )

    if (resp.error) return { error: resp.error }

    let imgBase64 =
      'data:' + resp.headers['content-type'] + ';base64,' + Buffer.from(resp.data).toString('base64')

    return await this.app.ocr(imgBase64)
  }

  async getSessionKey(cookie) {
    let { data: baseData } = await this.app.request(`${API_ENDPOINT}/v2/getUserBriefInfo.action?noCache=${Math.random()}`, {
      headers: {
        cookie,
        // accept: 'application/json;charset=UTF-8'
      },
      responseType: 'json'
    })
    return baseData.sessionKey
  }

  /**
   * refreshCookie
   *
   * @param {object} {account , password}
   * @param {boolean} force
   * @return {object} { credentials | error }
   * @api private
   */
  async refreshCookie(config) {
    let { account, password, cookie_login_user } = config

    const { request } = this.app

    if (cookie_login_user) {
      const cookie = `COOKIE_LOGIN_USER=${cookie_login_user};`
      const sessionKey = await this.getSessionKey(cookie)

      config.sessionKey = sessionKey
      config.cookie = cookie

      config.key = account
      return
    }

    //0 准备工作： 获取必要数据
    let defaultHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
    }
    let { data, headers } = await request.get(
      `${API_ENDPOINT}/api/portal/loginUrl.action?redirectURL=https://cloud.189.cn/web/redirect.html`,
      {
        headers: { ...defaultHeaders },
        responseType: 'text',
      },
    )

    let { data: data2 } = await request.post(`https://open.e.189.cn/api/logbox/config/encryptConf.do`, {
      data: {
        appId: 'cloud'
      }
    })
    let { pubKey, pre, upSmsOn } = data2.data

    let captchaToken = (data.match(/name='captchaToken' value='(.*?)'>/) || ['', ''])[1],
      returnUrl = (data.match(/returnUrl = '(.*?)'\,/) || ['', ''])[1],
      paramId = (data.match(/var paramId = "(.*?)";/) || ['', ''])[1],
      lt = (data.match(/var lt = "(.*?)";/) || ['', ''])[1],
      reqId = (data.match(/reqId = "(.*?)";/) || ['', ''])[1]

    // console.log(headers, pubKey)
    let cookie = headers['set-cookie']

    let formdata = {
      appKey: 'cloud',
      accountType: '01',
      userName: `${pre}${rsaEncrypt(account, pubKey)}`,
      password: `${pre}${rsaEncrypt(password, pubKey)}`,
      userName: account,
      password: password,
      validateCode: '',
      captchaToken: captchaToken,
      returnUrl: returnUrl,
      mailSuffix: '@189.cn',
      dynamicCheck: 'FALSE',
      clientType: '1',
      cb_SaveName: '1',
      isOauth2: 'false',
      state: '',
      paramId: paramId,
    }
    // console.log(pubKey, pre, formdata)
    // return this.app.error({ message: 'haha' })
    let retry = 3
    let needcaptcha = await this.needCaptcha(
      {
        accountType: '01',
        userName: account,
        appKey: 'cloud',
      },
      cookie,
    )

    while (retry--) {
      // 验证码
      if (needcaptcha) {
        let { error, code } = await this.getCaptcha(captchaToken, reqId, cookie)

        if (error) return { error }

        code = code.replace(/\n/g, '')
        if (code.length == 4) {
          formdata.validateCode = code
        } else {
          continue
        }

      }

      // 登陆
      let { data } = await request.post('https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do', {
        headers: {
          Referer: 'https://open.e.189.cn/api/logbox/oauth2/unifyAccountLogin.do',
          reqid: reqId,
          lt: lt,
        },
        data: formdata,
        contentType: 'form',
        responseType: 'json'
      })

      //验证码错误
      if (data.result == -2) {
        console.log('validateCode:[' + formdata.validateCode + '] error')
        continue
      }
      if (!data.toUrl) return this.app.error({ message: data.msg })

      let { headers } = await request.get(data.toUrl, {
        followRedirect: false,
        headers: {
          ...defaultHeaders,
          referer: 'https://open.e.189.cn/'
        },
        responseType: 'text',
      })
      //COOKIE_LOGIN_USER=xxxxx;
      let loginUser = headers?.['set-cookie'].match(/COOKIE_LOGIN_USER=(?<token>[a-z\d]+)/i)?.groups.token

      if (!loginUser) return this.app.error({ message: 'login failed. Can not get cookies!' })

      const loginCookie = `COOKIE_LOGIN_USER=${loginUser};`
      const sessionKey = await this.getSessionKey(loginCookie)

      config.cookie = loginCookie
      config.sessionKey = sessionKey
      config.updated_at = Date.now()

      config.key = account

      return
    }

    return this.app.error({ message: `Login failed` })
  }
}

class Driver {
  static options = {
    protocol: "ctc",

    //支持全局搜索
    globalSearch: true,
    localSearch: true,

    hash: 'md5',
    uploadHash: 'md5_chunk',
    key: 'client_id',
    defaultRoot: DEFAULT_ROOT,

    guide: [
      {
        key: 'type',
        label: '类型 / Type',
        type: 'string',
        required: true,
        options: [
          { value: '1', label: '个人版' },
          // { value: '2', label: '家庭版' },
          // { value: '3', label: '企业版' }
        ],
      },
      { key: 'account', label: '手机号 / Account', type: 'string', required: true },
      { key: 'password', label: '密码 / Password', type: 'string', required: true },
      { key: 'cookie_login_user', label: 'COOKIE_LOGIN_USER', type: 'string', required: false, help: 'Cookies 中的COOKIE_LOGIN_USER字段，若提供此项则优先使用Cookies登录。' },
      {
        key: 'root',
        label: '初始文件夹ID / Root Id',
        help: 'https://cloud.189.cn/web/main/file/folder/xxxx 地址中 xxxx 的部分',
        type: 'string',
      },
    ]
  }

  constructor(app, config) {
    this.app = app
    this.getConfig = Manager.getInstance(app, config)
  }

  /**
   * 列出目录
   *
   * @param {string} [id] 文件(目录)id 唯一值
   * 
   * @param {object} [options] 参数
   * @param {object} [options.order_by] 排序
   * @param {object} [options.page] 页码
   * @param {object} [options.per_page] 每页条目数
   * @param {object} [options.search] 搜索内容
   * 
   * @return {object}
   *
   * @api public {Array<file>}
   *
   */
  async list(id, { search, local_search, orderBy, perPage, nextPage } = {}) {
    const {
      utils: { timestamp },
    } = this.app

    let { cookie, safeRequest } = await this.getConfig()

    let usePagination = !!perPage

    const files = []

    let isSearch = !!search

    nextPage = nextPage || 1

    let url = `${API_ENDPOINT}/api/open/file/${isSearch ? 'searchFiles' : 'listFiles'}.action`

    let params = {
      folderId: id,
      inGroupSpace: false,
      mediaType: 0,
      iconOption: 5,
      descending: true,
      orderBy: 'filename',
      pageSize: usePagination ? perPage : 1000,
      noCache: Math.random(),
    }


    if (orderBy) {
      let [sortKey, isAsc] = orderBy
      params.orderBy = sortKey == 'name' ? 'filename' : sortKey == 'mtime' ? 'lastOpTime' : sortKey == 'size' ? 'filesize' : 'filename'
      params.descending = isAsc ? false : true
    }

    if (isSearch) {
      params.filename = search
      params.recursive = !!local_search ? 0 : 1
    }

    do {

      let { data } = await safeRequest(url, {
        data: {
          ...params,
          pageNum: nextPage
        },
        headers: {
          cookie,
          // default format is xml
          accept: 'application/json;charset=UTF-8',
          // 'sign-type': 1,
        },
        responseType: 'text',
      })

      data = safeJSONParse(data)

      if (data?.errorCode) return this.app.error({ message: data.errorMsg })

      const vo = isSearch ? data : data.fileListAO

      if (vo?.folderList) {
        for (let i of vo.folderList) {
          files.push({
            id: i.id,
            name: i.name,
            type: 'folder',
            size: i.size,
            ctime: timestamp(i.createDate),
            mtime: timestamp(i.lastOpTime),
            extra: {
              fid: i.id,
              parent_id: i.parentId,
              count: i.fileCount,
            },
          })
        }
      }

      if (vo?.fileList) {
        for (let i of vo.fileList) {
          files.push({
            id: i.id,
            name: i.name,
            type: 'file',
            size: i.size,
            ctime: timestamp(i.createDate),
            mtime: timestamp(i.lastOpTime),
            thumb: i.icon?.smallUrl,
            extra: {
              fid: i.id,
              parent_id: id,
              md5: i.md5.toLowerCase(),
            },
          })
        }
      }

      if (nextPage * params.pageSize < parseInt(data.recordCount)) {
        nextPage++
      } else {
        break
      }
    } while (!usePagination && nextPage)


    let result = {
      id, files
    }

    if (usePagination && nextPage) {
      result.nextPage = nextPage
    }

    return result
  }

  /**
   * get file
   *
   * @param {string} [id] path id
   * @return {object}
   *
   * @api public
   */
  async get(id, more = false) {

    let { cookie, safeRequest } = await this.getConfig()

    let { data } = await safeRequest(`${API_ENDPOINT}/api/portal/getFileInfo.action`, {
      headers: {
        cookie,
        // default format is xml
        accept: 'application/json;charset=UTF-8',
      },
      data: {
        noCache: Math.random(),
        fileId: id,
      },
    })

    if (data.res_code != 0) return this.app.error({ message: data.res_message })
    let result = {
      id: data.fileId,
      name: data.fileName,
      type: data.isFolder ? 'folder' : 'file',
      size: data.fileSize,
      ctime: data.createTime,
      mtime: data.lastOpTime,
      // download_url: data.isFolder ? '' : `https:${data.downloadUrl}`,
      extra: {
        fid: data.fileId,
        parent_id: data.parentId,
        downloadUrl: data.downloadUrl
      },
    }

    if (data.imageInfo?.icon) {
      result.thumb = data.imageInfo.icon.smallUrl
    }
    else if (data.audioInfo?.icon) {
      result.thumb = data.audioInfo.icon.smallUrl
    }
    else if (data.videoInfo?.icon) {
      result.thumb = data.videoInfo.icon.smallUrl
    }

    // get hash
    if (more && data.parentId) {
      let parentData = await this.list(data.parentId)
      if (parentData?.files) {
        let hit = parentData.files.find(i => i.id == id)
        if (hit.md5) {
          result.extra.md5 = hit.md5
        }
      }
    }

    if (!more && !result.download_url && result.type != 'folder') {
      let { url, max_age } = await this.get_download_url(id, 'https:' + data.downloadUrl)
      if (url) {
        result.download_url = url
        result.max_age = max_age
      }
    }
    return result
  }

  async get_download_url(id, download_url) {
    if (!download_url) {
      let res = await this.get(id, true)
      download_url = res.extra.downloadUrl
    }
    let { cookie } = await this.getConfig()

    if (download_url) {
      let { headers } = await this.app.request.get(download_url, {
        followRedirect: false,
        responseType: 'text',
        headers: {
          cookie,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        },
      })

      download_url = headers?.location

      // get oss link
      if (download_url) {
        let { headers } = await this.app.request.get(download_url, {
          followRedirect: false,
          responseType: 'text',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
          },
        })

        download_url = headers?.location
      }

      if (download_url) {
        let expired_at = download_url.match(/Expires=(?<expired_at>\d+)/i)?.groups.expired_at || 0
        let max_age = 0
        if (expired_at) {
          max_age = +expired_at * 1000 - Date.now()
        }

        return { url: download_url, max_age }
      }
    }

    return { error: {} }
  }

  async mkdir(id, name, { check_name_mode = 'refuse' }) {
    let { cookie, safeRequest } = await this.getConfig()
    let { data } = await safeRequest(`${API_ENDPOINT}/api/open/file/createFolder.action?noCache=${Math.random()}`, {
      method: 'POST',
      headers: {
        cookie,
        accept: 'application/json;charset=UTF-8',
      },
      contentType: 'form',
      data: {
        folderName: name,
        parentFolderId: id,
      },
    })

    if (data.res_code != 0) return this.app.error({ message: data.res_message })

    return {
      id: data.id,
      name: data.name,
      parent_id: id
    }
  }

  async rm(id) {
    let originData = await this.get(id, true)
    let { cookie, safeRequest } = await this.getConfig()
    let { data } = await safeRequest(`${API_ENDPOINT}/api/open/batch/createBatchTask.action?noCache=${Math.random()}`, {
      method: 'POST',
      headers: {
        cookie,
        accept: 'application/json;charset=UTF-8',
      },
      contentType: 'form',
      data: {
        type: 'DELETE',
        taskInfos: [{ "fileId": id, "fileName": originData.name, "isFolder": originData.type == 'folder' ? 1 : 0 }],
        targetFolderId: ''
      },
    })

    if (data.res_code != 0) return this.app.error({ message: data.res_message })

    let taskId = data.taskId

    await this.monitor({ taskId, type: 'DELETE' })

    return {
      id: data.id,
      name: data.name,
      parent_id: originData.extra.parent_id
    }
  }

  async mv(id, target_id, { copy, name } = {}) {
    let originData = await this.get(id, true)

    let { cookie, safeRequest } = await this.getConfig()
    let { data } = await safeRequest(`${API_ENDPOINT}/api/open/batch/createBatchTask.action?noCache=${Math.random()}`, {
      method: 'POST',
      headers: {
        cookie,
        accept: 'application/json;charset=UTF-8',
      },
      contentType: 'form',
      data: {
        type: copy ? 'COPY' : 'MOVE',
        taskInfos: [{ "fileId": id, "fileName": originData.name, "isFolder": originData.type == 'folder' ? 1 : 0 }],
        targetFolderId: target_id
      },
    })

    if (data.res_code != 0) return this.app.error({ message: data.res_message })

    let taskId = data.taskId

    let res = await this.monitor({ taskId, type: copy ? 'COPY' : 'MOVE' })

    if (res) {
      return {
        id: originData.id,
        name: originData.name,
        origin_parent_id: originData.extra.parent_id
      }
    }
    //189cloud 不支持目的地存在相同文件，也不支持复制/移动时，重命名。 
    return this.app.error({ message: '', code: 501 })
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
    let { cookie, safeRequest } = await this.getConfig()
    let { data } = await safeRequest(`${API_ENDPOINT}/api/open/file/renameFolder.action?noCache=${Math.random()}`, {
      method: 'POST',
      headers: {
        cookie,
        accept: 'application/json;charset=UTF-8',
      },
      contentType: 'form',
      data: {
        destFolderName: name,
        folderId: id,
      },
    })

    if (data.res_code != 0) return this.app.error({ message: data.res_message })

    return {
      id: data.id,
      name: data.name,
      parent_id: data.parentId
    }
  }

  async generate_rsa_key() {
    if (!this.rsa_key || (this.rsa_key.expire - Date.now() < 5 * 60 * 1000)) {
      let { cookie, safeRequest } = await this.getConfig()
      let { data } = await safeRequest(`${API_ENDPOINT}/api/security/generateRsaKey.action?noCache=${Math.random()}`, {
        headers: {
          cookie,
          accept: 'application/json;charset=UTF-8',
        },
        responseType: 'json'
      })
      console.log('update rsa_key')
      this.rsa_key = data
    }

    return this.rsa_key
  }

  async createRequest(url, formData) {
    let { sessionKey } = await this.getConfig()
    let { pkId, pubKey } = await this.generate_rsa_key()

    let date = Date.now()
    let pkey = uuid("xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx").slice(0, 16 + 16 * Math.random() | 0)
    let params = aesEncrypt(qs(formData), pkey.substring(0, 16))
    let signature = hmac(`SessionKey=${sessionKey}&Operate=GET&RequestURI=${url}&Date=${date}&params=${params}`, pkey)
    let encryptionText = rsaEncrypt(pkey, pubKey)

    const headers = {
      signature,
      sessionKey,
      encryptionText,
      pkId,
      'x-request-id': uuid('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'),
      'x-request-date': date,
      'origin': 'https://cloud.189.cn',
      'referer': 'https://cloud.189.cn/'
    }

    return await this.app.request(`https://upload.cloud.189.cn${url}?params=${params}`, { headers })
  }

  async singleUpload(id, { size, name, stream, ...rest }) {
    const { app } = this

    let passStream = app.streamReader(stream, { highWaterMark: 2 * UPLOAD_PART_SIZE })

    let buffer = await passStream.read(UPLOAD_PART_SIZE)

    let md5hash = md5(buffer)

    let { data } = await this.createRequest('/person/initMultiUpload', {
      parentFolderId: id,
      fileName: name,
      fileSize: size,
      sliceSize: UPLOAD_PART_SIZE,
      sliceMd5: md5hash,
      fileMd5: md5hash
    })

    if (!data?.code == 'SUCCESS') return this.app.error({ message: 'a error occurred before upload.' })

    let { uploadFileId, fileDataExists } = data.data

    if (fileDataExists == 0) {

      // Skip step
      // let { data: d1, status } = await this.createRequest("/person/getUploadedPartsInfo", {
      //   uploadFileId
      // })

      let chunk_base64 = Buffer.from(md5hash, 'hex').toString('base64')
      let { data: uploadData } = await this.createRequest('/person/getMultiUploadUrls', {
        uploadFileId,
        partInfo: `1-${chunk_base64}`,
      })

      uploadData = uploadData?.['uploadUrls'][`partNumber_1`]

      let res = await app.request(uploadData.requestURL, {
        method: 'put',
        data: buffer,
        contentType: 'buffer',
        responseType: 'text',
        headers: {
          ...parseHeaders(uploadData.requestHeader),
          "referer": 'https://cloud.189.cn/',
        }
      })

      if (res.status != 200) app.error({ message: 'a error occurred during upload.' })
    }
    let { data: res } = await this.createRequest('/person/commitMultiUploadFile', {
      uploadFileId,
      fileMd5: md5hash,
      //fileSize<=10MB,fileMD5 should equal sliceMd5,
      sliceMd5: md5hash,
      lazyCheck: 0,
    })

    return { id: res.file.userFileId }
  }

  async upload(id, stream, { size, name, manual, ...rest }) {
    if (size <= UPLOAD_PART_SIZE) {
      return await this.singleUpload(id, { size, name, stream, ...rest })
    }

    const { app } = this

    let { data } = await this.createRequest('/person/initMultiUpload', {
      parentFolderId: id,
      fileName: name,
      fileSize: size,
      sliceSize: UPLOAD_PART_SIZE,
      lazyCheck: 1
    })
    if (!data?.code == 'SUCCESS' || !data?.data) return this.app.error({ message: 'a error occurred before upload.' })

    let { uploadFileId } = data.data
    let start = 0
    // 此操作疑似无实际效果
    // await this.createRequest('/person/getUploadedPartsInfo', {
    //   uploadFileId,
    // })

    if (!stream) {
      return { uploadId: uploadFileId, start }
    }

    let part = Math.ceil(size / UPLOAD_PART_SIZE)
    let passStream = app.streamReader(customStream || stream, { highWaterMark: 2 * UPLOAD_PART_SIZE })
    let md5chunk = []
    let md5sum = crypto.createHash('md5')
    for (let i = 1; i <= part; i++) {
      let buffer = await passStream.read(UPLOAD_PART_SIZE)
      let chunk_hash = md5(buffer).toUpperCase()
      let chunk_base64 = Buffer.from(chunk_hash, 'hex').toString('base64')

      md5chunk.push(chunk_hash)
      md5sum.update(buffer)

      let { data } = await this.createRequest('/person/getMultiUploadUrls', {
        partInfo: `${i}-${chunk_base64}`,
        uploadFileId,
      })

      let uploadData = data['uploadUrls'][`partNumber_${i}`]

      let res = await app.request(uploadData.requestURL, {
        method: 'put',
        data: buffer,
        contentType: 'buffer',
        responseType: 'text',
        headers: parseHeaders(uploadData.requestHeader)
      })

      if (res.status != 200) app.error({ message: 'a error occurred during upload.' })
    }

    let uniqueIdentifier = md5sum.digest('hex')

    // commit
    let { data: res } = await this.createRequest('/person/commitMultiUploadFile', {
      uploadFileId,
      fileMd5: uniqueIdentifier,
      //fileSize<=10MB,fileMD5 should equal sliceMd5,
      sliceMd5: md5(md5chunk.join('\n')),
      lazyCheck: 1,
    })
    return { id: res.file.userFileId }
  }

  async monitor(params, timeout = 5 * 1000) {
    let { cookie, safeRequest } = await this.getConfig()

    let startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      let { data } = await safeRequest(`${API_ENDPOINT}/api/open/batch/checkBatchTask.action?noCache=${Math.random()}`, {
        method: 'POST',
        headers: {
          cookie,
          accept: 'application/json;charset=UTF-8',
        },
        contentType: 'form',
        data: params,
      })
      if (data?.taskStatus == 4) {
        return true
      }

      await sleep(300)
    }
  }
}

module.exports = { driver: Driver }