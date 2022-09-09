//===Sharelist===
// @name         VirtualDrive
// @namespace    sharelist.plugin.vdrive
// @version      1.0.14
// @license      MIT
// @description  sharelist 内置的虚拟网盘，使用yaml/json进行描述。
// @author       reruin@gmail.com
// @supportURL   https://github.com/reruin/sharelist
// @updateURL    https://raw.githubusercontent.com/linkdrive/plugins/master/packages/vdrive/index.js
//===/Sharelist==
const yaml = require('yaml')

const { URL } = require('url')

const crypto = require('crypto')

const fs = require('fs')

const os = require('os')

const md5 = (v) => {
  return crypto.createHash('md5').update(v).digest('hex')
}
const decode = v => decodeURIComponent(Buffer.from(v, 'base64').toString())

const encode = v => Buffer.from(encodeURIComponent(v)).toString('base64')

const isWinOS = os.platform() == 'win32'

const winStyle = (p) =>
  p
    .replace(/^\/([^\/]+?)/, '$1:\\')
    .replace(/\//g, '\\')
    .replace(/(?<!\:)\\+$/, '')
    .replace(/\\{2,}/g, '\\')

const ospath = (p, base = '') => {
  p = base + p
  return isWinOS ? winStyle(p) : (p)
}

const diskMap = {}
const parse = (id) => {
  let data = new URL(id)

  let rootId = data.hostname
  let path = data.pathname.replace(/^\/+/, '').split('/')
  return {
    disk: diskMap[rootId],
    path,
  }
}
class Driver {
  static options = {
    globalSearch: false,
    localSearch: true,
    protocol: "vdrive",
    cache: false,
    pagination: false,
    guide: [
      { key: 'src', label: '目录地址', type: 'string', help: '可指定远程地址(HTTP/HTTPS协议) 或者 本地文件(posix风格)', required: true },
    ],
  }

  constructor(app, config) {
    this.app = app
    this.config = config
  }

  async getRoot() {
    if (!this.key) {
      let rootId = this.config.src
      let key = md5(rootId)
      this.key = key
      diskMap[key] = {
        id: rootId
      }

      if (/^https?/i.test(rootId)) {
        let res = await this.app.request(rootId, {
          responseType: 'text'
        })
        let json = yaml.parse(res)
        diskMap[key].data = json
      } else {
        try {
          let res = fs.readFileSync(ospath(rootId), { encoding: 'utf-8' })
          let json = yaml.parse(res)
          diskMap[key].data = json
        } catch (e) {
          console.log(e)
          throw { message: 'can not read rootId' }
        }
      }
    }

    return { children: diskMap[this.key].data }
  }

  async list(id, { search, orderBy } = {}) {
    let disk = await this.getRoot()

    id = id || 'root'

    let path = id == 'root' ? [] : id.split('/').filter(Boolean).map(decode)
    if (disk) {
      for (let i = 0; i < path.length && disk; i++) {
        if (!disk.children) {
          throw { code: 404 }
        }
        disk = disk.children.find((j) => j.name == decodeURIComponent(path[i])) //[ parseInt(path[i]) ]
      }
      let isDir = (disk.children && !disk.url)

      if (isDir) {
        return {
          id,
          files: disk.children.map(i => ({
            id: [...path, i.name].map(encode).join('/'),
            name: i.name,
            type: (i.children && !i.url) ? 'folder' : 'file',
            size: i.size || 0,
          }))
        }
      }

    }

    throw { code: 404 }

  }

  async get(id) {
    if (!id) {
      return {
        id: '@drive_root',
        name: '@drive_root'
      }
    }

    let disk = await this.getRoot()

    let path = id.split('/').filter(Boolean).map(decode)
    if (disk) {
      for (let i = 0; i < path.length && disk; i++) {
        disk = disk.children.find((j) => j.name == path[i]) //[ parseInt(path[i]) ]
      }

      return {
        id,
        name: disk.name,
        size: disk.size,
        type: (disk.children && !disk.url) ? 'folder' : 'file',
        ctime: Date.now(),
        mtime: Date.now(),
        download_url: disk.url,
        extra: {
          parent_id: path.slice(0, -1).filter(Boolean).map(encode).join('/')
        }
      }
    }

    throw { code: 404 }
  }
}

module.exports = { driver: Driver }
