//===Sharelist===
// @name         CMCCCloud
// @namespace    sharelist.plugin.cmcc
// @version      1.0.0
// @license      MIT
// @description  移动云盘
// @author       reruin@gmail.com
// @supportURL   https://github.com/reruin/sharelist
// @updateURL    https://raw.githubusercontent.com/linkdrive/plugins/master/packages/cmcc/index.js
//===/Sharelist==


/**
 * 1. taskType: 1 copy,2 remove,3 move
 */
 const crypto = require('crypto')

 const DEFAULT_ROOT_ID = '00019700101000000001'
 
 const UPLOAD_PART_SIZE = 10 * 1024 * 1024
 
 const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))
 
 const md5 = (v) => {
   return crypto.createHash('md5').update(v).digest('hex')
 }
 
 const getRandomSring = (e) => {
   let n = ''
   for (let t = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', a = 0; a < e; a++) {
     let o = Math.floor(Math.random() * t.length)
     n += t.substring(o, o + 1)
   }
   return n
 }
 
 
 //base64 encode
 const btoa = (v) => Buffer.from(v).toString('base64')
 
 const utob = (str) => {
   const u = String.fromCharCode
   return str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFFF]|[^\x00-\x7F]/g, (t) => {
     if (t.length < 2) {
       var e = t.charCodeAt(0);
       return e < 128 ? t : e < 2048 ? u(192 | e >>> 6) + u(128 | 63 & e) : u(224 | e >>> 12 & 15) + u(128 | e >>> 6 & 63) + u(128 | 63 & e)
     }
     e = 65536 + 1024 * (t.charCodeAt(0) - 55296) + (t.charCodeAt(1) - 56320);
     return u(240 | e >>> 18 & 7) + u(128 | e >>> 12 & 63) + u(128 | e >>> 6 & 63) + u(128 | 63 & e)
   })
 }
 
 const unicode = (s) => s.split('').map((c) => ('\\u' + ('0000' + c.charCodeAt(0).toString(16).toUpperCase()).slice(-4))).join('')
 
 const getNewSign = (e, t, a, n) => {
   let i = "";
   if (t) {
     let s = Object.assign({}, t);
     i = JSON.stringify(s),
       i = i.replace(/\s*/g, ""),
       i = encodeURIComponent(i);
     let c = i.split(""),
       u = c.sort();
     i = u.join("")
   }
   let A = md5(btoa(utob(i))),
     l = md5(a + ":" + n);
   return md5(A + l).toUpperCase()
 }
 
 const datetimeFormat = (d) =>
   d ? d.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4:$5:$6+08:00') : ''
 
 const moment = (a, expr = 'yyyy-MM-dd hh:mm:ss') => {
   let y = a.getFullYear(),
     M = a.getMonth() + 1,
     d = a.getDate(),
     D = a.getDay(),
     h = a.getHours(),
     m = a.getMinutes(),
     s = a.getSeconds(),
     w = a.getDay()
 
   const zeroize = v => `${v > 9 ? '' : '0'}${v}`
 
   return expr.replace(/(?:s{1,2}|w{1,2}|m{1,2}|h{1,2}|d{1,2}|M{1,4}|y{1,4})/g, function (str) {
 
     switch (str) {
       case 's':
         return s;
       case 'ss':
         return zeroize(s);
       case 'm':
         return m;
       case 'mm':
         return zeroize(m);
       case 'h':
         return h;
       case 'hh':
         return zeroize(h);
       case 'd':
         return d;
       case 'w':
         return w;
       case 'ww':
         return w == 0 ? 7 : w;
       case 'dd':
         return zeroize(d);
       case 'M':
         return M;
       case 'MM':
         return zeroize(M);
       case 'MMMM':
         return ['十二', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一'][m] + '月';
       case 'yy':
         return String(y).substr(2);
       case 'yyyy':
         return y;
       default:
         return str.substr(1, str.length - 2);
     }
   })
 }
 
 const createHeaders = (body) => {
   // let timestamp = Date.now()
   // let key = getRandomSring(16)
 
   let timestamp = moment(new Date())
   let key = getRandomSring(16)
   let sign = getNewSign(undefined, body, timestamp, key)
 
   let headers = {
     'x-huawei-channelSrc': '10000034',
     'x-inner-ntwk': '2',
     'mcloud-channel': '1000101',
     'mcloud-client': '10701',
     'mcloud-sign': timestamp + "," + key + "," + sign,
     // 'mcloud-skey': null,
 
     'content-type': "application/json;charset=UTF-8",
     'caller': 'web',
     'CMS-DEVICE': 'default',
     'x-DeviceInfo': '||9|85.0.4183.83|chrome|85.0.4183.83|||windows 10||zh-CN|||',
     'x-SvcType': '1',
     'referer': 'https://yun.139.com/w/',
 
   }
 
   // let headers = {
   //   caller: 'web',
   //   'CMS-CLIENT': '0010101',
   //   'CMS-DEVICE': 'default',
   //   'CMS-SIGN': timestamp + ',' + key + ',' + getSign(undefined, body, timestamp),
   //   'x-DeviceInfo': '||9|92.0.4515.107|chrome|92.0.4515.107|||windows 10||zh-CN|||',
   //   Referer: 'https://yun.139.com/w/',
   // }
 
   return headers
 }
 
 /**
  * auth manager class
  */
 /**
  * auth manager class
  */
 class Manager {
   static getInstance(app, config) {
     if (!this.instance) {
       this.instance = new Manager(app)
     }
 
     // this.instance.add(config)
     return this.instance.createGetter(config)
   }
 
   constructor(app) {
     this.app = app
   }
 
   createGetter(config) {
     return () => {
       if (
         config.mobile && config.token && config.account
       ) {
         return {
           ...config,
           cookie: `ORCHES-C-TOKEN=${config.token}; ORCHES-C-ACCOUNT=${config.account}; ORCHES-I-ACCOUNT-ENCRYPT=${btoa(config.mobile)}; `
         }
       }
 
       throw { message: 'unmounted', code: 500 }
     }
   }
 }
 
 const getRealId = v => [v.split('/').pop().replace('~', ''), v.includes('~'), v.split('/').slice(0, -1).join('/')]
 
 class Driver {
   static options = {
     protocol: "caiyun",
     //支持全局搜索
     globalSearch: true,
     localSearch: true,
 
     uploadHash: 'md5',
     hash: 'md5',
     key: 'mobile',
     defaultRoot: DEFAULT_ROOT_ID,
 
     guide: [
       { key: 'account', label: 'ORCHES-C-ACCOUNT', type: 'string', help: '登录官网从cookies中获取ORCHES系列参数', required: true },
       { key: 'token', label: 'ORCHES-C-TOKEN', type: 'string', required: true },
       { key: 'mobile', label: '手机号', type: 'string', required: true },
       { key: 'root', label: '初始目录ID', type: 'string', required: false },
     ]
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
   * @param {object} [options.sort] sort
   * @param {object} [options.search] search
   * @param {string} [key] key
   * @return {array}
   *
   * @api public
   */
   async list(id, { search, orderBy, perPage, nextPage } = {}) {
     let { cookie, mobile } = await this.getConfig()
     let [fid, isFile] = getRealId(id)
 
     if (isFile) {
       return []
     }
 
     const {
       request,
       utils: { timestamp },
     } = this.app
 
     let usePagination = !!perPage
 
     let offset = nextPage || 0, size = perPage || 200, files = []
 
     do {
       let params = {
         catalogID: fid,
         sortDirection: 1,
         filterType: 0,
         catalogSortType: 0,
         contentSortType: 0,
         startNumber: offset + 1,
         endNumber: offset + size,
         commonAccountInfo: { account: mobile, accountType: 1 }
       }
 
       if (orderBy) {
         let [sortKey, isAsc] = orderBy
         params.catalogSortType = params.contentSortType = sortKey == 'name' ? '0' : sortKey == 'ctime' ? '1' : '0'
         params.sortDirection = isAsc ? 1 : 0
       }
 
       let { data } = await request.post('https://yun.139.com/orchestration/personalCloud/catalog/v1.0/getDisk', {
         data: params,
         headers: {
           ...createHeaders(params),
           cookie,
         },
         contentType: 'json',
       })
 
 
       if (!data.success) {
         console.log(data)
         return this.app.error({ message: data.message })
       }
 
       if (data.data.result.resultCode != '0') this.app.error({ message: data.data.result.resultDesc })
 
       data = data.data.getDiskResult
 
       if (data?.catalogList) {
         for (let i of data.catalogList) {
           files.push({
             id: id + '/' + i.catalogID,
             name: i.catalogName,
             type: 'folder',
             size: i.size,
             ctime: timestamp(datetimeFormat(i.createTime)),
             mtime: timestamp(datetimeFormat(i.updateTime)),
             extra: {
               fid: id + '/' + i.catalogID,
               parent_id: id,
             },
           })
         }
       }
 
       if (data?.contentList) {
         for (let i of data.contentList) {
           files.push({
             id: id + '/~' + i.contentID,
             name: i.contentName,
             type: 'file',
             size: i.contentSize,
             ctime: timestamp(datetimeFormat(i.uploadTime)),
             mtime: timestamp(datetimeFormat(i.updateTime)),
             thumb: i.thumbnailURL,
             extra: {
               fid: id + '/~' + i.contentID,
               parent_id: id,
               md5: i.digest,
               // path: i.path,
               preview_url: i.presentURL
             },
           })
         }
       }
 
       if (offset + size < parseInt(data.nodeCount)) {
         offset += size
       } else {
         offset = null
         break
       }
     } while (!usePagination && offset)
 
     let result = {
       id, files
     }
 
     if (usePagination && offset) {
       result.nextPage = offset
     }
 
     return result
   }
 
   // caiyun 没有获取文件详情的单独接口
   // 缺少name !!
   async get(id) {
     let paths = id.split('/')
     let [fid, isFile] = getRealId(id)
 
     const data = {
       id,
       type: isFile ? 'file' : 'folder',
       extra: {
         fid: id,
         parent_id: paths.slice(0, -1).join('/')
       },
     }
 
     if (data.type == 'file') {
       let { url, max_age } = await this.get_download_url(id)
       data.download_url = url
       data.max_age = max_age
     }
     return data
   }
 
   async get_download_url(id) {
     let { cookie, mobile } = await this.getConfig()
     let [fid, isFile] = getRealId(id)
 
     const { request } = this.app
 
     let params = {
       appName: '',
       contentID: fid,
       commonAccountInfo: { account: mobile, accountType: 1 }
     }
 
     let headers = createHeaders(params)
 
     try {
 
       let { data } = await request.post('https://yun.139.com/orchestration/personalCloud/uploadAndDownload/v1.0/downloadRequest', {
         data: params,
         headers: {
           ...headers,
           'User-Agent':
             'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
           cookie,
 
         },
         contentType: 'json',
       })
       if (data?.data?.downloadURL) return { url: data.data.downloadURL, max_age: 1 * 60000 }
     } catch (e) {
       return {}
     }
 
   }
 
   async mkdir(parentId, name, { check_name_mode = 'refuse' }) {
     const { request } = this.app
     let { cookie, mobile } = await this.getConfig()
     let [fid] = getRealId(parentId)
 
     let params = {
       createCatalogExtReq: {
         parentCatalogID: fid,
         newCatalogName: name,
         commonAccountInfo: { account: mobile, accountType: 1 }
       }
     }
 
     let headers = createHeaders(params)
 
     let { data } = await request.post('https://yun.139.com/orchestration/personalCloud/catalog/v1.0/createCatalogExt', {
       data: params,
       headers: {
         ...headers,
         'User-Agent':
           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
         cookie,
       },
       contentType: 'json',
     })
 
     if (!data.success) return this.app.error({ message: data.message })
 
     if (data.data.result.resultCode != '0') return this.app.error({ message: data.data.result.resultDesc })
 
     let file_id = data.data.catalogInfo.catalogID
 
     /*
     parentCatalogId: "0511YJIR62Bj00019700101000000043"
     path: "00019700101000000001/0511YJIR62Bj00019700101000000043/0511YJIR62Bj06720210909171001rec"
     */
     return {
       id: parentId + '/' + file_id,
       name,
       parent_id: parentId
     }
   }
 
   async rename(id, name, { check_name_mode = 'refuse' } = {}) {
     console.log('rename', id, name)
     const { request } = this.app
 
     let { cookie, mobile } = await this.getConfig()
 
     let [fid, isFile, parent_id] = getRealId(id)
 
     let params = {
       [isFile ? 'contentID' : 'catalogID']: fid,
       [isFile ? 'contentName' : 'catalogName']: name,
       commonAccountInfo: { "account": mobile, "accountType": 1 }
     }
 
     let headers = createHeaders(params)
 
     let { data } = await request.post(`https://yun.139.com/orchestration/personalCloud/${isFile ? 'content' : 'catalog'}/v1.0/${isFile ? 'updateContentInfo' : 'updateCatalogInfo'}`, {
       data: params,
       headers: {
         ...headers,
         'User-Agent':
           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
         cookie,
       },
       contentType: 'json',
     })
 
     if (!data.success) {
       if (data.code == '1010010005') {
         return this.app.error({ code: 404 })
       }
       return this.app.error({ message: data.message })
     }
 
     if (data.data.result.resultCode != '0') return this.app.error({ message: data.data.result.resultDesc })
 
     return {
       id,
       name: data.data.updateContentInfoRes?.contentName || data.data.updateCatalogRes.catalogName,
       parent_id
     }
 
   }
 
   async rm(id) {
     const { request } = this.app
     const { cookie, mobile } = await this.getConfig()
     let [fid, isFile, parent_id] = getRealId(id)
     console.log(fid, isFile, parent_id)
     let params = {
       "createBatchOprTaskReq": {
         "taskType": 2,
         "actionType": 201,
         "taskInfo": {
           "newCatalogID": "",
           [isFile ? 'contentInfoList' : 'catalogInfoList']: [fid]
         },
         "commonAccountInfo": { "account": mobile, "accountType": 1 }
       }
     }
 
     let headers = createHeaders(params)
 
     let { data, error } = await request.post('https://yun.139.com/orchestration/personalCloud/batchOprTask/v1.0/createBatchOprTask', {
       data: params,
       headers: {
         ...headers,
         'User-Agent':
           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
         cookie,
       },
       contentType: 'json',
     })
     if (!data.success) return this.app.error({ message: data.message })
     if (data.data.result.resultCode != '0') return this.app.error({ message: data.data.result.resultDesc })
 
     let taskId = data.data.createBatchOprTaskRes.taskID
 
     await this.monitor(taskId)
 
     return { id, parent_id }
   }
 
   /**
    * mv file/folder
    *
    * @param {string} [id] folder id
    * @return {string | error}
    *
    * @api public
    */
   async mv(id, target_id, { name, copy }) {
     console.log('copy', copy)
     const { request } = this.app
     const { cookie, mobile } = await this.getConfig()
     let [fid, isFile, origin_parent_id] = getRealId(id)
     let [destFid] = getRealId(target_id)
     let params = {
       "createBatchOprTaskReq": {
         "taskType": copy ? 1 : 3,
         "actionType": copy ? '309' : '304',
         "taskInfo": {
           "contentInfoList": [],
           "catalogInfoList": [],
           "newCatalogID": destFid,
           [isFile ? 'contentInfoList' : 'catalogInfoList']: [fid]
         },
         "commonAccountInfo": { "account": mobile, "accountType": 1 }
       }
     }
 
     let headers = createHeaders(params)
 
     let { data } = await request.post('https://yun.139.com/orchestration/personalCloud/batchOprTask/v1.0/createBatchOprTask', {
       data: params,
       headers: {
         ...headers,
         'User-Agent':
           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
         cookie,
       },
       contentType: 'json',
     })
 
     if (!data.success) return this.app.error({ message: data.message })
 
     if (data.data.result.resultCode != '0') return this.app.error({ message: data.data.result.resultDesc })
 
     let taskId = data.data.createBatchOprTaskRes.taskID
 
     let newData = await this.monitor(taskId)
 
     if (newData) {
       let newId = target_id + '/' + (isFile ? '~' : '') + newData.id
       console.log(newId)
       if (name) {
         await this.rename(newId, name)
       }
       return { id: newId, origin_parent_id }
     }
 
     //不支持目的地存在相同文件，也不支持复制/移动时重命名。 
     return this.app.error({ message: '', code: 501 })
   }
 
   async hashFile(fileId, { name, hash }) {
     let res = await this.beforeUpload(fileId, {
       name, size: 1, md5: hash
     })
 
     let fastSave = !res.redirectionUrl
     if (fastSave) {
       return {
         id: fileId + '/~' + res.newContentIDList[0].contentID
       }
     } else {
       return {}
     }
   }
 
   async monitor(taskId, timeout = 5 * 1000) {
     const { request } = this.app
     const { cookie, mobile } = await this.getConfig()
     let startTime = Date.now()
 
     let params = {
       "queryBatchOprTaskDetailReq": {
         "taskID": taskId,
         "commonAccountInfo": { "account": mobile, "accountType": 1 }
       }
     }
 
     while (Date.now() - startTime < timeout) {
       let headers = createHeaders(params)
 
       let { data, error } = await request.post('https://yun.139.com/orchestration/personalCloud/batchOprTask/v1.0/queryBatchOprTaskDetail', {
         data: params,
         headers: {
           ...headers,
           'User-Agent':
             'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
           cookie,
         },
         contentType: 'json',
       })
 
       if (data?.data?.queryBatchOprTaskDetailRes?.batchOprTask?.progress == 100) {
         let taskType = data.data.queryBatchOprTaskDetailRes.batchOprTask.taskType
         let destId, base = data.data.queryBatchOprTaskDetailRes
 
         // copy get destId
         if (taskType == 1) {
           destId = base.contentList?.[0]?.rstId || base.catalogList?.[0]?.rstId
         } else {
           destId = base.contentList?.[0]?.srcId || base.catalogList?.[0]?.srcId
         }
         return { id: destId }
       }
 
       await sleep(500)
     }
 
   }
 
   async resumeUpload(uploadId, retry = 2) {
     const { cookie, mobile } = await this.getConfig()
 
     let [taskId, path, contentId] = uploadId.split('-')
     console.log('resumeUpload', taskId, path, contentId)
     let params = {
       "account": '',
       "taskList": [{
         "contentID": contentId,
         "path": path,
         "taskID": taskId
       }],
       "commonAccountInfo": { "account": mobile, "accountType": 1 }
     }
 
     let { data } = await this.app.request.post('https://yun.139.com/orchestration/personalCloud/uploadAndDownload/v1.0/syncUploadTaskInfo', {
       data: params,
       headers: {
         ...createHeaders(params),
         'User-Agent':
           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
         cookie,
       },
       contentType: 'json',
     })
 
     //签名校验失败
     if (data.code == '1010010014' && retry > 0) {
       // retry
       console.log('RETRY', JSON.stringify(data))
       return await resumeUpload(uploadId, retry--)
     }
     if (!data.success) {
       return {
         error: { message: '[' + data.data?.result.resultCode || 'unknow' + ']' + data.message }
       }
     }
     //this.app.error({ message: '[' + data.data.result.resultCode + ']' + data.message })
 
     // console.log('resume from', data.data.array[0].fileUploadInfos[0])
     return {
       start: +data.data.array[0].fileUploadInfos[0].pgs,
       taskId,
       contentId,
       uploadUrl: data.data.array[0].uploadURL
     }
   }
 
   async beforeUpload(id, { name, size, md5 }) {
     const { cookie, mobile } = await this.getConfig()
     const [fid] = getRealId(id)
 
     const params = {
       "manualRename": 2,
       "operation": 0,
       "fileCount": 1,
       "totalSize": size,
       "uploadContentList": [{
         "contentName": name,
         "contentSize": size,
         // "digest": "5a3231986ce7a6b46e408612d385bafa"
       }],
       "parentCatalogID": fid,
       "newCatalogName": "",
       "commonAccountInfo": { "account": mobile, "accountType": 1 }
     }
 
     if (md5) {
       params.uploadContentList[0].digest = md5
     }
     //console.log(params)
 
     let headers = createHeaders(params)
 
     let { data } = await this.app.request.post('https://yun.139.com/orchestration/personalCloud/uploadAndDownload/v1.0/pcUploadFileRequest', {
       data: params,
       headers: {
         ...headers,
         'User-Agent':
           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
         cookie,
       },
       contentType: 'json',
     })
 
     if (!data.success) return this.app.error({ message: data.message })
 
     if (data.data.result.resultCode != '0') return this.app.error({ message: data.data.result.resultDesc })
 
     let res = data.data.uploadResult
 
     return {
       uploadUrl: res.redirectionUrl,
       taskId: res.uploadTaskID,
       contentId: res.newContentIDList[0].contentID
     }
   }
 
   async upload(parent_id, stream, { size, name, manual, ...rest }) {
     const { app } = this
     const [fid] = getRealId(parent_id)
     console.log('UPLOAD', rest.uploadId)
     let res = rest.uploadId ?
       await this.resumeUpload(rest.uploadId) :
       await this.beforeUpload(parent_id, { name, size, ...rest })
 
     if (rest.uploadId) {
       console.log('resume', res)
     }
     //恢复状态发生错误，尝试重新创建
     if (rest.uploadId && res.error) {
       console.log('create new upload session', res.error)
       res = await this.beforeUpload(parent_id, { name, size, ...rest })
     }
 
     let { uploadUrl, taskId, contentId, start = 0 } = res
 
     // fast upload
     if (!uploadUrl) {
       console.log('fast upload success')
       //no need
       let ret = { id: parent_id + '/~' + contentId, name, parent_id }
 
       if (manual) {
         ret.completed = true
       }
 
       return ret
     }
 
     let uploadId = taskId + '-' + fid + '-' + contentId
     const done = async (customStream) => {
       let { status, data } = await app.request.post(uploadUrl, {
         data: customStream || stream,
         contentType: 'stream',
         responseType: 'text',
         signal: rest.signal,
         highWaterMark: 1024 * 1024,
         headers: {
           'Accept': '*/*',
           'Content-Type': `text/plain;name=${unicode(name)}`,
           'contentSize': size,
 
           'range': `bytes=${start}-${size - 1}`,
           'content-length': size - start,
 
           'uploadtaskID': taskId,
           'rangeType': 0,
           'Referer': 'https://yun.139.com/',
           'x-SvcType': 1,
           'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'
         }
       })
 
 
       console.log(data)
       if (status != 200) return this.app.error({ code: status })
 
       return { id: parent_id + '/~' + contentId, name, parent_id }
 
     }
 
     if (manual) {
       return {
         uploadId, start, done
       }
     } else {
       return await done(stream)
     }
 
     // let passStream = app.streamReader(stream, { highWaterMark: 1.5 * UPLOAD_PART_SIZE })
     // let part = Math.ceil(size / UPLOAD_PART_SIZE)
     // let point = 0
     // for (let i = 0; i < part; i++) {
     //   let buffer = await passStream.read(UPLOAD_PART_SIZE)
     //   let ret = await app.request.post(upload_url, {
     //     data: buffer,
     //     contentType: 'buffer',
     //     responseType: 'text',
     //     headers: {
     //       'Accept': '*/*',
     //       'Content-Type': `text/plain;name=${unicode(name)}`,
     //       'contentSize': size,
 
     //       'range': `bytes=${point}-${point + buffer.length - 1}`,
     //       'content-length': buffer.length,
 
     //       'uploadtaskID': taskId,
     //       'rangeType': 0,
     //       'Referer': 'https://yun.139.com/',
     //       'x-SvcType': 1,
     //       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'
     //     }
     //   })
     //   console.log(ret, '<<')
     //   point += buffer.length
     // }
 
   }
 }
 
 module.exports = { driver: Driver }