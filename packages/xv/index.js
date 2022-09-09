//===Sharelist===
// @name         ⚡️XV⚡️
// @namespace    sharelist.plugin.xv
// @version      0.1.0
// @license      MIT
// @description  sharelist 演示插件，用于挂载全球访问量排名前10的某网站
// @author       reruin@gmail.com
// @supportURL   https://github.com/reruin/sharelist
// @updateURL    https://raw.githubusercontent.com/linkdrive/plugins/master/packages/xv/index.js
// @icon         https://www.xvideos.com/apple-touch-icon.png
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