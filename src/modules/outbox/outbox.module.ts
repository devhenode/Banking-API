import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { KafkaModule } from '../../infrastructure/kafka/kafka.module.js';
import { OutboxService } from './outbox.service.js';
import { OutboxRelayService } from './outbox-relay.service.js';

@Module({
    imports: [PrismaModule, KafkaModule],
    providers: [OutboxService, OutboxRelayService],
    exports: [OutboxService, OutboxRelayService],
})
export class OutboxModule { }
