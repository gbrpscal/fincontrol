import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ANEXO_STORAGE } from "./anexos/anexo-storage.port";
import { AnexosController } from "./anexos/anexos.controller";
import { AnexosService } from "./anexos/anexos.service";
import { LocalDiskAnexoStorage } from "./anexos/local-disk-anexo-storage";
import { BaixasController } from "./baixas/baixas.controller";
import { BaixasService } from "./baixas/baixas.service";
import { EstornosController } from "./estornos/estornos.controller";
import { EstornosService } from "./estornos/estornos.service";
import { TitulosController } from "./titulos/titulos.controller";
import { TitulosService } from "./titulos/titulos.service";

@Module({
  imports: [AuditModule],
  controllers: [TitulosController, BaixasController, EstornosController, AnexosController],
  providers: [
    TitulosService,
    BaixasService,
    EstornosService,
    AnexosService,
    // Troque o adapter aqui (S3/R2/MinIO) sem mexer em nada do domínio.
    { provide: ANEXO_STORAGE, useClass: LocalDiskAnexoStorage },
  ],
})
export class FinanceiroModule {}
