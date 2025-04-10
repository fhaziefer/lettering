// src/stamp/stamp.module.ts

import { Module } from '@nestjs/common';
import { StampService } from './stamp.service';

@Module({
    providers: [StampService],
    exports: [StampService],
})
export class StampModule { }
