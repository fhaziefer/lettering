// src/undangan/undangan.module.ts

import { Module } from '@nestjs/common';
import { UndanganController } from './undangan.controller';
import { UndanganService } from './undangan.service';
import { PdfModule } from '../pdf/pdf.module';

@Module({
    imports: [PdfModule],
    controllers: [UndanganController],
    providers: [UndanganService],
})
export class UndanganModule { }