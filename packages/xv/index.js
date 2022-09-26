//===Sharelist===
// @name         ⚡️XV⚡️
// @namespace    sharelist.plugin.xv
// @version      0.1.0
// @license      MIT
// @description  sharelist 演示插件，用于挂载全球访问量排名前10的某网站
// @author       reruin@gmail.com
// @supportURL   https://github.com/reruin/sharelist
// @updateURL    https://raw.githubusercontent.com/linkdrive/plugins/master/packages/xv/index.js
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMjUiIGVuYWJsZS1iYWNrZ3JvdW5kPSJuZXcgMCAwIDU4NCAxNDkiPgogIDxwYXRoIHN0cm9rZS13aWR0aD0iLjA0NCIgZD0iTS40MzQuNzAzaDk5LjIwN3YyMy44MjRILjQzNHoiLz4KICA8cGF0aCBkPSJNMTEuMDY3IDkuODkzbDIuNjY2LTUuNDU3aDQuMzRsLTQuNjM1IDguMDE1IDQuOTkyIDguMTU0aC00LjU1N2wtMi43Ni01LjU2NS0yLjc2IDUuNTY1aC00LjM0bDQuNzYtOC4xNTQtNC42MzYtOC4wMTVoNC4yOTR6IiBmaWxsPSIjZGUyNjAwIi8+CiAgPHBhdGggZD0iTTc0LjMgNC4xODhjLTIuMDQ2IDAtMy43MDQuNjM3LTQuOTc2IDEuOTM5LTEuMjcxIDEuMzAyLTEuOTA2IDIuOTQzLTEuOTA2IDQuOTI4djIuOTE2YzAgMiAuNjM1IDMuNjQzIDEuOTA2IDQuOTMgMS4yNzIgMS4yODYgMi45NDYgMS45MzcgNC45OTIgMS45MzcgMi4wMzEgMCAzLjY5LS42NTEgNC45NDYtMS45MzggMS4yNTYtMS4zMDIgMS44OS0yLjkzIDEuODktNC45M2guMDE2di0yLjkxNWMwLTItLjYzNS0zLjYyNi0xLjkwNi00LjkyOC0xLjI4Ny0xLjI4Ny0yLjkzLTEuOTQtNC45NjEtMS45NHptMTUuMDA3LjAxNWMtMS43OTggMC0zLjI4Ny40Mi00LjQ2NSAxLjI1Ni0xLjE3OC44MzctMS43NjggMS45MzktMS43NjggMy4yODcgMCAxLjM5NS40ODEgMi40NSAxLjQ3MyAzLjE5My45NzcuNzQ1IDIuNDk3IDEuNDI3IDQuNTQzIDIuMDc5Ljk3Ny4zNTYgMS42NTkuNjgyIDIuMDMxLjk5Mi4zODcuMzEuNTc0Ljc0My41NzQgMS4zMTYgMCAuNDk3LS4yMDIuOS0uNTU4IDEuMjI1LS4zNzIuMzEtLjk2Mi40NjUtMS43MzcuNDY1LTEuMDIzIDAtMS43OTgtLjItMi4yOTUtLjYwNC0uNTExLS40MDMtLjc2LTEuMDctLjc2LTJoLTMuNjU3bC0uMDE2LjA2M2MtLjA0NyAxLjczNi42MiAzLjA3IDEuOTUzIDMuOTg0IDEuMzMzLjkxNSAyLjkxNSAxLjM3OSA0Ljc2IDEuMzc5IDEuODMgMCAzLjMwMS0uNDAyIDQuNDAyLTEuMjEgMS4xLS43OSAxLjY1OC0xLjkwNyAxLjY1OC0zLjMzMyAwLTEuMzk2LS40NjQtMi40OTYtMS4zOTQtMy4zMDMtLjkzLS43OS0yLjMxLTEuNDctNC4xNTUtMi4wMTMtMS4xOTQtLjQzNS0xLjk5OS0uNzkyLTIuNDMzLTEuMDctLjQzNC0uMjgtLjY1Mi0uNjUyLS42NTItMS4xMzIgMC0uNDk2LjIxOC0uOTE1LjY1Mi0xLjI0LjQzNC0uMzI2IDEuMDIyLS40OTYgMS43ODEtLjQ5Ni43NzUgMCAxLjM4LjIgMS44MTUuNjA0LjQzNC40MDMuNjUyLjkxNS42NTIgMS41NjZoMy42NDNsLjAxNS0uMDYzYy4wNDctMS40NTctLjUxMy0yLjY1LTEuNjYtMy41NjQtMS4xNDctLjkxNS0yLjYwNC0xLjM4LTQuNDAyLTEuMzh6bS0zNC4yNDQuMjMzdjE2LjE3SDY2LjN2LTIuODgzaC03LjQ3VjEzLjY5aDYuMzM5di0yLjloLTYuMzQydi0zLjQ3aDcuNTA0VjQuNDM1aC0xMS4yN3ptLTM2Ljc3Mi4wMDJsNS4yMjUgMTYuMTgzaDQuMDZsNS4yNC0xNi4xODNIMjguODhsLTMuMjEgMTEuODI2LS4xMDguNTQzSDI1LjVsLS4xMS0uNTg4TDIyLjIzIDQuNDM4SDE4LjI5em0xNS44MTMgMHYxNi4xNjdoMy43NTFWNC40MzhoLTMuNzUxem02LjMwOCAwdjE2LjE4MWg1Ljg0NmMxLjkwNiAwIDMuNDg2LS42MiA0Ljc3My0xLjg2IDEuMjg4LTEuMjM5IDEuOTI0LTIuODIgMS45MjQtNC43NzNWMTEuMDdjMC0xLjkzNy0uNjM3LTMuNTMzLTEuOTI0LTQuNzczLTEuMjcxLTEuMjQtMi44NjctMS44Ni00Ljc3My0xLjg2aC01Ljg0NnptMzMuODU4IDIuNjVjLjk5MiAwIDEuNzY3LjM3IDIuMzEgMS4xMTUuNTQzLjcyOS44MiAxLjY3NS44MiAyLjgzOGwuMDAyIDIuOTNjMCAxLjE3OC0uMjY0IDIuMTIyLS44MDYgMi44NjctLjU0My43NDQtMS4zMDMgMS4xMTctMi4yOTUgMS4xMTctMS4wMjMgMC0xLjgtLjM3My0yLjM0Mi0xLjExN3MtLjgyLTEuNzA1LS44Mi0yLjg2N3YtMi45M2MwLTEuMTYzLjI2My0yLjEwOS44MDYtMi44NTMuNTI3LS43MyAxLjMxNy0xLjEgMi4zMjUtMS4xem0tMzAuMDkuMjQ2aDEuODNjLjk5MiAwIDEuNzgxLjM0MSAyLjM0IDEuMDIzLjU1OC42ODMuODM4IDEuNTgxLjgzOCAyLjY5OHYyLjkzMWMwIDEuMTE2LS4yOCAyLjAzMS0uODM4IDIuNzEzLS41NTkuNjgyLTEuMzMzIDEuMDIyLTIuMzQgMS4wMjJoLTEuODNWNy4zMzR6IiBmaWxsPSIjZmZmIiBzdHJva2Utd2lkdGg9Ii4yMTkiLz4KPC9zdmc+Cg==
//===/Sharelist==

const HOST = Buffer.from('aHR0cHM6Ly93d3cueHZpZGVvcy5jb20=', 'base64').toString();

const decode = v => Buffer.from(v, 'base64').toString()

const encode = v => Buffer.from(v).toString('base64')

const re = v => v.split('').reverse().join('')

const UA = `Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36`

const getListUrl = (id, sk, page = 1) => {
  let tag = id != '@' ? decode(id) : ''
  let key
  if (sk) {
    key = `/?k=${sk}&p=${page}`
  }
  else if (tag.startsWith('/' + re('nrop')) || tag.startsWith('/lang')) {
    key = tag + '/' + page
  }
  else if (/^\/c\//.test(tag)) {
    key = tag.replace('c/', 'c/' + page + '/')
  }
  else if (/^\/\?k=/.test(tag)) {
    key = tag + '&p=' + page
  }
  else {
    key = '/new/' + page
  }
  return HOST + key
}

class Driver {

  static options = {
    globalSearch: true,
    localSearch: false,
    protocol: "xv",
    cache: false,
    guide: [
      { key: 'zone', label: '地区 / Zone', help: '不同国家对应不同推荐内容，填写 cn/en/jp 等', type: 'string', required: false },
      { key: 'group', label: '页码分组', type: 'boolean', help: '', required: false },
      { key: 'proxy', label: '代理地址', help: '设置后该挂载盘的所有请求均使用此代理。支持HTTP/HTTPS', type: 'string', required: false },
    ]
  }

  /**
   * 
   * @param {*} app 
   * @param {*} config 默认配置(响应式)
   */
  constructor(app, config) {
    this.app = app
    this.config = config

    // this.getConfig = Manager.getInstance(app, config)
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
   * files.id 资源ID
   * files.name 资源名
   * files.size 资源大小
   * files.type 类型 'folder' | 'file'
   * files.ctime 创建时间
   * files.mtime 修改时间
   */
  async list(id, { search, orderBy, perPage, nextPage } = {}) {
    let usePagination = !!perPage

    //使用自然分页
    nextPage = nextPage || 1

    if (!id) {
      if (nextPage > 1) return { files: [] }
      else return {
        files: await this.getCats()
      }
    }
    if (!id.startsWith('@')) {
      return { files: [] }
    }


    let url = getListUrl(id.substring(1), search, nextPage)

    let res = await this.app.request.get(url, {
      proxy: this.config.proxy,
      responseType: 'text',
      'user-agent': UA
    })
    let files = []
    const htmlEntity = this.app.utils.htmlEntity
    res.data?.replace(/<img[\w\W]+?data-src="([^"]+?)"[\w\W]+?<a href="([^"]+?)"\s+title="([^"]+?)"/g, ($0, $1, $2, $3) => {
      files.push({
        id: encode($2),
        name: htmlEntity.decode($3) + '.mp4', //$3 is title
        type: 'file',
        size: 0,
        mime: 'video/mp4',
        ctime: Date.now(),
        mtime: Date.now(),
        extra: {
          sources: [
            { size: 480, quality: 'LD' },
            { size: 720, quality: 'HD' }
          ]
        },
        thumb: $1,
      })
    })

    return { id, files, nextPage: nextPage++ }
  }


  //获取分类
  async getCats() {
    const ua = `Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36`
    if (!this.cats) {
      let zone = this.config.zone || 'cn'
      let proxy = this.config.proxy

      let { data, headers } = await this.app.request.get(`${HOST}/change-country/${zone}`, {
        // followRedirect: false,
        responseType: 'text',
        headers: {
          'User-Agent': ua,
        },
        proxy
      })
      const cats = [{
        id: '@',
        name: '所有',
        type: 'folder',
        size: 0,
        ctime: Date.now(),
        mtime: Date.now(),
      }]

      data.replace(/<span[^>]+><\/span>/g, '').replace(/<li class="dyn[^>]+?><a[\w\W]+?href="([^"]+?)"[^>]*?>([^<]+?)<\/a><\/li>/g, ($0, $1, $2) => {
        cats.push({
          id: '@' + encode($1),
          name: $2.replace(/^\s*/, ''),
          type: 'folder',
          size: 0,
          ctime: Date.now(),
          mtime: Date.now(),
        })
        return ''
      })

      this.cats = cats
    }
    return this.cats.map(i => ({ ...i }))
  }

  /**
   * 获取文件详情
   * @param {*} id 文件(目录)id 唯一值
   * @param {*} key 
   */
  async get(id) {
    if (id == 'root') {
      return {
        id: 'root',
        name: '@root',
        type: 'folder'
      }
    }
    const pathname = decode(id)

    let { data } = await this.app.request.get(HOST + pathname, {
      responseType: 'text',
      'user-agent': UA,
      proxy: this.config.proxy

    })

    let url_low = (data.match(/setVideoUrlLow\('([^'"]+?)'/) || ['', ''])[1]

    let url_high = (data.match(/setVideoUrlHigh\('([^'"]+?)'/) || ['', ''])[1]

    let url_hls = (data.match(/setVideoHLS\('([^'"]+?)'/) || ['', ''])[1]

    let thumb = (data.match(/setThumbUrl169\('([^'"]+?)'/) || ['', ''])[1]

    let name = (data.match(/setVideoTitle\('([^'"]+?)'/) || ['', ''])[1]

    let result = {
      id: id,
      name: `${name}.mp4`,
      size: 0,
      type: 'file',
      ctime: Date.now(),
      mtime: Date.now(),
      thumb,
      download_url: url_low,
      extra: {
        parent_id: 'root',
        category: 'video',
        sources: [
          { name: 'LD', src: url_low },
          { name: 'HD', src: url_high },
        ]
      }
    }

    if (this.config.proxy) {
      result.extra.proxy = {
        proxy_server: this.config.proxy,
        headers: {
          'user-agent': UA,
          'referer': HOST
        },
      }
    }

    return result
  }

}

module.exports = { driver: Driver }