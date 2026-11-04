import fs from 'node:fs/promises'

const lock = JSON.parse(await fs.readFile('package-lock.json', 'utf8'))
const inventory = []
const notices = [
  'ORIGIN third-party notices. Project code: MIT (see repository LICENSE).\nModel: openai-community/gpt2, MIT. Weights are downloaded separately and are not included.\nFonts: browser/system fonts, no redistributed font files.\n',
]
for (const [path, data] of Object.entries(lock.packages)) {
  if (!path.includes('node_modules/')) continue
  try {
    const p = JSON.parse(await fs.readFile(`${path}/package.json`, 'utf8'))
    inventory.push({
      name: p.name,
      version: p.version,
      license: p.license || 'SEE PACKAGE LICENSE',
      dev: !!data.dev,
    })
    if (!data.dev && p.name !== '@origin/web') {
      const files = (await fs.readdir(path)).filter((name) =>
        /^(license|licence|copying|notice)(\..*)?$/i.test(name),
      )
      for (const file of files) {
        if ((await fs.stat(`${path}/${file}`)).isFile())
          notices.push(
            `\n--- ${p.name}@${p.version}: ${file} ---\n${await fs.readFile(`${path}/${file}`, 'utf8')}`,
          )
      }
    }
  } catch {
    /* Optional packages for other operating systems are not installed here. */
  }
}
await fs.writeFile(
  'docs/npm-license-inventory.json',
  JSON.stringify(
    inventory.sort((a, b) => a.name.localeCompare(b.name)),
    null,
    2,
  ) + '\n',
)
notices.push(
  '\n--- GPT-2 official OpenAI license ---\n' +
    (await fs.readFile('docs/GPT2-LICENSE.txt', 'utf8')),
)
await fs.writeFile(
  'apps/web/public/third-party-notices.txt',
  notices
    .join('\n')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, ''),
)
console.log(`${inventory.length} installed npm packages inspected.`)
console.log(
  inventory.filter(
    (p) =>
      !/MIT|ISC|BSD|Apache|CC0|Unlicense|0BSD|BlueOak|Python|Standard/.test(
        JSON.stringify(p.license),
      ),
  ),
)
