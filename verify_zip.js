const fs = require('fs');
const unzipper = require('unzipper');

async function listZip() {
    const directory = await unzipper.Open.file('deploy_build.zip');
    console.log('Total files in ZIP:', directory.files.length);

    // Look for our specific changes
    const tagsManagerFile = directory.files.find(f => f.path.includes('tags-manager'));
    console.log('Found tags-manager related file?', !!tagsManagerFile, tagsManagerFile ? tagsManagerFile.path : '');

    const envLocal = directory.files.find(f => f.path === '.env.local');
    console.log('Found .env.local?', !!envLocal);

    // Print top level structure
    const topLevels = new Set(directory.files.map(f => f.path.split('/')[0]));
    console.log('Top level folders in ZIP:', Array.from(topLevels));
}

listZip().catch(console.error);
