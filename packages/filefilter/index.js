//===Sharelist===
// @name         FileFilter
// @namespace    https://github.com/reruin/sharelist
// @version      1.0.0
// @license      MIT
// @description  提供基础目录过滤、加密功能
// @author       reruin@gmail.com
// @supportURL   https://github.com/reruin/sharelist
// @updateURL    https://github.com/linkdrive/sharelist-plugin/blob/master/packages/filefilter/index.js
//===/Sharelist==


const ignore = require('ignore')

const isIgnorePath = (p = '', config) => {
  p = p.replace(/^\//, '')
  return p && ignore().add([].concat(config.acl_file, config.ignores)).ignores(p)
}

const isForbiddenPath = () => false

const authMethods = {
  basic(key, data) {
    return data.some(i => '' + i === key)
  },
  async http(key, data, request) {
    let { data: res } = await request(data.replace('{key}', key), { responseType: 'text' })
    return res === 'success'
  }
}

const cache = {}

module.exports = (sharelist) => {
  const { config, driver, utils: { yaml, safeCall } } = sharelist

  return {
    config() {
      return [
        { code: 'acl_file', label: '加密文件名', type: 'string', default: '.passwd' },
        { code: 'ignores', label: '忽略路径', type: 'array' },
      ]
    },

    beforeList({ params, path }) {
      //使用路径模式，提前排除
      if (path && isIgnorePath(path, config)) {
        throw { code: 404 }
      }

      if (path && isForbiddenPath(path, config)) {
        throw { code: 404 }
      }
    },

    async afterList({ data, params }) {
      if (!config.acl_file) return
      let hit = data?.files.find(i => i.name == config.acl_file)

      if (hit) {
        let scope = { id: data.id }

        let auth = params.auth?.[data.id]

        if (!auth) throw { code: 401, message: 'Invalid password', scope }

        let content

        if (cache[hit.id]) {
          content = cache[hit.id]
        } else {
          await safeCall(async () => {
            content = yaml.parse(await driver.getContent(hit.id))
            console.log(content)
          })
        }

        if (!content) throw { code: 401, message: 'Invalid password', scope }

        cache[hit.id] = content

        if (await authMethods?.[content.type]('' + auth, content.data, sharelist.request) !== true) {
          throw { code: 401, message: 'Invalid password', scope }
        }

      }

    }
  }
}