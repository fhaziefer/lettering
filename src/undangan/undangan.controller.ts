// src/undangan/undangan.controller.ts

import { Controller, Post, Body } from '@nestjs/common';
import { UndanganService } from './undangan.service';
import { CreateUndanganDto } from './dto/create-undangan.dto';

@Controller('undangan')
export class UndanganController {
    constructor(private readonly undanganService: UndanganService) { }

    @Post()
    async create(@Body() createUndanganDto: CreateUndanganDto) {
        return this.undanganService.generateUndangan(createUndanganDto);
    }
}