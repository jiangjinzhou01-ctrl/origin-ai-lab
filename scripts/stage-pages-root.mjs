import fs from 'node:fs/promises'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'apps/web/dist')
const manifest = path.join(root, '.origin-pages-files.json')
const allowed = (name) =>
  /^(assets|data)\/[\w.\/-]+$/.test(name) ||
  ['index.html', 'origin.svg', 'third-party-notices.txt', '.nojekyll'].includes(name)
let previous = []
try {
  previous = JSON.parse(await fs.readFile(manifest, 'utf8'))
} catch (e) {
  if (e.code !== 'ENOENT') throw e
}
const files = []
async function collect(directory, prefix = '') {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name
    if (entry.isDirectory()) await collect(path.join(directory, entry.name), name + '/')
    else {
      if (!allowed(name) || name.includes('..')) throw Error('Unexpected deploy file: ' + name)
      files.push(name)
    }
  }
}
await collect(dist)
for (const name of previous) {
  if (!allowed(name) || name.includes('..')) throw Error('Invalid old manifest path')
  if (!files.includes(name) && name !== '.nojekyll')
    await fs.unlink(path.join(root, name)).catch((e) => {
      if (e.code !== 'ENOENT') throw e
    })
}
for (const name of files) {
  await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true })
  await fs.copyFile(path.join(dist, name), path.join(root, name))
}
await fs.writeFile(path.join(root, '.nojekyll'), '')
await fs.writeFile(manifest, JSON.stringify([...files, '.nojekyll'].sort(), null, 2) + '\n')
console.log(`Staged ${files.length} verified static files for main-root Pages.`)
