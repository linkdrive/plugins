//===Sharelist===
// @name         Local File System
// @namespace    https://github.com/reruin/sharelist
// @version      1.0.0
// @license      MIT
// @description  挂载本地磁盘
// @author       reruin@gmail.com
// @supportURL   https://github.com/reruin/sharelist
// @updateURL    https://raw.githubusercontent.com/linkdrive/sharelist-plugin/master/packages/filesystem/index.js
//===/Sharelist==

const { basename, dirname, posix, join } = require('path')
const fs = require('fs')
const os = require('os')
const { pipeline } = require('stream')
const crypto = require('crypto')

const isWinOS = os.platform() == 'win32'

const pipe = (...rest) => new Promise((resolve, reject) => pipeline(...rest, (err) => err ? reject({ message: 'The error occurred during pipe stream' }) : resolve()))

const md5 = content => crypto.createHash('md5').update(content).digest("hex")

const md5file = (filepath, fast) => new Promise((resolve, reject) => {
  const stream = fs.createReadStream(filepath);
  const hash = crypto.createHash('md5');
  stream.on('data', chunk => {
    hash.update(chunk, 'utf8');
  });
  stream.on('end', () => {
    resolve(hash.digest('hex'))
  });
})

const md5fileFast = (filepath, size = 256 * 1024) => {
  fs.open(filepath, 'r', (err, fd) => {
    const buff = Buffer.alloc(size);
    fs.read(fd, buff, 0, buff.length, null, (err, bytesRead, chunk) => {
      if (bytesRead) {
        console.log(bytesRead, `md5: ${md5(chunk.slice(0, bytesRead))}`);
      } else {
        start = false;
        console.timeEnd('readtime');
        fs.closeSync(fd);
      }
    });
  });
}

const fileExist = (file) => new Promise((resolve, reject) => {
  fs.access(file, fs.constants.F_OK, (err) => {
    resolve(err ? false : true)
  });
})
/**
 * Convert posix style path to windows style
 *
 * @param {string} [p]
 * @return {string}
 */
const winStyle = (p) =>
  p
    .replace(/^\/([^\/]+?)/, '$1:\\')
    .replace(/\//g, '\\')
    .replace(/(?<!\:)\\+$/, '')
    .replace(/\\{2,}/g, '\\')

/**
 * Convert windows style path to posix style
 *
 * @param {string} [p]
 * @return {string}
 */
const posixStyle = (p) =>
  p
    .split('\\')
    .join('/')
    .replace(/^([a-z])\:/i, '/$1')

/**
 * normalize path(posix style) and replace current path
 *
 * @param {string} [p]
 * @return {string}
 */
const normalize = (p) => posix.normalize(p.replace(/\.\//, slpath(process.cwd()) + '/'))

const slpath = (p) => (isWinOS ? posixStyle(p) : p)

// const this.ospath = (p) => (isWinOS ? winStyle(p) : (p))

const parseRelativePath = (p) => p.replace(/\.\//, slpath(process.cwd()) + '/')
// let stat = fs.statSync('D:\CloudMusic\Falcom Sound Team jdk - 浮游大陆アルジェス -Introduction-.mp3')
// console.log(stat)

const ERROR_CODE = {
  'EBUSY': 423,
}

const fileStat = (src) => {
  try {
    return fs.statSync(src)
  } catch (e) { }
}

const fileRename = (filepath, targetpath) => {
  try {
    fs.renameSync(filepath, targetpath)
  } catch (e) {
  }
}

const createError = (e) => {
  console.log(e)

  let error = { message: e.code }
  if (ERROR_CODE[e.code]) {
    error.code = ERROR_CODE[e.code]
  }
  return { error }
}

const ospath = (p, base = '') => {
  p = base + p
  return isWinOS ? winStyle(p) : (p)
}

const encode = (filepath) => {
  return slpath(filepath).substring(1)
}

class FileSystem {
  static options = {
    globalSearch: false,
    localSearch: true,
    protocol: "fs",
    cache: false,
    mountable: true,
    pagination: false,
    guide: [
      { key: 'root_id', label: '目录地址', type: 'string', required: true },
    ],
  }

  constructor(app, config) {
    this.app = app
    this.config = config
  }

  ospath(p) {
    return ospath(p ? `/${p}` : (this.config.root_id))
  }

  isRoot(p) {
    return p == this.config.root_id.substring(1)
  }
  /**
    * 列出目录
    *
    * @param {string} [id] 文件(目录)id 唯一值
    * 
    * @param {object} [options] 参数
    * @param {object} [options.order_by] 排序
    * @param {object} [options.search] 搜索内容
    * @param {object} [options.page] 页码
    * @param {object} [options.per_page] 每页条目数
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
  async list(id, { search, orderBy } = {}) {
    let filepath = this.ospath(id)
    let stat = fs.statSync(filepath)


    if (stat.isDirectory()) {
      let files = []
      fs.readdirSync(filepath).forEach((filename) => {
        let dir = join(filepath, filename) //normalize(id + '/' + filename)
        let stat
        try {
          stat = fs.statSync(dir)
        } catch (e) {
          // console.log(e)
        }

        let rid = encode(dir)
        let obj = {
          id: rid,
          name: filename,
        }
        if (stat) {
          if (stat.isDirectory()) {
            obj.type = 'folder'
          } else if (stat.isFile()) {
            obj.type = 'file'
            obj.size = stat.size
          }
          obj.ctime = stat.ctimeMs
          obj.mtime = stat.mtimeMs
          obj.extra = {
            fid: rid,
            parent_id: id
          }
        }

        if (!search || filename.includes(search)) {
          files.push(obj)
        }
      })

      if (orderBy) {
        let [type, isAsc] = orderBy
        let aVal = isAsc ? 1 : -1
        let bVal = isAsc ? -1 : 1
        files.sort((a, b) => a[type] > [b.type] ? aVal : bVal)
      }
      files.sort((a, b) => (a.type == 'folder' && b.type != 'folder') ? -1 : 1)

      return { id, files }
    }

    return this.app.error({ message: 'path is not exist' })
  }

  async get(id) {
    let stat = fileStat(this.ospath(id))
    if (!stat) return this.app.error({ code: 404 })
    let isRoot = this.isRoot(id)

    if (isRoot) {
      return {
        id,
        name: '@drive_root',
        type: 'folder'
      }
    }

    let data = {
      id: id,
      name: basename(id),
      size: stat.size,
      type: stat.isDirectory() ? 'folder' : 'file',
      ctime: stat.ctimeMs,
      mtime: stat.mtimeMs,
      extra: {
        fid: id,
        parent_id: id ? dirname(id) : undefined,
      }
    }
    if (data.type == 'file') {
      data.extra.md5 = await md5file(this.ospath(id))
      console.log(data.extra.md5)
    }
    return data
  }

  mkdir(id, name) {
    let filepath = this.ospath(id)
    let target = join(filepath, name)

    if (fs.existsSync(target) == false) {
      fs.mkdirSync(target)
    }

    return { id: normalize(id + '/' + name), name }
  }

  rm(id) {
    let filepath = this.ospath(id)
    try {
      fs.rmSync(filepath, { force: false, recursive: true })
    } catch (e) {
      return createError(e)
    }
    return { id }
  }

  rename(id, name) {
    let filepath = this.ospath(id)
    let dir = dirname(filepath)
    let targetpath = join(dir, name)
    try {
      fs.renameSync(filepath, targetpath)
    } catch (e) {
      console.log(e)
      return createError(e)
    }

    return { id: `${dir + '/' + name}`, name }
  }

  /**
   * move
   * @param {*} id file or folder ID
   * @param {string} target folder ID
   * @returns 
   */
  async mv(id, target) {
    // console.log('mv', id, target)
    let filepath = this.ospath(id)
    let targetpath = this.ospath(target)

    let dst = join(targetpath, basename(id))

    try {
      fs.renameSync(filepath, dst)
    } catch (e) {
      return createError(e)
    }

    return { id: encode(dst) }
  }

  async afterUpload() {
    //rename filename.filepart -> filename
  }

  async beforeUpload(id, name) {
    let filepath = this.ospath(id)
    let tmpfile = join(filepath, name + '.filepart')

    fs.access(file, fs.constants.F_OK, (err) => { console.log(`${file} ${err ? '不存在' : '存在'}`); });
    fs.closeSync(fs.openSync(tmpfile, 'w'))

    let uploadId = md5(id + '_' + name)
    return { uploadId }
  }

  async upload(id, stream, { size, name, manual, uploadId, ...options }) {
    let filepath = this.ospath(id)
    let target = join(filepath, name)
    let currentUploadId = md5(id + '_' + name)

    if (currentUploadId != uploadId) {
      // 不是同一个上传实例,似乎无关紧要
    }
    let uploadFile = target + '.filepart'
    let filepart = await fileStat(uploadFile)
    let start = 0
    // 创建空文件
    if (!filepart) {
      fs.closeSync(fs.openSync(uploadFile, 'w'))
    } else {
      start = filepart.size
    }


    const done = async (customStream) => {
      let writeStream = fs.createWriteStream(uploadFile, { ...options, start, flags: 'a' })
      await pipe(stream || customStream, writeStream)
      //rename
      fileRename(uploadFile, target)
      return { id: encode(target), name }
    }
    if (manual) {
      //这个upload
      return {
        uploadId: currentUploadId, start, done
      }
    } else {
      return await done(stream)
    }
  }

  async createReadStream(id, options = {}) {
    let filepath = this.ospath(id)
    return fs.createReadStream(filepath, { ...options, highWaterMark: 64 * 1024 })
  }
}

module.exports = { driver: FileSystem }