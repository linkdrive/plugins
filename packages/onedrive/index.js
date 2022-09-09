//===Sharelist===
// @name         OneDrive
// @namespace    sharelist.plugin.onedrive
// @version      1.0.0
// @license      MIT
// @description  OneDrive
// @author       reruin@gmail.com
// @supportURL   https://github.com/reruin/sharelist
// @updateURL    https://raw.githubusercontent.com/linkdrive/plugins/master/packages/onedrive/index.js
// @icon         https://p.sfx.ms/images/favicon.ico
//===/Sharelist==

const { URL } = require('url')

const DEFAULT_ROOT_ID = 'root'

const UPLOAD_PART_SIZE = 4 * 1024 * 1024

const UPLOAD_PART_SIZE_LARGE = 16 * 1024 * 1024

const atob = v => Buffer.from(v, 'base64').toString()

const btoa = v => Buffer.from(v).toString('base64')

const supportZones = {
  GLOBAL: ['https://login.microsoftonline.com', 'https://graph.microsoft.com', '国际版'],
  CN: ['https://login.chinacloudapi.cn', 'https://microsoftgraph.chinacloudapi.cn', '世纪互联'],
  DE: ['https://login.microsoftonline.de', 'https://graph.microsoft.de', 'Azure Germany'],
  US: ['https://login.microsoftonline.us', 'https://graph.microsoft.us', 'Azure US GOV'],
}

const qs = (d) => new URLSearchParams(d).toString()

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
        ...config
      }
    }
  }

  getAuthority(zone = 'GLOBAL', tenant_id) {
    return supportZones[zone][0] + '/' + (tenant_id || 'common')
  }

  getGraphEndpoint(zone = 'GLOBAL', site_id = false) {
    return supportZones[zone][1] + '/v1.0' + (site_id ? `/sites/${site_id}` : '/me') + '/drive'
  }

  getGraphEndpointSite(zone = 'GLOBAL', site_name) {
    //sites/' . getConfig('siteid') . '
    return supportZones[zone][1] + '/v1.0/sites/root:/' + site_name
  }

  /**
   * 从分享链接中解析 credentials
   * access token 有效期 5h
   *
   * @param {object} config
   * @param {object} { credentials }
   * @api private
   */
  async refreshShareAccessToken(config) {
    const {
      request
    } = this.app

    const url = decodeURIComponent(config.share_url)

    let { headers } = await request(url, {
      responseType: 'text',
      followRedirect: false,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36',
      },
    })

    let cookie = headers['set-cookie']
    let obj = new URL(headers['location'])
    let origin = obj.origin
    let rootFolder = obj.searchParams.get('id')
    let account = rootFolder
      .split(' ')[0]
      .replace('/Shared', '')
      .replace(/Documents.*?$/, '')

    let query = {
      a1: `'${rootFolder.replace(/(?<=Documents).*$/, '')}'`,
      RootFolder: rootFolder,
      TryNewExperienceSingle: 'TRUE',
    }

    let formdata = {
      parameters: {
        __metadata: { type: 'SP.RenderListDataParameters' },
        RenderOptions: 1216519,
        ViewXml:
          '<View Name="{95F0CAAD-9DE2-4864-AE8D-33094C998625}" DefaultView="TRUE" MobileView="TRUE" MobileDefaultView="TRUE" Type="HTML" ReadOnly="TRUE" DisplayName="All" Url="/personal/mengskysama_makedie_onmicrosoft_com/Documents/Forms/All.aspx" Level="1" BaseViewID="51" ContentTypeID="0x" ImageUrl="/_layouts/15/images/dlicon.png?rev=47"><Query><OrderBy><FieldRef Name="FileLeafRef"/></OrderBy></Query><ViewFields><FieldRef Name="DocIcon"/><FieldRef Name="LinkFilename"/><FieldRef Name="Modified"/><FieldRef Name="SharedWith"/><FieldRef Name="Editor"/></ViewFields><RowLimit Paged="TRUE">70</RowLimit><JSLink>clienttemplates.js</JSLink><XslLink Default="TRUE">main.xsl</XslLink><Toolbar Type="Standard"/></View>',
        AllowMultipleValueFilterForTaxonomyFields: true,
        AddRequiredFields: true,
      },
    }

    let newurl = `${origin}${account}/_api/web/GetListUsingPath(DecodedUrl=@a1)/RenderListDataAsStream?@${qs(query)}`;

    let { data } = await request.post(newurl, {
      data: formdata,
      headers: {
        origin,
        cookie,
        accept: 'application/json;odata=verbose',
        'content-type': 'application/json;odata=verbose',
      },
    })


    if (data?.error) {
      return this.app.error({ message: data.error.message.value })
    }

    if (!data?.ListSchema['.driveAccessToken']) {
      return this.app.error({ message: '请将分享文件夹设置[拥有链接的任何人都可编辑] / The shared folder must be given editing permissions' })
    }

    let access_token = data['ListSchema']['.driveAccessToken'].replace('access_token=', '')
    let graph = data['ListSchema']['.driveUrl']
    let expires_at = parseInt(JSON.parse(atob(access_token.split('.')[1]))['exp']) * 1000

    config.access_token = access_token
    config.expires_at = expires_at
    config.graph = graph

    config.key = btoa(decodeURIComponent(url))
  }

  /**
   * 刷新令牌 / refresh token
   *
   * @param {object} credentials
   * @param {object} { credentials: object } | { error:true, message:string }
   * @api private
   */
  async refreshAccessToken(credentials) {
    let { client_id, client_secret, redirect_uri, refresh_token, zone, tenant_id, type, ...rest } =
      credentials
    if (type == 'sharelink') {
      return await this.refreshShareAccessToken(credentials)
    }

    if (!(client_id && client_secret && refresh_token)) {
      return { error: { message: 'Invalid parameters: An error occurred during refresh access token' } }
    }

    let formdata = {
      client_id: client_id.split('.')[0],
      client_secret,
      redirect_uri,
      refresh_token,
      grant_type: 'refresh_token',
    }
    let metadata = this.getAuthority(zone, tenant_id)
    let { data } = await this.app.request.post(`${metadata}/oauth2/v2.0/token`, { data: formdata, contentType: 'form' })

    if (data.error) {
      return this.app.error({ message: data.error_description || data.error })
    }

    let expires_at = data.expires_in * 1000 + Date.now()

    credentials.graph = this.getGraphEndpoint(data.zone, data.site_id)
    credentials.refresh_token = data.refresh_token
    credentials.access_token = data.access_token
    credentials.expires_at = expires_at
  }

}

const mountData = () => {
  let zone = Object.entries(supportZones).map(([key, value]) => {
    return {
      value: key,
      label: value[2],
    }
  })

  return [
    {
      key: 'type',
      label: 'OneDrive 挂载类型',
      type: 'string',
      required: true,
      options: [
        { value: 'onedrive', label: 'OneDrive' },
        { value: 'sharepoint', label: 'SharePoint' },
        { value: 'sharelink', label: 'Share Link / 分享链接' },
      ],
      fields: [
        [
          { key: 'zone', label: '地域', type: 'string', options: zone, required: true },
          { key: 'client_id', label: '应用ID / Client ID', required: true },
          { key: 'client_secret', label: '应用机密 / App Secret', type: 'string', required: true },
          { key: 'redirect_uri', label: '回调地址 / Redirect URI', required: true },
          { key: 'refresh_token', label: '刷新令牌 / Refresh Token', required: true },
          { key: 'tenant_id', label: '租户ID / Tenant ID' },
          { key: 'root_id', label: '初始目录ID' },
        ],
        [
          { key: 'zone', label: '地域', type: 'string', options: zone, required: true },
          { key: 'client_id', label: '应用ID / Client ID', required: true },
          { key: 'client_secret', label: '应用机密 / App Secret', type: 'string', required: true },
          { key: 'redirect_uri', label: '回调地址 / Redirect URI', required: true },
          { key: 'refresh_token', label: '刷新令牌 / Refresh Token', required: true },
          { key: 'site_id', label: 'SharePoint 站点ID / Site ID', type: 'string' },
          { key: 'tenant_id', label: '租户ID / Tenant ID', type: 'string' },
          { key: 'root_id', label: '初始目录ID', type: 'string' },
        ],
        [
          { key: 'share_url', label: '分享链接URL', type: 'string', required: true },
          { key: 'root_id', label: '初始目录ID', type: 'string' },
        ],
      ],
    },
  ]
}


class Driver {
  static options = {
    protocol: "onedrive",

    //支持全局搜索
    //searchDepth: 1,
    globalSearch: true,
    localSearch: false,

    key: 'client_id',
    defaultRoot: DEFAULT_ROOT_ID,
    guide: mountData()
  }

  constructor(app, config) {
    this.app = app
    this.getConfig = Manager.getInstance(app, config)
  }

  /**
   * Lists or search files
   *
   * @param {string} [id] folder id
   * @param {object} [options] list options
   * @param {object} [options.sort] sort methods
   * @param {object} [options.search] search key
   * @return {object | error}
   *
   * @api public
   *
   * docs: https://docs.microsoft.com/zh-cn/onedrive/developer/rest-api/api/driveitem_list_children?view=odsp-graph-online
   * docs: https://docs.microsoft.com/zh-cn/onedrive/developer/rest-api/resources/driveitem
   * 
   * TODO: there are two methods for request
   * With a known id:  GET /{drive-id}/items/{item-id}/children
   * With a known path: GET /{drive-id}/root:/{path-relative-to-root}:/children
   * 
   * Search Drive Root: GET /root/search(q='{search-text}')
   * Search Dir : GET /items/{item-id}/search(q='text')
   */
  async list(id, { search, orderBy, perPage, nextPage }) {
    let { graph, access_token } = await this.getConfig()

    const {
      request,
      utils: { timestamp },
    } = this.app

    let usePagination = !!perPage

    // https://makedie-my.sharepoint.com/_api/v2.0/drives/b!0JNeDoFvlUSa2fAugQnhNBuZYcN0WQJPrYD8Vq2FUAfsmI8YwdGNQ5zG5mhlt3sY

    let url = graph + `${id == DEFAULT_ROOT_ID ? '/root/' : `/items/${id}/`}` + `${search ? `search(q='${encodeURIComponent(search)}')` : 'children'}`

    if (search) console.log('search', url)
    let params = {
      $select:
        'id,name,size,file,folder,parentReference,@microsoft.graph.downloadUrl,thumbnails,createdDateTime,lastModifiedDateTime',
      $expand: 'thumbnails',
    }

    // TODO: Note that in OneDrive for Business and SharePoint Server 2016, the orderby query string only works with name and url.
    if (orderBy) {
      let [sortKey, sortType] = orderBy
      sortKey = sortKey == 'mtime' ? 'lastModifiedDateTime' : sortKey
      params.$orderby = sortKey + ' ' + (sortType ? 'asc' : 'desc')
    }

    // set per page
    params.$top = usePagination ? perPage : 1000

    let skipToken = nextPage, files = []

    do {
      let { data } = await request.get(url, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        data: { ...params, ...(skipToken ? { '$skipToken': skipToken } : {}) },
      })

      if (data.error) this.app.error({ message: data.error.message })

      //extract token from @odata.nextLink
      skipToken = data['@odata.nextLink']?.match(/skiptoken=([a-z0-9A-Z!_]+)/i)?.[1]
      data.value.forEach((i) => {
        let item = {
          id: i.id,
          name: i.name,
          type: i.folder ? 'folder' : 'file',
          size: i.size,
          ctime: timestamp(i.createdDateTime),
          mtime: timestamp(i.lastModifiedDateTime),
          thumb: i.thumbnails.length > 0 ? i.thumbnails[0].medium.url : '',
          extra: {
            fid: i.id,
            parent_id: id //i.parentReference?.id,
          },
        }
        if (i.file) {
          if (i.file.hashes?.sha1Hash) {
            item.extra.sha1 = i.file.hashes.sha1Hash.toLowerCase()
          }
          item.extra.mime = i.file.mimeType
          item.download_url = i['@microsoft.graph.downloadUrl'] || i['@content.downloadUrl']
        } else if (i.folder) {
          item.extra.child_count = i.folder.childCount
        }
        files.push(item)
      })

    } while (!usePagination && skipToken)


    let result = {
      id, files
    }

    if (usePagination && skipToken) {
      result.nextPage = skipToken
    }

    return result
  }


  /**
   * get file
   *
   * @param {string} [id] file id
   * @param {string} [key] key
   * @return {object}
   *
   * @api public
   */
  async get(id) {
    let { graph, access_token } = await this.getConfig()

    const {
      request,
      utils: { timestamp },
    } = this.app
    let url = `${graph}/items/${id}`

    let { data, error } = await request(url, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        $expand: 'thumbnails',
      },
    })

    if (error) return { error: error }

    if (data.error) return { error: data.error.message }
    let result = {
      id: data.id,
      name: data.name,
      type: data.folder ? 'folder' : 'file',
      size: data.size,
      ctime: timestamp(data.createdDateTime),
      mtime: timestamp(data.lastModifiedDateTime),
      download_url: data['@microsoft.graph.downloadUrl'] || data['@content.downloadUrl'],
      thumb: data.thumbnails.length > 0 ? data.thumbnails[0].medium.url : '',
      // the download link expires after 3600s
      max_age: 3600 * 1000,
      extra: {
        fid: data.id,
        parent_id: data.parentReference.path ? (data.parentReference.path.endsWith('root:') ? DEFAULT_ROOT_ID : data.parentReference?.id) : DEFAULT_ROOT_ID,
        path: data.parentReference ? data.parentReference.path.split('root:')[1] : '',
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
   * @param {object} [options.conflictBehavior] 
   * @return {object}
   *
   * @api public
   */
  async mkdir(parent_id, name, { conflictBehavior = 'rename' }) {
    let { graph, access_token } = await this.getConfig()
    let url = graph + `${parent_id == DEFAULT_ROOT_ID ? '/root' : `/items/${parent_id}`}` + '/children'
    let { data } = await this.app.request.post(url, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        name,
        "folder": {},
        "@microsoft.graph.conflictBehavior": "rename"
      },
      contentType: 'json',
    })

    if (data.error) return this.app.error({ message: data.error.message })

    return {
      id: data.id,
      name,
      parent_id
    }
  }

  /**
   * rename file/folder
   *
   * @param {string} [id] folder id
   * @param {string} [name] folder name
   * @param {object} [options] options
   * @param {object} [options.check_name_mode] 
   * @param {string} [key] key
   * @return {object}
   *
   * @api public
   */
  async rename(id, name, { check_name_mode = 'rename' }) {
    let { graph, access_token } = await this.getConfig()
    let url = graph + (id == DEFAULT_ROOT_ID ? '/root' : `/items/${id}`)

    let { data } = await this.app.request(url, {
      method: 'patch',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        name
      },
      contentType: 'json',
    })

    if (data.error) return this.app.error({ message: data.error.message })
    return {
      id: data.id,
      name,
    }
  }

  /**
   * remove file/folder
   *
   * @param {string} [id] id
   * @param {string} [key] key
   * @return {object}
   *
   * @api public
   */
  async rm(id) {
    let { graph, access_token } = await this.getConfig()
    let filedata = await this.get(id)
    let url = graph + `/items/${id}`

    let { data, status } = await this.app.request(url, {
      method: 'delete',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      responseType: 'text'
    })

    if (status == 204) {
      return {
        id,
        parent_id: filedata.extra.parent_id
      }
    } else {
      data = JSON.parse(data)
      return this.app.error({ message: data?.error?.message, code: status })
    }

  }

  /**
   * move file/folder
   *
   * @param {string} [id] folder id
   * @param {string} [target_id] dest folder
   * @param {string} [key] key
   * @return {object}
   *
   * @api public
   */
  async mv(id, target_id, { copy, name } = {}) {

    if (copy) return await this.copy(id, target_id, { name })

    let { graph, access_token } = await this.getConfig()

    let dest = {
      parentReference: {
        id: target_id || DEFAULT_ROOT_ID
      }
    }
    if (name) dest.name = name

    let { data } = await this.app.request(`${graph}/items/${id}`, {
      method: 'patch',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: dest,
      contentType: 'json',
    })

    if (data.error) return this.app.error({ message: data.error.message })

    return {
      id: data.id,
      name: data.name,
    }
  }

  /**
   * copy file/folder
   *
   * @param {string} [id] folder id
   * @param {string} [target_id] dest folder
   * @param {string} [key] key
   * @return {object}
   *
   * @api public
   */
  async copy(id, target_id, { name } = {}) {
    //POST /users/{userId}/drive/items/{itemId}/copy
    let { graph, access_token } = await this.getConfig()
    let url = graph + `/items/${id}/copy`

    //TODO: It can NOT use the "id:root" when copy items to the root of a OneDrive, use {"path": "/drive/root"} instead.
    let dest = {
      parentReference: target_id == DEFAULT_ROOT_ID ? { path: '/drive/root' } : { id: target_id }
    }

    if (name) dest.name = name

    let { data, headers, status } = await this.app.request(url, {
      method: 'post',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: dest,
      contentType: 'json',
      responseType: 'text'
    })


    if (status != 202) {
      return this.app.error(JSON.parse(data)?.error.message)
    }

    let monitorUrl = headers.location

    let result = await this.monitor(monitorUrl)

    if (result?.id) {
      return {
        id: result.id,
        name: data.name,
        parent: target_id,
      }
    } else {
      return this.app.error({ message: 'Task has been accepted, but monitor returned no result.' })
    }

  }

  async singleUpload(id, { size, name, stream, ...rest }) {
    let { graph, access_token } = await this.getConfig()
    let url = `${graph}${id == DEFAULT_ROOT_ID ? '/root' : `/items/${id}`}:/${encodeURIComponent(name)}:/content`
    // console.log(url)
    let { data } = await this.app.request(url, {
      method: 'put',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'content-type': 'application/octet-stream'
      },
      data: stream,
      contentType: 'stream',
    })
    if (data.error) return this.app.error({ message: data.error.message })

    return { id: data.id, name: data.name, parent_id: id }
  }

  async beforeUpload(uploadId, { id, name, size,conflictBehavior}) {
    let uploadUrl, start = 0
    let { app } = this
    //resume upload
    if (uploadId) {
      uploadUrl = atob(uploadId)
      let { data } = await app.request(uploadUrl)
      if (data.error) app.error({ message: data.error.message })
      //upload session has expired.
      if (data.expirationDateTime && Date.now() - new Date(data.expirationDateTime) > 0) {
        uploadUrl = ''
      } else {
        start = +data.nextExpectedRanges[0].split('-')[0]
      }
    }

    // create new upload session
    if (!uploadUrl) {
      let { graph, access_token } = await this.getConfig()
      let { data } = await app.request(graph + (id == DEFAULT_ROOT_ID ? '/root' : `/items/${id}`) + `:/${encodeURIComponent(name)}:/` + '/createUploadSession', {
        method: 'post',
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        data: {
          item: {
            "@microsoft.graph.conflictBehavior": "rename",
            // name
          }
        },
        contentType: 'json',
      })
      if (data.error) return app.error({ message: data.error.message })
      uploadUrl = data.uploadUrl
      start = 0
    }

    return {
      uploadUrl, start, uploadId: btoa(uploadUrl)
    }

  }


  /**
   * upload file
   *
   * @param {string} [id] folder id
   * @param {object} [options] upload file meta
   * @param {number} [options.size] upload file size
   * @param {string} [options.name] upload file name
   * @param {ReadableStream} [options.stream] upload file stream
   * @param {object} [credentials] credentials
   * @return {string | error}
   *
   * @api public
   */

  async upload(id, stream, { size, name, manual, conflictBehavior, ...rest }) {

    const app = this.app

    let { uploadId, uploadUrl, start } = await this.beforeUpload(rest.uploadId, { id, name, size, conflictBehavior})

    const done = async (newStream) => {
      let res = await app.request(uploadUrl, {
        method: 'put',
        data: newStream || stream,
        contentType: 'stream',
        signal: rest.signal,
        // responseType: 'text',
        headers: {
          'Content-Range': `bytes ${start}-${size - 1}/${size}`,
          'Content-Length': size - start,
        }
      })
      if (res.status != 201 && res.status != 202) {
        return this.app.error({ message: res.data?.error?.message || ('An error occurred during upload: ' + name) })
      }

      return {
        id: res.data.id,
        name: res.data.name,
        parent_id: id
      }
    }

    if (manual) {
      return {
        uploadId, start, done
      }
    } else {
      return await done(stream)
    }
  }


  async monitor(url, timeout = 8 * 1000) {
    console.log('[monitor]', url)
    let startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      let { data } = await this.app.request.get(url, { responseType: 'json' })

      if (data?.status == 'completed') {
        return { id: data.resourceId }
      }

      await sleep(200)
    }

  }
}

module.exports = { driver: Driver }
