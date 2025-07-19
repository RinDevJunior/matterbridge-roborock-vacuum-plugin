import { spawn } from 'child_process';
import { watch } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let isBuilding = false;
let currentProcess = null;

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function killCurrentProcess() {
    if (currentProcess && !currentProcess.killed) {
        currentProcess.kill('SIGINT');
        currentProcess = null;
    }
}

function buildAndRun() {
    if (isBuilding) return;

    isBuilding = true;
    killCurrentProcess();

    console.log('\n🔄 Building...');

    const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: __dirname,
        stdio: 'inherit',
        shell: true
    });

    buildProcess.on('close', (code) => {
        isBuilding = false;
        if (code === 0) {
            console.log('✅ Build successful, starting app...');
            currentProcess = spawn('node', ['dist/app.js'], {
                cwd: __dirname,
                stdio: 'inherit',
                shell: true
            });

            currentProcess.on('close', (appCode) => {
                if (appCode !== 0 && appCode !== null) {
                    console.log(`❌ App exited with code ${appCode}`);
                }
            });
        } else {
            console.log(`❌ Build failed with code ${code}`);
        }
    });
}

// Initial build and run
buildAndRun();

// Watch for file changes
const debouncedBuildAndRun = debounce(buildAndRun, 500);

console.log('👀 Watching src/ directory for changes...');

const watcher = watch(path.join(__dirname, 'src'), { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.ts')) {
        console.log(`📝 File changed: ${filename}`);
        debouncedBuildAndRun();
    }
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping watcher...');
    watcher.close();
    killCurrentProcess();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Stopping watcher...');
    watcher.close();
    killCurrentProcess();
    process.exit(0);
});
