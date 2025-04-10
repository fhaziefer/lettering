// src/pdf/pdf.module.ts

import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { ConfigModule } from '@nestjs/config';
import { StampModule } from 'src/stamp/stamp.module';

@Module({
    imports: [ConfigModule, StampModule],
    providers: [PdfService],
    exports: [PdfService],
})
export class PdfModule { }