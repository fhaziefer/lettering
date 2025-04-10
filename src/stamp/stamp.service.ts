import { Injectable } from '@nestjs/common';
import { createCanvas, loadImage } from 'canvas';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as sharp from 'sharp';

@Injectable()
export class StampService {
    /**
    * Mengambil buffer gambar stempel dan melakukan resize
    * @param imagePath Path ke gambar stempel
    * @returns Buffer gambar yang telah diresize
    */
    private async getStampBuffer(imagePath: string): Promise<Buffer> {
        return await sharp(imagePath)
            .resize(300)
            .png()
            .toBuffer();
    }

    /**
     * Menghitung sudut awal dan akhir untuk teks melingkar berdasarkan panjang teks
     * @param text Teks yang akan dihitung
     * @param ctx Konteks canvas
     * @param radius Radius lingkaran teks
     * @param isBottom Apakah teks berada di bagian bawah
     * @returns Objek berisi startAngle dan endAngle dalam derajat
     */
    private calculateTextAngles(text: string, ctx: CanvasRenderingContext2D, radius: number, isBottom: boolean) {
        // Hitung lebar teks aktual menggunakan konteks canvas
        const textWidth = ctx.measureText(text).width;
        // Hitung keliling lingkaran
        const circumference = 2 * Math.PI * radius;

        // Hitung sudut yang dibutuhkan (dalam radian)
        const angleRangeRad = (textWidth / circumference) * (2 * Math.PI);
        // Konversi ke derajat
        let angleRangeDeg = angleRangeRad * (180 / Math.PI);

        // Beri buffer 10% lebih luas dan batasi maksimal 140 derajat
        angleRangeDeg = Math.min(140, angleRangeDeg * 1.1);

        if (isBottom) {
            // Untuk teks bawah: posisikan di bagian bawah lingkaran
            return {
                startAngle: 90 - (angleRangeDeg / 2),  // Mulai dari kiri bawah
                endAngle: 90 + (angleRangeDeg / 2)     // Berakhir di kanan bawah
            };
        } else {
            // Untuk teks atas: posisikan di bagian atas lingkaran
            return {
                startAngle: 270 - (angleRangeDeg / 2), // Mulai dari kiri atas
                endAngle: 270 + (angleRangeDeg / 2)    // Berakhir di kanan atas
            };
        }
    }

    /**
     * Menggambar teks melingkar di sekitar titik pusat
     * @param ctx Konteks canvas
     * @param text Teks yang akan digambar
     * @param centerX Koordinat X pusat lingkaran
     * @param centerY Koordinat Y pusat lingkaran
     * @param radius Radius lingkaran teks
     * @param isBottom Apakah teks berada di bagian bawah
     * @param margin Jarak margin dari radius utama
     */
    private drawCircularText(
        ctx: any,
        text: string,
        centerX: number,
        centerY: number,
        radius: number,
        isBottom: boolean = false,
        margin: number = 0
    ) {
        // 1. Atur properti dasar teks
        ctx.textAlign = 'center';      // Alignment horizontal tengah
        ctx.textBaseline = 'middle';   // Alignment vertikal tengah
        ctx.fillStyle = '#056bb0';     // Warna text

        // 2. Hitung ukuran font dinamis berdasarkan radius
        const fontSize = Math.min(36, radius * 0.2);  // Maksimal 36px atau 20% dari radius
        ctx.font = `bold ${fontSize}px Arial`;  // Gunakan font Arial bold

        // 3. Hitung sudut awal dan akhir berdasarkan panjang teks
        const angles = this.calculateTextAngles(text, ctx, radius - margin, isBottom);
        const { startAngle, endAngle } = angles;
        const angleRange = endAngle - startAngle;

        // Fungsi helper untuk konversi derajat ke radian
        const angleRad = (angle: number) => (angle * Math.PI) / 180;

        // Pecah teks menjadi array karakter
        const chars = text.split('');

        // Gambar setiap karakter satu per satu
        chars.forEach((char, i) => {
            // Hitung progres posisi karakter (0-1)
            const progress = i / Math.max(1, chars.length - 1);
            // Hitung sudut untuk karakter ini
            const angle = angleRad(startAngle + (angleRange * progress));

            // Hitung posisi x,y karakter
            const x = centerX + (radius - margin) * Math.cos(angle);
            const y = centerY + (radius - margin) * Math.sin(angle);

            // Simpan state canvas sebelum transformasi
            ctx.save();

            // Pindah origin ke posisi karakter
            ctx.translate(x, y);

            // Rotasi karakter berdasarkan posisinya
            if (isBottom) {
                // Untuk teks bawah: orientasi dari kiri ke kanan (rotasi -90°)
                ctx.rotate(angle - Math.PI / 2);
            } else {
                // Untuk teks atas: orientasi dari kiri ke kanan (rotasi +90°)
                ctx.rotate(angle + Math.PI / 2);
            }

            // Gambar karakter
            ctx.fillText(char, 0, 0);

            // Kembalikan state canvas
            ctx.restore();
        });
    }

    /**
     * Membuat stempel dinamis dengan teks melingkar
     * @param topText Teks bagian atas stempel
     * @param bottomText Teks bagian bawah stempel
     * @returns Buffer gambar stempel dalam format PNG
     */
    async generateDynamicStamp(topText: string, bottomText: string): Promise<Buffer> {
        // Path ke gambar stempel kosong
        const cleanStampPath = path.join(process.cwd(), 'src/assets/images/clean_stamp.png');
        // Load gambar stempel kosong
        const cleanStampBuffer = await this.getStampBuffer(cleanStampPath);
        const cleanStampImage = await loadImage(cleanStampBuffer);

        // Buat canvas dengan ukuran 600x600px
        const stampSize = 600;
        const canvas = createCanvas(stampSize, stampSize);
        const ctx = canvas.getContext('2d');

        // Gambar stempel dasar ke canvas
        ctx.drawImage(cleanStampImage, 0, 0, stampSize, stampSize);

        // Radius untuk teks melingkar (38% dari ukuran stempel)
        const baseRadius = stampSize * 0.38;

        // Gambar teks melingkar di bagian atas
        this.drawCircularText(
            ctx,
            topText,
            stampSize / 2,    // Pusat X
            stampSize / 2,    // Pusat Y
            baseRadius,        // Radius
            false,            // Bukan bagian bawah
            0                 // Margin 0
        );

        // Balik urutan teks bawah untuk tampilan yang lebih baik
        const bottomTextReverse = bottomText.split('').reverse().join('');

        // Gambar teks melingkar di bagian bawah
        this.drawCircularText(
            ctx,
            bottomTextReverse,
            stampSize / 2,    // Pusat X
            stampSize / 2,    // Pusat Y
            baseRadius,       // Radius
            true,            // Bagian bawah
            0                // Margin 0
        );

        // Konversi canvas ke buffer PNG
        return canvas.toBuffer('image/png');
    }

    /**
     * Membuat QR Code dengan stempel di tengah
     * @param text Teks untuk QR Code
     * @param topText Teks bagian atas stempel
     * @param bottomText Teks bagian bawah stempel
     * @returns Buffer gambar QR Code dengan stempel dalam format PNG
     */
    async generateQRCodeWithStamp(text: string, topText: string, bottomText: string): Promise<Buffer> {
        const size = 600;  // Ukuran QR Code
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        // Gambar background putih untuk QR code
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        // Generate QR Code langsung ke canvas
        await QRCode.toCanvas(canvas, text, {
            errorCorrectionLevel: 'H',  // Tingkat koreksi error tinggi
            margin: 0,                 // Tanpa margin
            width: size,              // Ukuran penuh canvas
            color: {
                dark: '#056bb0',      // Warna QR code
                light: '#ffffff',    // Background putih
            },
        });

        // Generate stempel dinamis
        const dynamicStamp = await this.generateDynamicStamp(topText, bottomText);
        const stampImage = await loadImage(dynamicStamp);

        // Hitung ukuran dan posisi stempel (45% dari ukuran QR code)
        const stampSize = size * 0.45;
        const x = (size - stampSize) / 2;
        const y = (size - stampSize) / 2;

        // Gambar background putih bulat di belakang stempel
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, stampSize / 2 + 10, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Gambar stempel di atas background putih
        ctx.drawImage(stampImage, x, y, stampSize, stampSize);

        // Konversi canvas ke buffer PNG
        return canvas.toBuffer('image/png');
    }
}