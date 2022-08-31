//===Sharelist===
// @name         GoogleDrive
// @namespace    sharelist.plugin.googledrive
// @version      1.0.1
// @license      MIT
// @description  GoogleDrive
// @author       reruin@gmail.com
// @supportURL   https://github.com/reruin/sharelist
// @updateURL    https://raw.githubusercontent.com/linkdrive/sharelist-plugin/master/packages/googledrive/index.js
// @icon         https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png
//===/Sharelist==

/**
 * 1. Google Drive allows duplicate names
 * 2. The root folder also has a unique ID, it can use the alias root to refer to the root folder anywhere a file ID is provided
 */
 const API_ENDPOINT = 'https://www.googleapis.com'

 const DEFAULT_ROOT_ID = 'root'
 
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
     let { client_id, client_secret, redirect_uri, refresh_token, ...rest } = credentials
 
     if (!(client_id && client_secret && refresh_token)) {
       return { error: { message: 'Invalid parameters: An error occurred during refresh access token' } }
     }
 
     let formdata = {
       client_id,
       client_secret,
       // redirect_uri,
       refresh_token,
       grant_type: 'refresh_token',
     }
     let { data } = await this.app.request.post('https://oauth2.googleapis.com/token', {
       data: formdata,
       contentType: 'json',
       proxy: rest.proxy
     })
 
     if (data.error) {
       console.log(data, formdata)
       throw { message: data.error_description || data.error }
     }
 
     let expires_at = data.expires_in * 1000 + Date.now()
 
     credentials.access_token = data.access_token
     credentials.expires_at = expires_at

   }
 }
 
 
 class Driver {
   static options = {
     protocol: "googledrive",
 
     //支持全局搜索
     globalSearch: true,
     localSearch: true,
 
     key: 'client_id',
     defaultRoot: DEFAULT_ROOT_ID,
 
     guide: [
       { key: 'client_id', label: '应用ID / Client ID', type: 'string', required: true },
       { key: 'client_secret', label: '应用机密 / Client Secret', type: 'string', required: true },
       { key: 'redirect_uri', label: '回调地址 / Redirect URI', required: true },
       { key: 'refresh_token', label: '刷新令牌 / Refresh Token', type: 'string', required: true },
       { key: 'root_id', label: '初始文件夹ID / Rood ID', help: '', type: 'string', required: false },
       { key: 'proxy', label: '代理地址 / Proxy Server', help: '', type: 'string', required: false },
     ]
   }
 
   constructor(app, config) {
     this.app = app
     this.getConfig = Manager.getInstance(app, config)
     this.abusiveFilesMap = {}
   }
 
   //docs: https://developers.google.com/drive/api/v3/reference/files/list
   //per_page : 1-1000
   async list(id, { search, orderBy, perPage, nextPage } = {}) {
 
     const {
       request,
       utils: { timestamp },
     } = this.app
 
     let usePagination = !!perPage
 
     let { access_token, proxy } = await this.getConfig()
     const url = `${API_ENDPOINT}/drive/v3/files`
 
     const q = ['trashed = false', `'${id}' in parents`]
 
     if (search) {
       q.push(`name contains '${search}'`)
     }
 
     const params = {
       includeItemsFromAllDrives: true,
       supportsAllDrives: true,
       pageSize: usePagination ? perPage : 1000,
       fields: `nextPageToken, files(id,name,mimeType,parents,size,fileExtension,thumbnailLink,createdTime,modifiedTime,ownedByMe,md5Checksum)`,
       q: q.join(' and '),
     }
 
     // order_by
     // Valid keys are 'createdTime', 'folder', 'modifiedByMeTime', 'modifiedTime', 'name', 'name_natural', 'quotaBytesUsed', 'recency', 'sharedWithMeTime', 'starred', and 'viewedByMeTime'
     if (orderBy) {
       let [sortKey, sortType] = orderBy
       sortKey = sortKey == 'mtime' ? 'modifiedTime' : sortKey == 'size' ? 'quotaBytesUsed' : 'name'
       params.orderBy = 'folder,' + sortKey + ' ' + (sortType ? 'asc' : 'desc')
     } else {
       params.orderBy = 'folder'
     }
 
     let pageToken = nextPage, files = []
 
     do {
       let { data, error } = await request.get(url, {
         headers: {
           Authorization: `Bearer ${access_token}`,
         },
         data: { ...params, ...(pageToken ? { pageToken } : {}) },
         proxy
       })
       if (data.error) {
         // Exceeded
         if (data.error.code == 403 && data.error.message == 'Rate Limit Exceeded') {
 
         }
         return this.app.error({ code: data.error.code, message: data.error.message })
       }
 
       pageToken = data.nextPageToken
 
       //nextPageToken
       data.files.forEach((i) => {
         let item = {
           id: i.id,
           name: i.name,
           type: i.mimeType.includes('.folder') ? 'folder' : 'file',
           size: parseInt(i.size || 0),
           ctime: new Date(i.createdTime).getTime(),
           mtime: new Date(i.modifiedTime).getTime(),
           thumb: data.thumbnailLink,
           extra: {
             fid: i.id,
             //root also has a id, but it shouldn't be used here
             parent_id: id, // i.parents?.[0],
             md5: i.md5Checksum,
           },
         }
 
         if (item.type == 'file') {
           item.extra.mime = i.mimeType
         } else if (i.folder) {
           // item.extra.child_count = i.folder.childCount
         }
 
         files.push(item)
 
         if (id == DEFAULT_ROOT_ID && !this.realRootId) {
           this.realRootId = i.parents?.[0]
         }
 
       })
     } while (!usePagination && pageToken)
 
     let result = {
       id, files
     }
 
     if (usePagination && pageToken) {
       result.nextPage = pageToken
     }
 
     return result
   }
 
   //docs: https://developers.google.com/drive/api/v3/reference/files/get
   /**
    * get file
    *
    * @param {string} [id] path id
    * @param {string} [key] key
    * @return {object}
    *
    * @api public
    */
   async get(id) {
     let { access_token, proxy } = await this.getConfig()
 
     const {
       request,
       utils: { timestamp },
     } = this.app
 
     let url = `${API_ENDPOINT}/drive/v3/files/${id}`
     let { data } = await request.get(url, {
       headers: {
         Authorization: `Bearer ${access_token}`,
       },
       data: {
         // acknowledgeAbuse: true,
         fields: `*`,
       },
       proxy
     })
 
     if (data.error) return this.app.error({ message: data.error.message })
 
     return {
       id: data.id,
       name: data.name,
       type: data.mimeType.includes('.folder') ? 'folder' : 'file',
       size: data.size,
       ctime: timestamp(data.createdDateTime),
       mtime: timestamp(data.lastModifiedDateTime),
       thumb: data.thumbnailLink,
       extra: {
         fid: data.id,
         //root also has a id, but it shouldn't be used here
         parent_id: this.realRootId == data.parents?.[0] ? DEFAULT_ROOT_ID : data.parents?.[0],
         md5: data.md5Checksum,
         content_link: data.webContentLink,
       },
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
     let { access_token, proxy } = await this.getConfig()
 
     let { data } = await this.app.request.post(`${API_ENDPOINT}/drive/v3/files`, {
       headers: {
         Authorization: `Bearer ${access_token}`,
       },
       data: {
         'name': name,
         'parents': [parent_file_id],
         'mimeType': 'application/vnd.google-apps.folder',
       },
       contentType: 'json',
       proxy
     })
 
     if (data.error) return this.app.error({ message: data.error.message })
 
     return {
       id: data.id,
       name: data.name,
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
     let { access_token, proxy } = await this.getConfig()
 
     let { data } = await this.app.request(`${API_ENDPOINT}/drive/v3/files/${file_id}`, {
       method: 'PATCH',
       headers: {
         Authorization: `Bearer ${access_token}`,
       },
       data: {
         name,
       },
       contentType: 'json',
       proxy
     })
 
     if (data.error) return this.app.error({ message: data.error.message })
 
     return {
       id: data.id,
       name: data.name,
     }
   }
 
 
   /**
    * mv file/folder
    *
    * @param {string} [id] folder id
    * @param {string} [parent_id] folder id
    * @return {string | error}
    *
    * @api public
    */
   async mv(id, targetId, { name, copy } = {}) {
     if (copy) return await this.copy(id, targetId, { name })
 
     let { access_token, proxy } = await this.getConfig()
     let filedata = await this.get(id)
     let parentId = filedata?.extra.parent_id
     let params = {}
 
     if (name) params.name = name
 
     let { data } = await this.app.request(`${API_ENDPOINT}/drive/v3/files/${id}?addParents=${targetId}&removeParents=${parentId}`, {
       method: 'PATCH',
       headers: {
         Authorization: `Bearer ${access_token}`,
       },
       contentType: 'json',
       data: params,
       proxy
     })
 
     if (data.error) return this.app.error({ message: data.error.message })
 
     return {
       id: data.id,
       name: data.name,
       origin_parent_id: parentId
     }
   }
 
   /**
    * copy file/folder
    *
    * @param {string} [id] folder id
    * @return {string}
    *
    * @api public
    */
   async copy(id, destId, { name }) {
     let { access_token, proxy } = await this.getConfig()
 
     let dest = {
       parents: [destId]
     }
     if (name) dest.name = name
     console.log('copy', id, '-->', destId)
     let { status, data } = await this.app.request(`${API_ENDPOINT}/drive/v3/files/${id}/copy`, {
       method: "POST",
       headers: {
         Authorization: `Bearer ${access_token}`,
       },
       data: dest,
       contentType: 'json',
       proxy
     })
     console.log(status, data)
 
     if (data.error) return this.app.error({ message: data.error.message })
 
     return {
       id: data.id,
       name: data.name
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
     let { access_token, proxy } = await this.getConfig()
     let filedata = await this.get(file_id)
 
     let { status } = await this.app.request(`${API_ENDPOINT}/drive/v3/files/${file_id}`, {
       method: "DELETE",
       headers: {
         Authorization: `Bearer ${access_token}`,
       },
       responseType: 'text',
       proxy
     })
 
     if (status != 204) {
       return this.app.error({ message: 'An error occurred during delete files' })
     }
 
     return {
       id: file_id,
       parent_id: filedata.extra.parent_id
     }
   }
 
   async beforeUpload(parent_id, { name }) {
     let { access_token, proxy } = await this.getConfig()
 
     let { headers, status, data } = await this.app.request.post(`${API_ENDPOINT}/upload/drive/v3/files?uploadType=resumable`, {
       data: {
         name,
         parents: [parent_id]
       },
       headers: {
         Authorization: `Bearer ${access_token}`,
       },
       contentType: 'json',
       responseType: 'text',
       proxy
     })
     return headers?.location
   }
 
   /**
    * upload file
    *
    * @param {string} [id] folder id
    * @param {ReadableStream} [stream] upload file stream
    * @param {object} [options] upload file meta
    * @param {number} [options.size] upload file size
    * @param {string} [options.name] upload file name
    * @param {object} [credentials] credentials
    * @return {string | error}
    *
    * @api public
    */
   async upload(id, stream, { size, name, ...rest }) {
     const { app } = this
     let { proxy } = await this.getConfig()
 
     let uploadUrl = await this.beforeUpload(id, { name, size, ...rest })
 
     if (!uploadUrl) {
       return app.error('An error occurred during upload, miss upload url')
     }
 
     let { data } = await app.request(uploadUrl, {
       method: 'put',
       headers: {
         'Content-Length': size,
         'Content-Range': `bytes ${0}-${size - 1}/${size}`,
       },
       data: stream,
       contentType: 'stream',
       proxy
     })
 
     return {
       id: data.id,
       name: data.name,
       parent_id: id
     }
   }
   /**
    * check if it is a abusive file
    * @param {*} url 
    * @param {*} access_token 
    * @returns {boolean}
    */
   async isAbusiveFile(url, access_token) {
     let { proxy } = await this.getConfig()
 
     if (this.abusiveFilesMap[url]) {
       return this.abusiveFilesMap[url]
     } else {
       const resp = await this.app.request(url, {
         method: 'HEAD',
         headers: {
           Authorization: `Bearer ${access_token}`,
         },
         responseType: 'text',
         proxy
       })
 
       this.abusiveFilesMap[url] = resp.status == 403
 
       return this.abusiveFilesMap[url]
     }
   }
 
   async createReadStream(id, options = {}) {
 
     let { access_token, proxy } = await this.getConfig()
 
     let url = `${API_ENDPOINT}/drive/v3/files/${id}?alt=media`
 
     if (await this.isAbusiveFile(url, access_token)) {
       url += '&acknowledgeAbuse=true'
     }
 
     let headers = {
       Authorization: `Bearer ${access_token}`,
     }
 
     if ('start' in options) {
       headers['range'] = `bytes=${options.start}-${options.end || ''}`
     }
 
     let resp = await this.app.request.get(url, {
       headers,
       responseType: 'stream',
       retry: 0,
       proxy
     })
 
     return resp.data
   }
 
 }
 
 module.exports = { driver: Driver } 