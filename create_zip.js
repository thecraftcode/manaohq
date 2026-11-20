const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.join(__dirname, 'deploy_build.zip'));
const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
});

output.on('close', function () {
    console.log(archive.pointer() + ' total bytes');
    console.log('archiver has been finalized and the output file descriptor has closed.');
});

archive.on('error', function (err) {
    throw err;
});

archive.pipe(output);

// Next.js Standalone build structure:
// Put everything from .build/standalone into the root of the ZIP
archive.directory('.build/standalone/', false);

// Plus the static directory needs to go into .build/static
archive.directory('.build/static/', '.build/static');

// Plus the public directory needs to go into public/
archive.directory('public/', 'public');

// Include env
archive.file('.env.local', { name: '.env.local' });

archive.finalize();
