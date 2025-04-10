// src/pdf/pdf.service.ts

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';
import { ConfigService } from '@nestjs/config';
import { StampService } from '../stamp/stamp.service';
import { formatFullDate } from 'src/utils/date.util';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

@Injectable()
export class PdfService {
    private readonly templateDir = path.join(__dirname, '../../src/templates');
    private readonly assetDir = path.join(__dirname, '../../src/assets');
    private readonly uploadDir = path.join(__dirname, '../../uploads');
    private readonly pdfDir = path.join(this.uploadDir, 'documents');
    private readonly imageDir = path.join(this.uploadDir, 'images');

    constructor(
        private configService: ConfigService,
        private stampService: StampService,
    ) {
        this.registerPartials();
        this.ensureDirectoriesExist();
    }

    private ensureDirectoriesExist() {
        // Buat folder uploads dan subfolder jika belum ada
        [this.uploadDir, this.pdfDir, this.imageDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // Tambahkan method ini
    private async encodeImageToBase64(imagePath: string): Promise<string> {
        try {
            const fullPath = path.join(this.assetDir, imagePath);

            if (!fs.existsSync(fullPath)) {
                console.error(`Image not found: ${fullPath}`);
                return '';
            }

            const imageBuffer = fs.readFileSync(fullPath);
            return imageBuffer.toString('base64');
        } catch (error) {
            console.error(`Error encoding image ${imagePath}:`, error);
            return '';
        }
    }

    private registerPartials() {
        const partialsDir = path.join(this.templateDir, 'partials');

        fs.readdirSync(partialsDir).forEach(file => {
            const partialName = path.basename(file, '.hbs');
            const partialContent = fs.readFileSync(path.join(partialsDir, file), 'utf8');
            handlebars.registerPartial(partialName, partialContent);
        });
    }

    private async getDriveService(): Promise<drive_v3.Drive> {
        const auth = new google.auth.GoogleAuth({
            keyFile: this.configService.get('GOOGLE_DRIVE_KEY_FILE'),
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        const authClient = await auth.getClient() as any; // Type workaround
        return google.drive({
            version: 'v3',
            auth: authClient as any, // Type workaround
        });
    }

    private async uploadFileToDrive(
        filePath: string,
        fileName: string,
        mimeType: string,
        isPdf: boolean
    ): Promise<string | null> {

        try {
            const driveService = await this.getDriveService();
            const folderId = isPdf
                ? this.configService.get('GOOGLE_DRIVE_PDF_FOLDER_ID')
                : this.configService.get('GOOGLE_DRIVE_IMAGE_FOLDER_ID');

            if (!folderId) {
                throw new Error(`Google Drive folder ID for ${isPdf ? 'PDF' : 'Image'} is not configured`);
            }

            const fileMetadata: drive_v3.Params$Resource$Files$Create['requestBody'] = {
                name: fileName,
                parents: [folderId],
            };

            const media = {
                mimeType,
                body: fs.createReadStream(filePath),
            };

            const response = await driveService.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id',
            });

            await driveService.permissions.create({
                fileId: response.data.id as string,
                requestBody: {
                    role: 'reader',
                    type: 'anyone',
                },
            });

            return `https://drive.google.com/file/d/${response.data.id}/view`;
        } catch (error) {
            console.error(`Error uploading ${isPdf ? 'PDF' : 'Image'} to Google Drive:`, error);
            return null;
        }
    }

    async generatePdfAndImage(data: any): Promise<{
        localPdfUrl: string;
        localImageUrl?: string;
        drivePdfUrl?: string;
        driveImageUrl?: string;
    }> {

        const dateNow = new Date();
        const formattedDate = formatFullDate(dateNow)

        const stampText = `Surat nomor ${data.nomorSurat} resmi diterbitkan oleh ${data.tingkatKepengurusan} Lembaga Ittihadul Muballighin ${data.daerahKepengurusan} pada ${formattedDate}`;
        const dynamicStampBuffer = await this.stampService.generateQRCodeWithStamp(stampText, data.tingkatKepengurusan.toUpperCase(), data.daerahKepengurusan.toUpperCase());
        const dynamicStampBase64 = dynamicStampBuffer.toString('base64');

        // Compile template
        const images = {
            logoBase64: await this.encodeImageToBase64('images/logo_lim.png'),
            ketuaBase64: dynamicStampBase64,
            sekreBase64: dynamicStampBase64,
            stampBase64: dynamicStampBase64
        };

        // Gabungkan dengan data template
        const templateData = { ...data, ...images };

        // Compile template
        const templatePath = path.join(this.templateDir, 'index.hbs');
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        const template = handlebars.compile(templateContent);
        const html = template(templateData);

        // Generate PDF
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
        });
        const page = await browser.newPage();

        await page.setViewport({
            width: 793,
            height: 1122, // A4 ratio (1200 x 1697)
            deviceScaleFactor: 2 // Retina quality
        });

        // Set HTML content
        await page.setContent(html, {
            waitUntil: 'networkidle0',
        });

        const [pdfBuffer, imageBuffer] = await Promise.all([
            page.pdf({ format: 'A4', printBackground: true }),
            page.screenshot({ type: 'png', fullPage: true })
        ]);

        await browser.close();

        // Save files locally
        const timestamp = Date.now();
        const pdfFilename = `undangan_${timestamp}.pdf`;
        const imageFilename = `undangan_${timestamp}.png`;

        const pdfPath = path.join(this.pdfDir, pdfFilename);
        const imagePath = path.join(this.imageDir, imageFilename);

        await Promise.all([
            fs.promises.writeFile(pdfPath, pdfBuffer),
            fs.promises.writeFile(imagePath, imageBuffer)
        ]);

        // Prepare local URLs
        const baseUrl = this.configService.get('BASE_URL') || 'http://localhost:3000';
        const localPdfUrl = `${baseUrl}/uploads/documents/${pdfFilename}`;
        const localImageUrl = `${baseUrl}/uploads/images/${imageFilename}`;

        // Upload to Google Drive if enabled
        let drivePdfUrl: string | undefined;
        let driveImageUrl: string | undefined;

        if (this.configService.get('GOOGLE_DRIVE_ENABLED') === 'true') {
            const [pdfResult, imageResult] = await Promise.all([
                this.uploadFileToDrive(pdfPath, pdfFilename, 'application/pdf', true),
                this.uploadFileToDrive(imagePath, imageFilename, 'image/png', false)
            ]);

            drivePdfUrl = pdfResult || undefined;
            driveImageUrl = imageResult || undefined;
        }

        return {
            localPdfUrl,
            localImageUrl,
            drivePdfUrl,
            driveImageUrl
        };
    }
}