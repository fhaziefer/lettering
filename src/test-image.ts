import * as fs from 'fs';
import * as path from 'path';

const assetDir = path.join(__dirname, 'assets');
const images = [
    'images/logo_lim.png',
    'images/sekre.png',
    'images/stamp.png',
    'images/earth.png',
    'images/mail.png',
    'images/ttd-ketua.png',
    'images/ttd-sekretaris.png'
];

images.forEach(img => {
    const fullPath = path.join(assetDir, img);
    try {
        fs.readFileSync(fullPath);
        console.log(`✅ Berhasil membaca ${img}`);
    } catch (error) {
        console.error(`❌ Gagal membaca ${img}:`, error);
    }
});