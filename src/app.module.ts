import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UndanganModule } from './undangan/undangan.module';
import { PdfModule } from './pdf/pdf.module';
import { StampModule } from './stamp/stamp.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    UndanganModule,
    PdfModule,
    StampModule
  ],
  exports: [StampModule, PdfModule, UndanganModule]
})
export class AppModule { }