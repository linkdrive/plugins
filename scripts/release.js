 const execa = require('execa')
 const path = require('path')
 const fs = require('fs')
 const semver = require('semver')
 const chalk = require('chalk')
 const prompts = require('prompts')
 const crypto = require('crypto')
 const args = require('minimist')(process.argv.slice(2))

 const pkgDir = process.cwd()
 const pkgPath = path.resolve(pkgDir, 'package.json')
 
 const remote = 'origin'
 const HOST = 'https://github.com/linkdrive/sharelist-plugin/blob/master'
 /**
  * @type {{ name: string, version: string }}
  */
 const pkg = require(pkgPath)
 const pkgName = pkg.name.replace(/^@sharelist\//, '')
 const currentVersion = pkg.version
 const isDryRun = args.dry
 
 const skipBuild = args.skipBuild
  
 const commitPath = args['commit-path']
 
 const onlyList = args.list

 /**
  * @type {import('semver').ReleaseType[]}
  */
 const versionIncrements = [
   'patch',
   'minor',
   'major',
   'prepatch',
   'preminor',
   'premajor',
   'prerelease'
 ]
 
 
 const inc = (i) => semver.inc(currentVersion, i, 'beta')
 
 const run = isDryRun ? (bin, args, opts = {}) =>
   console.log(chalk.blue(`[dryrun] ${bin} ${args.join(' ')}`), opts) : (bin, args, opts = {}) =>
   execa(bin, args, { stdio: 'inherit', ...opts })
 
 
 const step = (msg) => console.log(chalk.cyan(msg))
 
 async function main() {
   if( onlyList ){
    await updateList()
    step('\nCommitting changes...')
    await run('git', ['commit', '-am', `docs: update list.json`])

    step('\nPushing to GitHub...')
    await run('git', ['push', remote, 'master'])
  
   }

   let targetVersion = args._[0]
 
   if (!targetVersion) {
     // no explicit version, offer suggestions
     /**
      * @type {{ release: string }}
      */
     const { release } = await prompts({
       type: 'select',
       name: 'release',
       message: 'Select release type',
       choices: versionIncrements
         .map((i) => `${i} (${inc(i)})`)
         .concat(['custom'])
         .map((i) => ({ value: i, title: i }))
     })
 
     if (release === 'custom') {
       /**
        * @type {{ version: string }}
        */
       const res = await prompts({
         type: 'text',
         name: 'version',
         message: 'Input custom version',
         initial: currentVersion
       })
       targetVersion = res.version
     } else {
       targetVersion = release.match(/\((.*)\)/)[1]
     }
   }
 
   if (!semver.valid(targetVersion)) {
     throw new Error(`invalid target version: ${targetVersion}`)
   }
 
   const tag =
     pkgName === 'sharelist' ? `v${targetVersion}` : `${pkgName}@${targetVersion}`
 
   if (targetVersion.includes('beta') && !args.tag) {
     /**
      * @type {{ tagBeta: boolean }}
      */
     const { tagBeta } = await prompts({
       type: 'confirm',
       name: 'tagBeta',
       message: `Publish under dist-tag "beta"?`
     })
 
     if (tagBeta) args.tag = 'beta'
   }
 
   /**
    * @type {{ yes: boolean }}
    */
   const { yes } = await prompts({
     type: 'confirm',
     name: 'yes',
     message: `Releasing ${tag}. Confirm?`
   })
 
   if (!yes) {
     return
   }
 
   step('\nUpdating package version...')
   updateVersion(targetVersion)
 
   step('\nBuilding package...')
   if (!skipBuild && !isDryRun) {
     await run('yarn', ['build'])
   } else {
     console.log(`(skipped build)`)
   }
 
   step('\nGenerating changelog...')
   await run('yarn', ['changelog'])
 
   const { stdout } = await run('git', ['diff'], { stdio: 'pipe' })
   if (stdout) {
     step('\nCommitting changes...')
     await run('git', ['add', '-A'].concat(commitPath || []))
     await run('git', ['commit', '-m', `release: ${tag}`])
   } else {
     console.log('No changes to commit.')
   }
 
   step('\nPushing to GitHub...')
   await run('git', ['tag', tag])
   await run('git', ['push', remote, `refs/tags/${tag}`])
   await run('git', ['push', remote, 'master'])
 
   if (isDryRun) {
     console.log(`\nDry run finished - run git diff to see package changes.`)
   }
 
 }
 
 /**
  * @param {string} version
  */
 function updateVersion(version) {
   const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
   pkg.version = version
   fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
   
   // update content {{version}}
  //  const filepath = path.resolve(pkgDir, 'index.js')
  //  let content = fs.readFileSync(filepath, 'utf-8')
   
   updateList()
 }

  const md5 = content => crypto.createHash('md5').update(content).digest("hex")

  function createReadMe(){

  }
 function updateList(){
    let filepath = path.join( __dirname ,'../packages')
    let pluginsData = fs.readdirSync(filepath).map((name) => {
      let pluginpath = path.join( filepath , '../packages',name,'index.js')

      let pkgData = JSON.parse(fs.readFileSync(path.join( filepath , '../packages',name,'package.json'),'utf-8'))
      let url = HOST + `/packages/${name}/index.js`

      let content = fs.readFileSync(pluginpath, 'utf-8')

      const metaContent = content.match(/(?<===Sharelist==)[\w\W]+(?===\/Sharelist==)/)?.[0]
      const meta = {
        hash: md5(content)
      }
  
      if (metaContent) {
        let pairs = metaContent.split(/[\r\n]/).filter(Boolean).map(i => i.match(/(?<=@)([^\s]+?)\s+(.*)/)).filter(Boolean)
        for (let i of pairs) {
          meta[i[1]] = i[2]
        }
      }
      
      let changedFlag = false
      if( url != meta.updateURL){
        changedFlag = true
        content = content.replace(/(@updateURL\s+)(.*)/,($0,$1) => $1 + url)
        meta.updateURL = url
      }

      if( pkgData.version != meta.version){
        content = content.replace(/(@version\s+)(.*)/,($0,$1) => $1 + pkgData.version)
      }

      if( changedFlag ){
        fs.writeFileSync(pluginpath, content)
      }
      return meta
    })

    createReadMe(pluginsData)
    fs.writeFileSync(path.join( __dirname ,'../list.json'),JSON.stringify(pluginsData))
 }

 main().catch((err) => {
   console.error(err)
 })