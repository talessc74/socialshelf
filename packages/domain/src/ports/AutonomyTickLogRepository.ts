import type { AutonomyTickLogEntry } from '../entities/AutonomyTickLogEntry.js'

// Histórico consultável do que aconteceu em cada tentativa do tick de autonomia por marca —
// sem isso, o resultado só existia por um instante na resposta HTTP que o Cloud Scheduler
// recebe e descarta, sem nenhum jeito (nem para o usuário, nem para suporte) de saber depois
// se publicou, pulou (e por quê) ou deu erro.
export interface AutonomyTickLogRepository {
  save(entry: AutonomyTickLogEntry): Promise<void>
  findRecentByBrand(userId: string, brandId: string, limit: number): Promise<AutonomyTickLogEntry[]>
}
